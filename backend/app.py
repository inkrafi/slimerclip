import os
import json
import shutil
import re
import time
import threading
import uuid
# pyrefly: ignore [missing-import]
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
from itsdangerous import BadSignature, URLSafeTimedSerializer
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
load_dotenv()  # sebelum membaca CORS_ORIGINS / FLASK_DEBUG / SUPABASE_URL
from auth import AUTH_ENABLED, User, current_user, derived_key
from caption_styles import sanitize_caption_style
import clip_effects
from accounts import (FREE_ANALYSES, PREVIEW_DAILY_LIMIT, RENDER_DAILY_LIMIT, SERVER_KEY_DAILY_CAP, AccountsError, accounts,
                      decrypt_key)
from gemini_service import analyze_youtube_video, validate_api_key
from download_service import download_video, find_cached_video
from render_pipeline import RenderPipeline
from jobs import JobManager
from youtube_utils import extract_video_id as _extract_video_id, is_youtube_url as _is_youtube_url

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024 * 1024  # Maks 10GB upload (file video besar, admin)
if os.getenv("TRUST_PROXY", "0") == "1":
    # Di belakang reverse proxy (hosting): pakai skema & host asli dari header X-Forwarded-*
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
render_pipeline = RenderPipeline()
# Render memakai CPU penuh (FFmpeg + Whisper), jadi batch dari beberapa request
# dijalankan bergantian, bukan bersamaan.
_render_lock = threading.Lock()
jobs = JobManager()

# Set up FFmpeg path for Windows (dynamically add bin/ffmpeg/bin to PATH)
FFMPEG_BIN_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin", "ffmpeg", "bin")
if os.path.exists(FFMPEG_BIN_DIR) and FFMPEG_BIN_DIR not in os.environ.get("PATH", ""):
    os.environ["PATH"] = FFMPEG_BIN_DIR + os.pathsep + os.environ.get("PATH", "")

# ──────────────────────────────────────────────────────────────
# Cache: simpan hasil analisis Gemini ke file JSON agar tidak
# perlu analisa ulang jika video yang sama diinput kembali.
# Hasil analisis video YouTube publik dipakai bersama semua pengguna;
# pustaka tiap pengguna dicatat terpisah (accounts.add_video).
# ──────────────────────────────────────────────────────────────
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
os.makedirs(CACHE_DIR, exist_ok=True)
ANALYSIS_CACHE_FILE = os.path.join(CACHE_DIR, "analysis_cache.json")
_cache_lock = threading.Lock()

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.mkv', '.mov', '.avi', '.webm', '.m4v', '.flv'}
CLIPS_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "clips")
# Format edit tersimpan per pengguna (templates/<pengguna>/templates.json)
TEMPLATES_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
MAX_TEMPLATES = 20
TEMPLATE_ID_RE = re.compile(r"^[a-f0-9]{12}$")
_templates_lock = threading.Lock()

# Batas untuk pengguna biasa (admin tanpa batas)
USER_UPLOAD_MAX_MB = int(os.getenv("USER_UPLOAD_MAX_MB", "500"))
USER_UPLOAD_MAX_MINUTES = int(os.getenv("USER_UPLOAD_MAX_MINUTES", "90"))

# URL klip berisi token bertanda tangan (tag <video> tidak bisa mengirim header login)
MEDIA_URL_MAX_AGE = 24 * 3600
_media_signer = URLSafeTimedSerializer(derived_key("media-url").hex(), salt="clip-url")
# URL publik backend untuk link klip; kosong = dari request (atau ProxyFix di hosting)
PUBLIC_BACKEND_URL = os.getenv("PUBLIC_BACKEND_URL", "").strip().rstrip("/")

# ──────────────────────────────────────────────────────────────
# Keamanan
# ──────────────────────────────────────────────────────────────
# Origin frontend yang boleh memanggil API (pisahkan dengan koma di .env)
ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",") if o.strip()]
# Mode lokal: host yang boleh dipakai untuk mengakses backend (mencegah DNS rebinding)
ALLOWED_HOSTS = {"localhost", "127.0.0.1", "[::1]"}
# Endpoint tanpa login (klip dilindungi token di URL-nya)
PUBLIC_ENDPOINTS = {"health_check", "serve_clip", "serve_asset", "serve_sfx", "static"}

SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
ALLOWED_RESOLUTIONS = {"720", "1080", "2160"}  # sisi pendek video 9:16; 2160 = 4K
TIME_RE = re.compile(r"^\d{1,3}:\d{2}(:\d{2})?(\.\d+)?$")
GEMINI_KEY_RE = re.compile(r"^[A-Za-z0-9_-]{20,200}$")


class ApiError(Exception):
    """Error yang dikirim ke frontend sebagai {"error", "code"} dengan status HTTP tertentu."""

    def __init__(self, status: int, message: str, code: str | None = None):
        super().__init__(message)
        self.status, self.message, self.code = status, message, code


def _is_safe_id(value) -> bool:
    """ID dipakai sebagai nama folder — hanya huruf, angka, '_' dan '-' (tanpa '..', '/', '\\')."""
    return isinstance(value, str) and bool(SAFE_ID_RE.match(value))


def _user() -> User:
    """Pengguna request ini (sudah dipastikan login oleh _guard)."""
    return current_user()


def _require_admin(user: User):
    if not user.is_admin:
        raise ApiError(403, "Fitur ini hanya untuk admin.", "admin_only")


# ── Folder per pengguna ──────────────────────────────────────
# Admin lokal memakai struktur lama (clips/<video_id>, downloads/<video_id>);
# pengguna login memakai subfolder u_<user_id>/ agar file tidak tercampur.

def _owner_root(root: str, user: User) -> str:
    return os.path.join(root, user.storage_key) if user.storage_key else root


def _clips_dir(user: User, video_id: str) -> str:
    return os.path.join(_owner_root(CLIPS_ROOT, user), video_id)


def _uploads_base(user: User) -> str:
    return _owner_root(UPLOADS_DIR, user)


def _assets_dir(user: User) -> str:
    """Aset editor (logo watermark, musik latar) milik pengguna."""
    return _owner_root(clip_effects.ASSETS_ROOT, user)


def _public_base() -> str:
    return f"{PUBLIC_BACKEND_URL}/" if PUBLIC_BACKEND_URL else request.host_url


def _clip_url(base: str, user: User, video_id: str, filename: str, version: int) -> str:
    url = f"{base}clips/{video_id}/{filename}?v={version}"
    if AUTH_ENABLED:
        url += "&t=" + _media_signer.dumps([user.storage_key, video_id, filename])
    return url


def _signed_media_url(base: str, path: str, token_parts: list, version: int) -> str:
    url = f"{base}{path}?v={version}"
    if AUTH_ENABLED:
        url += "&t=" + _media_signer.dumps(token_parts)
    return url


def _resolve_upload_path(user: User, ref: str) -> str | None:
    """
    Ubah referensi upload ("<video_id>/<filename>") menjadi path absolut di dalam
    folder upload milik pengguna. Return None jika path keluar dari folder tersebut.
    """
    if not isinstance(ref, str) or not ref:
        return None
    base = os.path.realpath(_uploads_base(user))
    path = os.path.realpath(os.path.join(base, ref))
    if os.path.commonpath([base, path]) != base or not os.path.isfile(path):
        return None
    return path


def _sanitize_options(options) -> dict:
    """Ambil hanya opsi render yang dikenal dan pastikan nilainya aman."""
    options = options if isinstance(options, dict) else {}
    resolution = str(options.get("resolution", "1080"))
    return {
        "resolution": resolution if resolution in ALLOWED_RESOLUTIONS else "1080",
        "caption_enabled": bool(options.get("caption_enabled", True)),
        "smart_tracking": bool(options.get("smart_tracking", True)),
        "split_screen": bool(options.get("split_screen", True)),
        "caption_style": sanitize_caption_style(options.get("caption_style")),
    }


def _sanitize_segments(segments) -> list | None:
    """Validasi daftar segmen; return None jika ada yang tidak valid."""
    if not isinstance(segments, list) or not segments or len(segments) > 50:
        return None
    clean = []
    for seg in segments:
        if not isinstance(seg, dict):
            return None
        num = seg.get("segment_number")
        start, end = seg.get("start_time"), seg.get("end_time")
        if not isinstance(num, int) or isinstance(num, bool) or not 0 < num < 1000:
            return None
        if not (isinstance(start, str) and TIME_RE.match(start.strip())
                and isinstance(end, str) and TIME_RE.match(end.strip())):
            return None
        clean.append({**seg, "start_time": start.strip(), "end_time": end.strip()})
    return clean


# ──────────────────────────────────────────────────────────────
# Manifest klip: catatan klip yang sudah dirender per video
# (<folder klip>/manifest.json), agar hasil render tidak hilang
# dan tidak perlu dirender ulang.
# ──────────────────────────────────────────────────────────────
_manifest_lock = threading.Lock()
RENDER_OPTION_KEYS = ("resolution", "caption_enabled", "smart_tracking", "split_screen", "caption_style")


def _manifest_path(folder: str) -> str:
    return os.path.join(folder, "manifest.json")


def _load_manifest(folder: str) -> dict:
    try:
        with open(_manifest_path(folder), "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data.get("clips"), dict) else {"clips": {}}
    except (OSError, ValueError):
        return {"clips": {}}


def _entry_base(entry: dict) -> str:
    """Nama dasar file klip (<video>_<awal>-<akhir>), dipakai juga untuk transkrip & cache tata letak."""
    if entry.get("base"):
        return entry["base"]
    name = entry.get("filename") or entry.get("preview_filename") or ""
    return name.removesuffix(".mp4").removesuffix(".preview")


def _record_clip(folder: str, segment: dict, output_path: str, options: dict):
    """
    Catat klip yang selesai dirender ke manifest video (key = rentang momen).
    Pratinjau (tanpa caption, untuk diedit) dan klip final dicatat di entri yang sama.
    """
    key = f"{segment.get('start_time')}-{segment.get('end_time')}"
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    name = os.path.basename(output_path)
    with _manifest_lock:
        manifest = _load_manifest(folder)
        entry = manifest["clips"].get(key) or {}
        entry.update({
            "key": key,
            "base": name.removesuffix(".mp4").removesuffix(".preview"),
            "start_time": segment.get("start_time"),
            "end_time": segment.get("end_time"),
            "topic": segment.get("topic", ""),
            # Judul saran: dari analisis (short_title); render dari editor tidak membawanya, jadi yang lama dipakai
            "short_title": (clip_effects.clean_title(segment.get("short_title")) or entry.get("short_title")
                            or clip_effects.suggested_title(segment)),
            "segment_number": segment.get("segment_number"),
            "viral_score": segment.get("viral_score"),
            "layout": options.get("layout_summary"),
            "updated_at": now,
        })
        if options.get("mode") == "preview":
            entry.update({
                "preview_filename": name,
                "preview_range": options.get("range"),
                "previewed_at": now,
                "render_options": {k: options.get(k) for k in RENDER_OPTION_KEYS},
            })
        else:
            entry.update({
                "filename": name,
                "range": options.get("range"),
                "rendered_at": now,
                "resolution": options.get("resolution"),
                "caption": options.get("caption_enabled"),
                "final_options": {k: options.get(k) for k in RENDER_OPTION_KEYS},
                "edit": options.get("edit"),
            })
        manifest["clips"][key] = entry
        path = _manifest_path(folder)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)


def _media_duration(path: str) -> float | None:
    """Durasi video (detik) dari header file, tanpa men-decode."""
    try:
        import av  # PyAV, ikut terpasang bersama faster-whisper
        with av.open(path) as container:
            if container.duration:
                return round(container.duration / av.time_base, 1)
            stream = next((s for s in container.streams if s.duration and s.time_base), None)
            if stream:
                return round(float(stream.duration * stream.time_base), 1)
    except Exception:
        pass
    try:
        import cv2
        cap = cv2.VideoCapture(path, cv2.CAP_FFMPEG)
        fps = cap.get(cv2.CAP_PROP_FPS) or 0
        frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
        cap.release()
        return round(frames / fps, 1) if fps > 0 and frames > 0 else None
    except Exception:
        return None


def _list_clips(user: User, video_id: str, base: str) -> list:
    """
    Daftar klip milik pengguna yang sudah dirender (file masih ada), terbaru dulu, lengkap dengan URL.
    Klip lama yang dibuat sebelum ada manifest tetap ikut ditampilkan sebagai "klip lama".
    """
    folder = _clips_dir(user, video_id)
    clips = []
    recorded = set()
    for entry in _load_manifest(folder)["clips"].values():
        final = entry.get("filename") and os.path.join(folder, entry["filename"])
        preview = entry.get("preview_filename") and os.path.join(folder, entry["preview_filename"])
        final = final if final and os.path.isfile(final) else None
        preview = preview if preview and os.path.isfile(preview) else None
        if not final and not preview:
            continue
        recorded.update(os.path.basename(f) for f in (final, preview) if f)
        shown = final or preview
        clips.append({
            **entry,
            "title": _clip_title(video_id, entry),
            "legacy": False,
            # Klip final bisa diunduh; pratinjau (tanpa caption) hanya untuk diedit
            "status": "final" if final else "preview",
            "url": _clip_url(base, user, video_id, entry["filename"], int(os.path.getmtime(final))) if final else None,
            "preview_url": (_clip_url(base, user, video_id, entry["preview_filename"], int(os.path.getmtime(preview)))
                            if preview else None),
            "file_size_mb": round(os.path.getsize(shown) / (1024 * 1024), 1),
            "rendered_at": entry.get("updated_at") or entry.get("rendered_at"),
        })

    if os.path.isdir(folder):
        for name in os.listdir(folder):
            path = os.path.join(folder, name)
            # Lewati file yang sudah tercatat dan sisa render yang setengah jadi
            if (not name.lower().endswith(".mp4") or name in recorded or name.startswith("temp_")
                    or name.endswith(".rendering.mp4") or name.endswith(".preview.mp4") or not os.path.isfile(path)):
                continue
            duration = _media_duration(path)
            if duration is None:
                continue  # file rusak (mis. render lama yang terhenti di tengah jalan)
            mtime = os.path.getmtime(path)
            clips.append({
                "key": f"file:{name}",
                "start_time": None,
                "end_time": None,
                "topic": "",
                "filename": name,
                "rendered_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime)),
                "duration_seconds": duration,
                "legacy": True,
                "status": "final",
                "preview_url": None,
                "url": _clip_url(base, user, video_id, name, int(mtime)),
                "file_size_mb": round(os.path.getsize(path) / (1024 * 1024), 1),
            })

    clips.sort(key=lambda c: c.get("rendered_at") or "", reverse=True)
    return clips


def _upload_files(user: User, video_id: str) -> list[str]:
    folder = os.path.join(_uploads_base(user), video_id)
    if not os.path.isdir(folder):
        return []
    return [
        os.path.join(folder, f) for f in os.listdir(folder)
        if os.path.splitext(f)[1].lower() in ALLOWED_VIDEO_EXTENSIONS and os.path.isfile(os.path.join(folder, f))
    ]


def _latest_upload(user: User, video_id: str) -> dict | None:
    """File video yang pernah diupload pengguna untuk video ini (terbaru), agar tidak perlu upload ulang."""
    files = _upload_files(user, video_id)
    if not files:
        return None
    newest = max(files, key=os.path.getmtime)
    name = os.path.basename(newest)
    return {
        "video_id": video_id,
        "filename": name,
        "local_video_path": f"{video_id}/{name}",
        "file_size_mb": round(os.path.getsize(newest) / (1024 * 1024), 1),
    }


# Analisis yang sedang berjalan per video: request kedua (mis. halaman di-refresh)
# menunggu hasil yang sama alih-alih memanggil Gemini lagi.
_analysis_inflight: dict[str, threading.Event] = {}
_analysis_inflight_lock = threading.Lock()


def _cached_youtube_url(video_id: str) -> str:
    with _cache_lock:
        return (_load_cache().get(video_id) or {}).get("youtube_url") or ""


def _load_cache() -> dict:
    """Muat cache dari file JSON. Return dict kosong jika file belum ada."""
    try:
        if os.path.exists(ANALYSIS_CACHE_FILE):
            with open(ANALYSIS_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print(f"[Cache] Gagal memuat cache: {e}")
    return {}


def _save_cache(cache: dict):
    """Simpan dict cache ke file JSON secara atomik."""
    try:
        tmp_path = ANALYSIS_CACHE_FILE + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, ANALYSIS_CACHE_FILE)
    except Exception as e:
        print(f"[Cache] Gagal menyimpan cache: {e}")


def _get_cached_analysis(video_id: str) -> dict | None:
    """Ambil hasil analisis dari cache. Return None jika tidak ada."""
    with _cache_lock:
        cache = _load_cache()
        entry = cache.get(video_id)
        if entry:
            cached_at = entry.get("cached_at", "")
            print(f"[Cache] HIT! Video {video_id} (cached: {cached_at})")
            return entry.get("result")
    return None


def _save_analysis_to_cache(video_id: str, result: dict, youtube_url: str):
    """Simpan hasil analisis ke cache."""
    with _cache_lock:
        cache = _load_cache()
        cache[video_id] = {
            "video_id": video_id,
            "youtube_url": youtube_url,
            "cached_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "result": result
        }
        _save_cache(cache)
        print(f"[Cache] Disimpan: video {video_id} ({len(cache)} video di cache)")

CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})


@app.before_request
def _guard():
    """
    Tolak request yang bukan dari frontend sendiri, lalu pastikan pengguna sudah login:
    - Mode lokal: Host selain localhost ditolak → mencegah DNS rebinding dari website lain.
    - Origin asing → mencegah website lain mengirim request (mis. form upload
      multipart, yang tidak melewati preflight CORS) ke backend ini.
    - Mode login: semua endpoint (kecuali health check & file klip bertoken) butuh token Supabase.
    """
    if not AUTH_ENABLED:
        host = (request.host or "").rsplit(":", 1)[0].lower()
        if host not in ALLOWED_HOSTS:
            abort(403)
    origin = request.headers.get("Origin")
    if origin and origin not in ALLOWED_ORIGINS:
        abort(403)
    if request.method == "OPTIONS" or request.endpoint in PUBLIC_ENDPOINTS:
        return None
    if current_user() is None:
        return jsonify({"error": "Silakan masuk dulu untuk melanjutkan.", "code": "auth_required"}), 401
    return None


@app.errorhandler(ApiError)
def _api_error(e: ApiError):
    body = {"error": e.message}
    if e.code:
        body["code"] = e.code
    return jsonify(body), e.status


@app.errorhandler(AccountsError)
def _accounts_error(e: AccountsError):
    print(f"[Accounts] {e}")
    return jsonify({"error": "Layanan akun sedang bermasalah. Coba lagi beberapa saat.", "code": "accounts_unavailable"}), 503


@app.errorhandler(RequestEntityTooLarge)
def _too_large(e):
    return jsonify({"error": "File terlalu besar.", "code": "file_too_large"}), 413

# ══════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════

@app.route("/")
def health_check():
    return jsonify({"status": "ok", "service": "SlimerClip Backend"})


# ── Akun ─────────────────────────────────────────────────────

def _me_payload(user: User) -> dict:
    profile = accounts.profile(user)
    data = {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "is_admin": user.is_admin,
        "auth_enabled": AUTH_ENABLED,
        "has_gemini_key": bool(profile.get("gemini_key_enc")),
        "gemini_key_hint": profile.get("gemini_key_hint"),
        # Batas hanya untuk pengguna biasa; null = tanpa batas
        "free_analyses_limit": None,
        "free_analyses_left": None,
        "render_daily_limit": None,
        "renders_today": None,
        "preview_daily_limit": None,
        "previews_today": None,
        "upload_max_mb": None,
        "upload_max_minutes": None,
    }
    if not user.is_admin:
        used = int(profile.get("free_analyses_used") or 0)
        data.update({
            "free_analyses_limit": FREE_ANALYSES,
            "free_analyses_left": max(0, FREE_ANALYSES - used),
            "render_daily_limit": RENDER_DAILY_LIMIT,
            "renders_today": accounts.usage_today("render", user_id=user.id),
            "preview_daily_limit": PREVIEW_DAILY_LIMIT,
            "previews_today": accounts.usage_today("preview", user_id=user.id),
            "upload_max_mb": USER_UPLOAD_MAX_MB,
            "upload_max_minutes": USER_UPLOAD_MAX_MINUTES,
        })
    return data


@app.route("/me", methods=["GET"])
def me():
    return jsonify(_me_payload(_user()))


@app.route("/me/gemini-key", methods=["PUT"])
def me_set_gemini_key():
    """Simpan API key Gemini milik pengguna (dicek ke Google dulu, disimpan terenkripsi)."""
    user = _user()
    if not AUTH_ENABLED:
        raise ApiError(400, "Mode lokal memakai GEMINI_API_KEY di backend/.env.")
    data = request.get_json(silent=True) or {}
    api_key = data.get("api_key")
    api_key = api_key.strip() if isinstance(api_key, str) else ""
    if not GEMINI_KEY_RE.match(api_key):
        raise ApiError(400, "Format API key tidak dikenali. Salin key dari Google AI Studio (biasanya diawali \"AIza\").", "invalid_key")
    problem = validate_api_key(api_key)
    if problem:
        raise ApiError(400, problem, "invalid_key")
    accounts.profile(user)  # pastikan baris profil ada
    accounts.set_gemini_key(user.id, api_key)
    return jsonify(_me_payload(user))


@app.route("/me/gemini-key", methods=["DELETE"])
def me_delete_gemini_key():
    user = _user()
    if not AUTH_ENABLED:
        raise ApiError(400, "Mode lokal memakai GEMINI_API_KEY di backend/.env.")
    accounts.set_gemini_key(user.id, None)
    return jsonify(_me_payload(user))


@app.route("/me", methods=["DELETE"])
def me_delete():
    """Hapus akun beserta seluruh file (upload & klip) milik pengguna."""
    user = _user()
    if not AUTH_ENABLED:
        raise ApiError(400, "Tidak ada akun di mode lokal.")
    if jobs.active_keys(user.id):
        raise ApiError(409, "Masih ada render yang berjalan. Tunggu sampai selesai, lalu coba lagi.", "render_active")
    for root in (CLIPS_ROOT, UPLOADS_DIR):
        shutil.rmtree(_owner_root(root, user), ignore_errors=True)
    accounts.delete_user(user.id)
    return jsonify({"message": "Akun dan seluruh datamu sudah dihapus."})


# ── Pustaka video ────────────────────────────────────────────

@app.route("/videos", methods=["GET"])
def videos_list():
    """Riwayat: video yang sudah dianalisis pengguna, terbaru dulu."""
    user = _user()
    base = _public_base()
    with _cache_lock:
        cache = _load_cache()
    owned = accounts.video_ids(user.id)  # None = mode lokal, semua video
    order = [(vid, entry.get("cached_at") or "") for vid, entry in cache.items()] if owned is None \
        else [(vid, added) for vid, added in owned if vid in cache]
    order.sort(key=lambda x: x[1], reverse=True)

    items = []
    for vid_id, _ in order:
        entry = cache[vid_id]
        result = entry.get("result", {})
        meta = result.get("video_metadata") or {}
        items.append({
            "video_id": vid_id,
            "youtube_url": entry.get("youtube_url"),
            "analyzed_at": entry.get("cached_at"),
            "title": meta.get("title", ""),
            "channel": meta.get("channel", ""),
            "duration": meta.get("duration", 0),
            "segment_count": len(result.get("segments", [])),
            "clip_count": len(_list_clips(user, vid_id, base)) if _is_safe_id(vid_id) else 0,
        })
    return jsonify({"items": items})


@app.route("/videos/<video_id>", methods=["GET"])
def video_detail(video_id):
    """Halaman video: hasil analisis, klip yang sudah dirender, dan file upload yang tersedia."""
    if not _is_safe_id(video_id):
        return jsonify({"error": "video_id tidak valid."}), 400
    user = _user()
    # Analisis baru tampil setelah video masuk pustaka pengguna (lewat /analyze, gratis jika sudah tersimpan)
    analysis = _get_cached_analysis(video_id) if accounts.owns_video(user.id, video_id) else None
    return jsonify({
        "video_id": video_id,
        "analysis": analysis,
        "analyzing": video_id in _analysis_inflight,
        "clips": _list_clips(user, video_id, _public_base()),
        "upload": _latest_upload(user, video_id),
    })


@app.route("/videos/<video_id>/clips", methods=["GET"])
def video_clips(video_id):
    if not _is_safe_id(video_id):
        return jsonify({"error": "video_id tidak valid."}), 400
    return jsonify({"clips": _list_clips(_user(), video_id, _public_base())})


@app.route("/videos/<video_id>", methods=["DELETE"])
def video_delete(video_id):
    """Hapus video dari riwayat pengguna beserta klip & file upload miliknya."""
    if not _is_safe_id(video_id):
        return jsonify({"error": "video_id tidak valid."}), 400
    user = _user()
    if AUTH_ENABLED:
        # Hasil analisis dipakai bersama pengguna lain, jadi hanya dikeluarkan dari pustaka
        accounts.remove_video(user.id, video_id)
        shutil.rmtree(os.path.join(_uploads_base(user), video_id), ignore_errors=True)
    else:
        # Mode lokal: hapus analisis (video sumber di downloads/ tetap disimpan)
        with _cache_lock:
            cache = _load_cache()
            cache.pop(video_id, None)
            _save_cache(cache)
    shutil.rmtree(_clips_dir(user, video_id), ignore_errors=True)
    return jsonify({"message": "Video dihapus dari riwayat."})


@app.route("/cache", methods=["GET"])
def cache_list():
    """Tampilkan daftar semua video yang sudah di-cache (admin)."""
    _require_admin(_user())
    with _cache_lock:
        cache = _load_cache()
    summary = []
    for vid_id, entry in cache.items():
        summary.append({
            "video_id": vid_id,
            "youtube_url": entry.get("youtube_url"),
            "cached_at": entry.get("cached_at"),
            "segment_count": len(entry.get("result", {}).get("segments", [])),
        })
    summary.sort(key=lambda x: x["cached_at"] or "", reverse=True)
    return jsonify({"total": len(summary), "items": summary})


@app.route("/cache/<video_id>", methods=["DELETE"])
def cache_delete(video_id):
    """Hapus cache untuk video_id tertentu (admin)."""
    _require_admin(_user())
    with _cache_lock:
        cache = _load_cache()
        if video_id not in cache:
            return jsonify({"error": f"Video {video_id} tidak ada di cache."}), 404
        del cache[video_id]
        _save_cache(cache)
    return jsonify({"message": f"Cache video {video_id} berhasil dihapus."})


@app.route("/cache", methods=["DELETE"])
def cache_clear_all():
    """Hapus seluruh cache analisis (admin)."""
    _require_admin(_user())
    with _cache_lock:
        _save_cache({})
    return jsonify({"message": "Seluruh cache berhasil dihapus."})


# ── Analisis ─────────────────────────────────────────────────

def _analysis_payer(user: User) -> tuple[str | None, bool]:
    """
    Tentukan API key untuk analisis baru: (api_key pengguna atau None untuk key server, jatah_gratis_dipakai).
    Admin selalu memakai key server. Pengguna biasa memakai key sendiri jika ada, jika tidak
    mengambil satu dari jatah analisis gratis.
    """
    if user.is_admin:
        return None, False
    own_key = decrypt_key(accounts.profile(user).get("gemini_key_enc"))
    if own_key:
        return own_key, False
    if accounts.usage_today("analysis", server_key=True) >= SERVER_KEY_DAILY_CAP:
        raise ApiError(503, "Jatah analisis gratis SlimerClip untuk hari ini sudah habis. Pakai API key Gemini "
                            "milikmu sendiri (gratis dari Google AI Studio), atau coba lagi besok.", "server_quota")
    if not accounts.reserve_free_analysis(user.id):
        raise ApiError(402, f"{FREE_ANALYSES} analisis gratismu sudah terpakai. Masukkan API key Gemini "
                            "milikmu sendiri untuk lanjut menganalisis.", "quota_exhausted")
    return None, True


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Analisis video YouTube via Gemini AI.

    Video yang sudah pernah dianalisis (oleh siapa pun) langsung dipakai tanpa memotong kuota.
    Response: JSON hasil analisis.
    """
    user = _user()
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body kosong."}), 400

    youtube_url = data.get("youtube_url", "")
    youtube_url = youtube_url.strip() if isinstance(youtube_url, str) else ""
    if not youtube_url:
        return jsonify({"error": "youtube_url tidak boleh kosong."}), 400
    if not _is_youtube_url(youtube_url):
        return jsonify({"error": "URL tidak valid. Masukkan link YouTube yang benar."}), 400
    video_id = _extract_video_id(youtube_url)
    if not video_id or not _is_safe_id(video_id):
        return jsonify({"error": "Tidak bisa menemukan ID video dari URL tersebut."}), 400

    # ── Cek Cache dulu ──
    if not data.get("force_refresh", False):
        cached = _get_cached_analysis(video_id)
        if cached:
            accounts.add_video(user.id, video_id)
            return jsonify({**cached, "from_cache": True}), 200

    # ── Analisa baru via Gemini (satu analisis per video dalam satu waktu) ──
    with _analysis_inflight_lock:
        running = _analysis_inflight.get(video_id)
        if running is None:
            _analysis_inflight[video_id] = threading.Event()
    if running is not None:
        running.wait(timeout=600)
        cached = _get_cached_analysis(video_id)
        if cached:
            accounts.add_video(user.id, video_id)
            return jsonify({**cached, "from_cache": True}), 200
        return jsonify({"error": "Analisis sebelumnya untuk video ini gagal. Coba lagi."}), 422

    reserved = succeeded = False
    try:
        api_key, reserved = _analysis_payer(user)
        upload = _latest_upload(user, video_id)
        media_path = _resolve_upload_path(user, upload["local_video_path"]) if upload else None
        result = analyze_youtube_video(youtube_url, api_key=api_key, media_path=media_path,
                                       allow_download=user.is_admin)
        if "error" in result:
            return jsonify(result), 422
        succeeded = True
        accounts.record_usage(user.id, "analysis", server_key=api_key is None)
        accounts.add_video(user.id, video_id)
        return _finish_analysis(video_id, youtube_url, result)
    finally:
        if reserved and not succeeded:
            try:
                accounts.refund_free_analysis(user.id)
            except AccountsError as e:
                print(f"[Accounts] Gagal mengembalikan jatah analisis: {e}")
        with _analysis_inflight_lock:
            event = _analysis_inflight.pop(video_id, None)
        if event:
            event.set()


def _finish_analysis(video_id, youtube_url, result):
    # Sort segmen berdasarkan viral_score (tertinggi dulu) dan re-number
    segments = result.get("segments", [])
    segments.sort(key=lambda s: s.get("viral_score", 0), reverse=True)
    for i, seg in enumerate(segments):
        seg["segment_number"] = i + 1
    result["segments"] = segments
    if segments:
        result["best_segment_number"] = 1

    # Simpan ke cache setelah analisis berhasil
    if video_id:
        _save_analysis_to_cache(video_id, result, youtube_url)

    result["from_cache"] = False
    return jsonify(result), 200


# ── Upload & render ──────────────────────────────────────────

def _fmt_duration(seconds: float) -> str:
    s = int(round(seconds))
    return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


@app.route("/upload-video", methods=["POST"])
def upload_video():
    """
    Upload file video lokal dari komputer user.
    Form field: 'video' (file), 'video_id' (string, ID unik untuk sesi analisis)
    """
    user = _user()
    max_bytes = USER_UPLOAD_MAX_MB * 1024 * 1024
    # Cek ukuran dari header sebelum isi request dibaca
    if not user.is_admin and (request.content_length or 0) > max_bytes + 1024 * 1024:
        raise ApiError(413, f"File terlalu besar. Maksimal {USER_UPLOAD_MAX_MB} MB.", "file_too_large")

    if 'video' not in request.files:
        return jsonify({"error": "Tidak ada file yang diupload. Pastikan field bernama 'video'."}), 400

    file = request.files['video']
    video_id = request.form.get('video_id', 'local_upload')
    if not _is_safe_id(video_id):
        return jsonify({"error": "video_id tidak valid (hanya huruf, angka, '_' dan '-')."}), 400

    if not file.filename:
        return jsonify({"error": "Nama file kosong."}), 400

    # Validasi ekstensi file
    _, ext = os.path.splitext(file.filename.lower())
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        return jsonify({"error": f"Format file tidak didukung. Gunakan: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}"}), 400

    # Simpan file ke folder upload milik pengguna: <uploads>/<video_id>/
    video_upload_dir = os.path.join(_uploads_base(user), video_id)
    os.makedirs(video_upload_dir, exist_ok=True)

    safe_filename = secure_filename(file.filename)
    # secure_filename bisa membuang seluruh nama (mis. nama non-ASCII) → pastikan tetap ada nama + ekstensi
    if not safe_filename.lower().endswith(ext):
        safe_filename = f"{os.path.splitext(safe_filename)[0] or 'video'}{ext}"
    save_path = os.path.join(video_upload_dir, safe_filename)

    print(f"[Upload] Menyimpan file: {safe_filename} -> {save_path}")
    file.save(save_path)

    def reject(message: str, code: str):
        os.remove(save_path)
        raise ApiError(400, message, code)

    if not user.is_admin and os.path.getsize(save_path) > max_bytes:
        reject(f"File terlalu besar. Maksimal {USER_UPLOAD_MAX_MB} MB.", "file_too_large")

    duration = _media_duration(save_path)
    if not user.is_admin:
        if duration is None:
            reject("File video tidak bisa dibaca. Coba ekspor ulang sebagai MP4.", "unreadable_file")
        if duration > USER_UPLOAD_MAX_MINUTES * 60:
            reject(f"Video terlalu panjang ({_fmt_duration(duration)}). Maksimal {USER_UPLOAD_MAX_MINUTES} menit.",
                   "file_too_long")
    # File harus video yang sama dengan yang dianalisis, agar timestamp momen tepat
    expected = ((_get_cached_analysis(video_id) or {}).get("video_metadata") or {}).get("duration") or 0
    if duration and expected and abs(duration - expected) > max(15, expected * 0.03):
        reject(f"Durasi file ({_fmt_duration(duration)}) tidak sama dengan video YouTube-nya "
               f"({_fmt_duration(expected)}). Upload file dari video yang sama.", "duration_mismatch")

    if not user.is_admin:
        # Simpan satu file per video saja untuk menghemat ruang
        for other in _upload_files(user, video_id):
            if os.path.abspath(other) != os.path.abspath(save_path):
                os.remove(other)

    file_size_mb = os.path.getsize(save_path) / (1024 * 1024)
    print(f"[Upload] Berhasil: {safe_filename} ({file_size_mb:.1f} MB)")

    return jsonify({
        "success": True,
        "video_id": video_id,
        "filename": safe_filename,
        # Referensi relatif terhadap folder upload pengguna — backend yang menerjemahkan ke path asli
        "local_video_path": f"{video_id}/{safe_filename}",
        "file_size_mb": round(file_size_mb, 1)
    }), 200


@app.route("/generate", methods=["POST"])
def generate_clips():
    """Mulai render batch di belakang layar. Hasil: job yang statusnya bisa dipantau lewat /jobs."""
    user = _user()
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body kosong"}), 400

    youtube_url = data.get("youtube_url") or ""
    upload_ref = data.get("local_video_path")  # Opsional: referensi "<video_id>/<filename>" dari /upload-video
    segments = _sanitize_segments(data.get("segments"))
    options = _sanitize_options(data.get("options"))

    if segments is None:
        return jsonify({"error": "Daftar segmen tidak valid (butuh segment_number, start_time & end_time MM:SS)."}), 400

    # Validasi: harus ada salah satu sumber video
    if not upload_ref and not youtube_url:
        return jsonify({"error": "Harus ada youtube_url atau local_video_path."}), 400
    if not upload_ref and not user.is_admin:
        raise ApiError(403, "Render langsung dari link YouTube hanya untuk admin. Upload file videonya untuk merender.",
                       "upload_required")

    # File lokal hanya boleh dari folder upload milik pengguna (hasil /upload-video)
    local_video_path = None
    if upload_ref:
        local_video_path = _resolve_upload_path(user, upload_ref)
        if not local_video_path:
            return jsonify({"error": "File upload tidak ditemukan. Silakan upload ulang videonya."}), 400
    elif not isinstance(youtube_url, str) or not _is_youtube_url(youtube_url.strip()):
        return jsonify({"error": "URL tidak valid. Masukkan link YouTube yang benar."}), 400
    else:
        youtube_url = youtube_url.strip()

    # video_id dipakai sebagai nama folder output → wajib aman
    video_id = data.get("video_id")  # bisa diset dari frontend saat mode upload
    if not video_id and youtube_url:
        video_id = _extract_video_id(youtube_url)
    if not video_id:
        video_id = "local_clip"
    if not _is_safe_id(video_id):
        return jsonify({"error": "video_id tidak valid."}), 400

    options["video_id"] = video_id
    options["output_dir"] = _clips_dir(user, video_id)
    # Render pertama selalu pratinjau tanpa caption; caption, hook & efek diatur di editor lalu render final
    options["mode"] = "preview"

    # Momen yang sedang antre/dirender untuk video ini tidak diantrekan lagi
    busy = {key for _, key in jobs.active_keys(user.id, video_id)}
    segments = [seg for seg in segments if f"{seg['start_time']}-{seg['end_time']}" not in busy]
    if not segments:
        return jsonify({"error": "Momen yang dipilih sedang dirender. Tunggu sampai selesai."}), 409

    # Jatah pratinjau harian (termasuk yang masih antre)
    if not user.is_admin:
        left = (PREVIEW_DAILY_LIMIT - accounts.usage_today("preview", user_id=user.id)
                - len(jobs.active_keys(user.id, mode="preview")))
        if left <= 0:
            raise ApiError(429, f"Jatah pratinjau hari ini ({PREVIEW_DAILY_LIMIT} klip) sudah terpakai. Coba lagi besok.",
                           "preview_quota")
        if len(segments) > left:
            raise ApiError(429, f"Sisa jatah pratinjau hari ini {left} klip. Pilih maksimal {left} momen.", "preview_quota")

    cached = _get_cached_analysis(video_id) or {}
    title = (cached.get("video_metadata") or {}).get("title", "")
    job = jobs.create(user.id, video_id, title, segments, mode="preview")
    base = _public_base()  # dibaca sebelum masuk thread

    threading.Thread(
        target=_run_render_job,
        args=(job["id"], user, video_id, segments, options, local_video_path, youtube_url, base),
        daemon=True,
    ).start()
    return jsonify({"job": job}), 202


def _run_render_job(job_id, user, video_id, segments, options, local_video_path, youtube_url, base):
    """Worker job render: siapkan video sumber lalu render tiap momen, sambil memperbarui status job."""
    try:
        # 1. Dapatkan video sumber
        if local_video_path:
            video_path = local_video_path
            jobs.update_download(job_id, status="finished", progress=100)
            print(f"[Render] Job {job_id}: file lokal {local_video_path}")
        else:
            jobs.update(job_id, status="downloading")
            jobs.update_download(job_id, status="downloading", progress=0)

            def download_cb(msg):
                fields = {k: msg[k] for k in ("status", "progress") if k in msg}
                if fields:
                    jobs.update_download(job_id, **fields)

            video_path = download_video(youtube_url, callback=download_cb, video_id=video_id)
            jobs.update_download(job_id, status="finished", progress=100)
            print(f"[Render] Job {job_id}: video sumber {video_path}")

        # 2. Render tiap momen (bergantian dengan job lain) — satu gagal tidak menghentikan lainnya
        if not _render_lock.acquire(blocking=False):
            jobs.update(job_id, status="queued", message="Menunggu render lain selesai")
            _render_lock.acquire()
        try:
            jobs.update(job_id, status="running", message=None)
            failed = 0
            for seg in segments:
                n = seg["segment_number"]
                jobs.update_segment(job_id, n, status="cutting", progress=0)

                def render_cb(msg, n=n):
                    if msg.get("status") and msg["status"] != "done":
                        jobs.update_segment(job_id, n, status=msg["status"], progress=msg.get("progress", 0))

                try:
                    result = render_pipeline.process_clip(video_path, seg, options, callback=render_cb)
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    failed += 1
                    jobs.update_segment(job_id, n, status="error", progress=100, message=str(e)[-500:])
                    continue

                filename = os.path.basename(result["output_path"])
                url = _clip_url(base, user, video_id, filename, int(time.time()))
                try:
                    _record_clip(options["output_dir"], seg, result["output_path"],
                                 {**options, "layout_summary": result.get("layout"), "range": result.get("range"),
                                  "mode": result.get("mode")})
                except OSError as e:
                    print(f"[Manifest] Gagal mencatat klip: {e}")
                try:
                    accounts.record_usage(user.id, "preview" if result.get("mode") == "preview" else "render")
                except AccountsError as e:
                    print(f"[Accounts] Gagal mencatat pemakaian render: {e}")
                jobs.update_segment(job_id, n, status="done", progress=100, url=url)
        finally:
            _render_lock.release()

        jobs.update(job_id, status="done",
                    message=f"{failed} klip gagal dirender" if failed else None)
    except Exception as e:
        import traceback
        traceback.print_exc()
        jobs.update(job_id, status="error", message=str(e)[-500:])
        job = jobs.get(job_id)
        for n, seg in (job["segments"].items() if job else []):
            if seg["status"] not in ("done", "error"):
                jobs.update_segment(job_id, n, status="error", message=str(e)[-500:])


@app.route("/jobs", methods=["GET"])
def jobs_list():
    """Job render aktif & yang baru selesai milik pengguna. Filter opsional: ?video_id=..."""
    video_id = request.args.get("video_id")
    if video_id is not None and not _is_safe_id(video_id):
        return jsonify({"error": "video_id tidak valid."}), 400
    return jsonify({"jobs": jobs.list(_user().id, video_id)})


@app.route("/jobs/<job_id>", methods=["GET"])
def job_detail(job_id):
    job = jobs.get(job_id, owner=_user().id)
    if not job:
        return jsonify({"error": "Job tidak ditemukan (mungkin backend sempat di-restart)."}), 404
    return jsonify({"job": job})


# ══════════════════════════════════════════════════════════════
# Editor klip (khusus admin): aset (logo, musik) dan render ulang satu klip dengan resep edit
# ══════════════════════════════════════════════════════════════
MAX_ASSETS = {True: 60, False: 20}  # admin / pengguna biasa


def _asset_entry(user: User, name: str, base: str) -> dict:
    path = os.path.join(_assets_dir(user), name)
    return {
        "name": name,
        # Nama asli tanpa awalan acak "<8 hex>_"
        "label": name.split("_", 1)[1] if re.match(r"^[0-9a-f]{8}_", name) else name,
        "kind": clip_effects.asset_kind(name),
        "size_mb": round(os.path.getsize(path) / (1024 * 1024), 2),
        "url": _signed_media_url(base, f"assets-file/{name}", [user.storage_key, name], int(os.path.getmtime(path))),
    }


def _list_assets(user: User, base: str) -> list:
    folder = _assets_dir(user)
    if not os.path.isdir(folder):
        return []
    names = [n for n in os.listdir(folder)
             if clip_effects.asset_kind(n) and clip_effects.ASSET_NAME_RE.match(n) and os.path.isfile(os.path.join(folder, n))]
    names.sort(key=lambda n: os.path.getmtime(os.path.join(folder, n)), reverse=True)
    return [_asset_entry(user, n, base) for n in names]


def _media_has_stream(path: str, kind: str) -> bool:
    """Pastikan file benar-benar gambar/audio (bukan sekadar ekstensinya)."""
    try:
        import av
        with av.open(path) as container:
            streams = container.streams.video if kind == "image" else container.streams.audio
            # Header saja bisa lolos untuk file palsu: pastikan satu frame benar-benar bisa di-decode
            return bool(streams) and next(container.decode(streams[0]), None) is not None
    except Exception:
        return False


def _templates_path(user: User) -> str:
    return os.path.join(_owner_root(TEMPLATES_ROOT, user), "templates.json")


def _load_templates(user: User) -> list:
    try:
        with open(_templates_path(user), encoding="utf-8") as f:
            items = json.load(f)
        return items if isinstance(items, list) else []
    except (OSError, ValueError):
        return []


def _save_templates(user: User, items: list):
    path = _templates_path(user)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False)
    os.replace(tmp, path)


@app.route("/edit-templates", methods=["GET"])
def templates_list():
    return jsonify({"templates": _load_templates(_user())})


@app.route("/edit-templates", methods=["POST"])
def templates_save():
    """Simpan format edit (tampilan klip + pengaturan caption & render). Nama yang sama = ditimpa."""
    user = _user()
    body = request.get_json(silent=True) or {}
    name = re.sub(r"\s+", " ", str(body.get("name") or "")).strip()[:40]
    if not name:
        raise ApiError(400, "Beri nama format edit ini.")
    with _templates_lock:
        items = _load_templates(user)
        existing = next((t for t in items if str(t.get("name", "")).lower() == name.lower()), None)
        if not existing and len(items) >= MAX_TEMPLATES:
            raise ApiError(400, f"Maksimal {MAX_TEMPLATES} format edit. Hapus yang tidak dipakai dulu.")
        template = {
            "id": existing["id"] if existing else uuid.uuid4().hex[:12],
            "name": name,
            "edit": clip_effects.template_style(body.get("edit")),
            "options": _sanitize_options(body.get("options")),
            # Teks sumber mengikuti channel video tempat format dipakai
            "source_auto": bool(body.get("source_auto")),
            "updated_at": int(time.time()),
        }
        _save_templates(user, [template] + [t for t in items if t is not existing])
    return jsonify({"template": template}), 201


@app.route("/edit-templates/<template_id>", methods=["DELETE"])
def templates_delete(template_id):
    user = _user()
    if not TEMPLATE_ID_RE.match(template_id):
        raise ApiError(400, "Format edit tidak valid.")
    with _templates_lock:
        _save_templates(user, [t for t in _load_templates(user) if t.get("id") != template_id])
    return jsonify({"message": "Format edit dihapus."})


@app.route("/assets", methods=["GET"])
def assets_list():
    user = _user()
    return jsonify({"assets": _list_assets(user, _public_base())})


@app.route("/assets", methods=["POST"])
def assets_upload():
    user = _user()
    file = request.files.get("file")
    if not file or not file.filename:
        raise ApiError(400, "Pilih file logo atau musik.")
    kind = clip_effects.asset_kind(file.filename)
    if not kind:
        raise ApiError(400, "Format tidak didukung. Logo: PNG, JPG, WEBP. Musik: MP3, M4A, AAC, WAV, OGG.")
    folder = _assets_dir(user)
    os.makedirs(folder, exist_ok=True)
    limit = MAX_ASSETS[user.is_admin]
    if len(os.listdir(folder)) >= limit:
        raise ApiError(400, f"Maksimal {limit} aset. Hapus aset yang tidak dipakai dulu.")

    ext = os.path.splitext(file.filename)[1].lower()
    stem = secure_filename(os.path.splitext(file.filename)[0])[:60] or kind
    name = f"{uuid.uuid4().hex[:8]}_{stem}{ext}"
    path = os.path.join(folder, name)
    file.save(path)
    max_mb = clip_effects.ASSET_MAX_MB[kind]
    if os.path.getsize(path) > max_mb * 1024 * 1024:
        os.remove(path)
        raise ApiError(400, f"File terlalu besar. Maksimal {max_mb} MB untuk {'logo' if kind == 'image' else 'musik'}.")
    if not _media_has_stream(path, kind):
        os.remove(path)
        raise ApiError(400, "File tidak bisa dibaca. Pastikan file tidak rusak.")
    return jsonify({"asset": _asset_entry(user, name, _public_base())}), 201


@app.route("/assets/<name>", methods=["DELETE"])
def assets_delete(name):
    user = _user()
    if not clip_effects.ASSET_NAME_RE.match(name) or ".." in name:
        raise ApiError(400, "Nama aset tidak valid.")
    path = os.path.join(_assets_dir(user), name)
    if os.path.isfile(path):
        os.remove(path)
    return jsonify({"message": "Aset dihapus."})


@app.route("/assets-file/<name>", methods=["GET"])
def serve_asset(name):
    folder = clip_effects.ASSETS_ROOT
    if AUTH_ENABLED:
        try:
            owner, token_name = _media_signer.loads(request.args.get("t", ""), max_age=MEDIA_URL_MAX_AGE)
        except (BadSignature, ValueError, TypeError):
            return jsonify({"error": "Link aset sudah kedaluwarsa. Muat ulang halaman."}), 404
        if token_name != name or (owner and not _is_safe_id(owner)):
            return jsonify({"error": "File not found"}), 404
        folder = os.path.join(folder, owner) if owner else folder
    return send_from_directory(folder, name)


@app.route("/sfx/<name>", methods=["GET"])
def serve_sfx(name):
    """Pustaka efek suara bawaan (publik, bebas lisensi)."""
    if name not in clip_effects.SFX_LIBRARY:
        return jsonify({"error": "File not found"}), 404
    return send_from_directory(clip_effects.SFX_DIR, name, max_age=7 * 24 * 3600)


def _editor_clip(user: User, video_id: str, key) -> tuple[str, dict]:
    if not _is_safe_id(video_id) or not isinstance(key, str) or not key:
        raise ApiError(400, "Klip tidak valid.")
    folder = _clips_dir(user, video_id)
    entry = _load_manifest(folder)["clips"].get(key)
    has_file = entry and any(entry.get(k) and os.path.isfile(os.path.join(folder, entry[k]))
                             for k in ("filename", "preview_filename"))
    if not has_file:
        raise ApiError(404, "Klip tidak ditemukan. Buat pratinjau momennya dulu.", "clip_not_found")
    return folder, entry


def _editor_source(user: User, video_id: str) -> tuple[str | None, str]:
    """
    Video sumber untuk render final: file upload milik pengguna. Admin juga boleh memakai
    hasil download YouTube (atau mengunduhnya dari link).
    """
    upload = _latest_upload(user, video_id)
    if upload:
        return _resolve_upload_path(user, upload["local_video_path"]), ""
    if not user.is_admin:
        return None, ""
    cached = find_cached_video(video_id)
    if cached:
        return cached, ""
    return None, _cached_youtube_url(video_id)


def _analysis_segment(video_id: str, entry: dict) -> dict:
    analysis = _get_cached_analysis(video_id) or {}
    return next((s for s in analysis.get("segments") or []
                 if s.get("start_time") == entry.get("start_time") and s.get("end_time") == entry.get("end_time")), None) or {}


def _clip_title(video_id: str, entry: dict) -> str:
    """Judul klip (juga nama file unduhan): judul yang diedit → saran analisis (short_title / topik dipendekkan)."""
    return (entry.get("title") or entry.get("short_title")
            or clip_effects.suggested_title({**entry, **_analysis_segment(video_id, entry)}))


def _hook_suggestions(video_id: str, entry: dict) -> list:
    """Ide teks hook dari hasil analisis momen ini (pertanyaan, pernyataan, teaser)."""
    hooks = _analysis_segment(video_id, entry).get("hooks") or {}
    ideas = [hooks.get(k) for k in ("hook_pertanyaan", "hook_pernyataan", "hook_teaser")]
    return [i.strip() for i in ideas if isinstance(i, str) and i.strip()][:3]


def _final_left(user: User) -> int | None:
    """Sisa jatah render final hari ini (termasuk yang masih antre); None = tanpa batas."""
    if user.is_admin:
        return None
    return max(0, RENDER_DAILY_LIMIT - accounts.usage_today("render", user_id=user.id)
               - len(jobs.active_keys(user.id, mode="final")))


@app.route("/videos/<video_id>/editor", methods=["GET"])
def editor_get(video_id):
    user = _user()
    folder, entry = _editor_clip(user, video_id, request.args.get("key"))
    base = _public_base()
    meta = (_get_cached_analysis(video_id) or {}).get("video_metadata") or {}
    moment = [render_pipeline._time_to_seconds(entry["start_time"]), render_pipeline._time_to_seconds(entry["end_time"])]
    clip_base = _entry_base(entry)
    final = entry.get("filename") and os.path.join(folder, entry["filename"])
    final = final if final and os.path.isfile(final) else None
    preview = entry.get("preview_filename") and os.path.join(folder, entry["preview_filename"])
    preview = preview if preview and os.path.isfile(preview) else None

    # Video yang diputar di editor: pratinjau bersih (caption & efek ditampilkan langsung di atasnya),
    # atau klip final untuk klip lama yang belum punya pratinjau
    playing_range = (entry.get("preview_range") if preview else entry.get("range")) or moment
    final_range = entry.get("range") or playing_range
    # Resep tersimpan (termasuk format lama) diseragamkan; tanpa resep = rentang pratinjau
    edit = clip_effects.sanitize_edit(entry.get("edit") or {}, playing_range[0], playing_range[1])
    baked = clip_effects.sanitize_edit(entry["edit"], final_range[0], final_range[1]) if final and entry.get("edit") else None
    options = entry.get("final_options") or entry.get("render_options") or {
        "resolution": entry.get("resolution"), "caption_enabled": entry.get("caption", True)}
    source_path, source_url = _editor_source(user, video_id)
    return jsonify({
        "clip": {
            **entry,
            "title": _clip_title(video_id, entry),
            "edit": baked,
            "status": "final" if final else "preview",
            "url": _clip_url(base, user, video_id, entry["filename"], int(os.path.getmtime(final))) if final else None,
            "preview_url": (_clip_url(base, user, video_id, entry["preview_filename"], int(os.path.getmtime(preview)))
                            if preview else None),
        },
        "title": meta.get("title", ""),
        "channel": meta.get("channel", ""),
        "moment": {"start": moment[0], "end": moment[1]},
        "rendered_range": playing_range,
        "clean_preview": bool(preview),
        "video_duration": meta.get("duration") or None,
        "edit": edit,
        "options": _sanitize_options(options),
        "transcript": render_pipeline.load_transcript(os.path.join(folder, clip_base + ".words.json")),
        "source_ready": bool(source_path or source_url),
        "final_left": _final_left(user),
        "hook_suggestions": _hook_suggestions(video_id, entry),
        "sfx_library": [{"name": n, "label": label, "url": f"{base}sfx/{n}"} for n, label in clip_effects.SFX_LIBRARY.items()],
        "assets": _list_assets(user, base),
        "templates": _load_templates(user),
    })


@app.route("/videos/<video_id>/editor", methods=["POST"])
def editor_render(video_id):
    """Render final satu klip dengan resep edit (caption, hook, efek). Hasilnya bisa diunduh."""
    user = _user()
    data = request.get_json(silent=True) or {}
    folder, entry = _editor_clip(user, video_id, data.get("key"))

    meta = (_get_cached_analysis(video_id) or {}).get("video_metadata") or {}
    current = (entry.get("range") or entry.get("preview_range")
               or [render_pipeline._time_to_seconds(entry["start_time"]), render_pipeline._time_to_seconds(entry["end_time"])])
    edit = clip_effects.sanitize_edit(data.get("edit"), current[0], current[1], meta.get("duration"))
    options = _sanitize_options(data.get("options"))

    if any(key == entry["key"] for _, key in jobs.active_keys(user.id, video_id)):
        raise ApiError(409, "Klip ini sedang dirender. Tunggu sampai selesai.", "busy")
    left = _final_left(user)
    if left is not None and left <= 0:
        raise ApiError(429, f"Jatah render final hari ini ({RENDER_DAILY_LIMIT} klip) sudah terpakai. Coba lagi besok.",
                       "render_quota")
    source_path, youtube_url = _editor_source(user, video_id)
    if not source_path and not youtube_url:
        raise ApiError(400, "Video sumber tidak ditemukan. Upload videonya lagi di halaman video.", "no_source")

    # Teks caption hasil edit menimpa transkrip tersimpan (rentangnya tetap)
    if data.get("transcript") is not None:
        transcript = clip_effects.sanitize_transcript(data.get("transcript"))
        if transcript is None:
            raise ApiError(400, "Teks caption tidak valid.")
        words_path = os.path.join(folder, _entry_base(entry) + ".words.json")
        stored = render_pipeline.load_transcript(words_path)
        if stored:
            render_pipeline.save_transcript(words_path, stored["range"][0], stored["range"][1], transcript)

    segment = {k: entry.get(k) for k in ("start_time", "end_time", "topic", "segment_number", "viral_score")}
    segment["segment_number"] = segment["segment_number"] or 1
    options.update({
        "video_id": video_id,
        "output_dir": folder,
        "assets_dir": _assets_dir(user),
        "edit": edit,
        "mode": "final",
    })
    job = jobs.create(user.id, video_id, meta.get("title", ""), [segment], mode="final")
    threading.Thread(
        target=_run_render_job,
        args=(job["id"], user, video_id, [segment], options, source_path, youtube_url, _public_base()),
        daemon=True,
    ).start()
    return jsonify({"job": job}), 202


@app.route("/videos/<video_id>/clip-title", methods=["POST"])
def clip_title_save(video_id):
    """Ubah judul klip (nama file unduhan) tanpa render ulang. Kosong = kembali ke judul saran."""
    user = _user()
    body = request.get_json(silent=True) or {}
    folder, entry = _editor_clip(user, video_id, body.get("key"))
    title = clip_effects.clean_title(body.get("title"))
    with _manifest_lock:
        manifest = _load_manifest(folder)
        entry = manifest["clips"][body["key"]]
        entry["title"] = title
        path = _manifest_path(folder)
        with open(path + ".tmp", "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        os.replace(path + ".tmp", path)
    return jsonify({"title": _clip_title(video_id, entry)})


@app.route("/clips/<video_id>/<filename>", methods=["GET"])
def serve_clip(video_id, filename):
    if not _is_safe_id(video_id):
        return jsonify({"error": "File not found"}), 404
    folder = os.path.join(CLIPS_ROOT, video_id)
    if AUTH_ENABLED:
        # Token di URL menentukan pemilik klip; dibuat oleh backend saat menampilkan daftar klip
        try:
            owner, token_video, token_file = _media_signer.loads(request.args.get("t", ""), max_age=MEDIA_URL_MAX_AGE)
        except (BadSignature, ValueError, TypeError):
            return jsonify({"error": "Link klip sudah kedaluwarsa. Muat ulang halaman."}), 404
        if token_video != video_id or token_file != filename or (owner and not _is_safe_id(owner)):
            return jsonify({"error": "File not found"}), 404
        folder = os.path.join(CLIPS_ROOT, owner, video_id) if owner else folder
    # send_from_directory menolak nama file yang keluar dari folder (mis. "../.env")
    # ?download=1 → paksa simpan file (atribut `download` diabaikan browser untuk URL beda origin),
    # dengan nama file dari judul klip (bukan "<id>_<awal>-<akhir>.mp4")
    if request.args.get("download") == "1":
        entry = next((e for e in _load_manifest(folder)["clips"].values()
                      if filename in (e.get("filename"), e.get("preview_filename"))), None)
        title = _clip_title(video_id, entry) if entry else ""
        return send_from_directory(folder, filename, as_attachment=True,
                                   download_name=clip_effects.download_filename(title, filename.removesuffix(".mp4")))
    return send_from_directory(folder, filename)

# ══════════════════════════════════════════════════════════════
# Startup
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "5000"))
    print("")
    print("  +==================================+")
    print("  |   SlimerClip Backend             |")
    print(f"  |   Berjalan di: {host}:{port}".ljust(37) + "|")
    print(f"  |   Login: {'Supabase' if AUTH_ENABLED else 'mode lokal (admin)'}".ljust(37) + "|")
    print("  +==================================+")
    print("")
    # Debug (Werkzeug debugger bisa menjalankan kode) hanya jika FLASK_DEBUG=1 di .env
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host=host, port=port, debug=debug, threaded=True)
