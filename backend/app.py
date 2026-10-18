import os
import json
import shutil
import re
import time
import threading
# pyrefly: ignore [missing-import]
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
load_dotenv()  # sebelum membaca CORS_ORIGINS / FLASK_DEBUG
from gemini_service import analyze_youtube_video
from download_service import download_video
from render_pipeline import RenderPipeline
from jobs import JobManager
from youtube_utils import extract_video_id as _extract_video_id, is_youtube_url as _is_youtube_url

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024 * 1024  # Maks 10GB upload (file video besar)
render_pipeline = RenderPipeline()
# Render memakai CPU penuh (FFmpeg + Whisper) dan menulis ke folder clips/<video_id>/,
# jadi batch dari beberapa request dijalankan bergantian, bukan bersamaan.
_render_lock = threading.Lock()
jobs = JobManager()

# Set up FFmpeg path for Windows (dynamically add bin/ffmpeg/bin to PATH)
FFMPEG_BIN_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin", "ffmpeg", "bin")
if os.path.exists(FFMPEG_BIN_DIR) and FFMPEG_BIN_DIR not in os.environ.get("PATH", ""):
    os.environ["PATH"] = FFMPEG_BIN_DIR + os.pathsep + os.environ.get("PATH", "")

# ──────────────────────────────────────────────────────────────
# Cache: simpan hasil analisis Gemini ke file JSON agar tidak
# perlu analisa ulang jika video yang sama diinput kembali.
# ──────────────────────────────────────────────────────────────
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
os.makedirs(CACHE_DIR, exist_ok=True)
ANALYSIS_CACHE_FILE = os.path.join(CACHE_DIR, "analysis_cache.json")
_cache_lock = threading.Lock()

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.mkv', '.mov', '.avi', '.webm', '.m4v', '.flv'}
CLIPS_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "clips")

# ──────────────────────────────────────────────────────────────
# Keamanan: backend ini hanya untuk dipakai lokal oleh frontend.
# ──────────────────────────────────────────────────────────────
# Origin frontend yang boleh memanggil API (pisahkan dengan koma di .env)
ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",") if o.strip()]
# Host yang boleh dipakai untuk mengakses backend (mencegah DNS rebinding)
ALLOWED_HOSTS = {"localhost", "127.0.0.1", "[::1]"}

SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
ALLOWED_RESOLUTIONS = {"720", "1080"}
HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
FONT_RE = re.compile(r"^[A-Za-z0-9 _-]{1,64}$")
TIME_RE = re.compile(r"^\d{1,3}:\d{2}(:\d{2})?(\.\d+)?$")


def _is_safe_id(value) -> bool:
    """ID dipakai sebagai nama folder — hanya huruf, angka, '_' dan '-' (tanpa '..', '/', '\\')."""
    return isinstance(value, str) and bool(SAFE_ID_RE.match(value))


def _resolve_upload_path(ref: str) -> str | None:
    """
    Ubah referensi upload ("<video_id>/<filename>") menjadi path absolut di dalam
    folder downloads/. Return None jika path keluar dari folder tersebut.
    """
    if not isinstance(ref, str) or not ref:
        return None
    base = os.path.realpath(UPLOADS_DIR)
    path = os.path.realpath(os.path.join(base, ref))
    if os.path.commonpath([base, path]) != base or not os.path.isfile(path):
        return None
    return path


def _sanitize_options(options) -> dict:
    """Ambil hanya opsi render yang dikenal dan pastikan nilainya aman."""
    options = options if isinstance(options, dict) else {}
    style_in = options.get("caption_style") if isinstance(options.get("caption_style"), dict) else {}

    def num(value, default, lo, hi):
        try:
            return max(lo, min(hi, int(value)))
        except (TypeError, ValueError):
            return default

    style = {
        "size": num(style_in.get("size"), 72, 10, 200),
        "outline_width": num(style_in.get("outline_width"), 4, 0, 20),
        "position": style_in.get("position") if style_in.get("position") in ("top", "center", "bottom") else "bottom",
        "highlight_mode": style_in.get("highlight_mode") if style_in.get("highlight_mode") in ("none", "word", "line") else "word",
    }
    if isinstance(style_in.get("font"), str) and FONT_RE.match(style_in["font"]):
        style["font"] = style_in["font"]
    for key in ("color", "outline_color", "highlight_color"):
        if isinstance(style_in.get(key), str) and HEX_COLOR_RE.match(style_in[key]):
            style[key] = style_in[key]

    resolution = str(options.get("resolution", "1080"))
    return {
        "resolution": resolution if resolution in ALLOWED_RESOLUTIONS else "1080",
        "caption_enabled": bool(options.get("caption_enabled", True)),
        "smart_tracking": bool(options.get("smart_tracking", True)),
        "split_screen": bool(options.get("split_screen", True)),
        "caption_style": style,
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
# (clips/<video_id>/manifest.json), agar hasil render tidak hilang
# dan tidak perlu dirender ulang.
# ──────────────────────────────────────────────────────────────
_manifest_lock = threading.Lock()


def _manifest_path(video_id: str) -> str:
    return os.path.join(CLIPS_ROOT, video_id, "manifest.json")


def _load_manifest(video_id: str) -> dict:
    try:
        with open(_manifest_path(video_id), "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data.get("clips"), dict) else {"clips": {}}
    except (OSError, ValueError):
        return {"clips": {}}


def _record_clip(video_id: str, segment: dict, output_path: str, options: dict):
    """Catat klip yang selesai dirender ke manifest video (key = rentang waktu)."""
    key = f"{segment.get('start_time')}-{segment.get('end_time')}"
    with _manifest_lock:
        manifest = _load_manifest(video_id)
        manifest["clips"][key] = {
            "key": key,
            "start_time": segment.get("start_time"),
            "end_time": segment.get("end_time"),
            "topic": segment.get("topic", ""),
            "segment_number": segment.get("segment_number"),
            "viral_score": segment.get("viral_score"),
            "filename": os.path.basename(output_path),
            "rendered_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "resolution": options.get("resolution"),
            "caption": options.get("caption_enabled"),
            "layout": options.get("layout_summary"),
        }
        path = _manifest_path(video_id)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)


def _clip_duration(path: str) -> float | None:
    """Durasi video (detik) dari header file, tanpa men-decode."""
    try:
        import cv2
        cap = cv2.VideoCapture(path, cv2.CAP_FFMPEG)
        fps = cap.get(cv2.CAP_PROP_FPS) or 0
        frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
        cap.release()
        return round(frames / fps, 1) if fps > 0 and frames > 0 else None
    except Exception:
        return None


def _list_clips(video_id: str, host_url: str) -> list:
    """
    Daftar klip yang sudah dirender (file masih ada), terbaru dulu, lengkap dengan URL.
    Klip lama yang dibuat sebelum ada manifest tetap ikut ditampilkan sebagai "klip lama".
    """
    folder = os.path.join(CLIPS_ROOT, video_id)
    clips = []
    recorded = set()
    for entry in _load_manifest(video_id)["clips"].values():
        path = os.path.join(folder, entry.get("filename", ""))
        if not entry.get("filename") or not os.path.isfile(path):
            continue
        recorded.add(entry["filename"])
        clips.append({
            **entry,
            "legacy": False,
            "url": f"{host_url}clips/{video_id}/{entry['filename']}?v={int(os.path.getmtime(path))}",
            "file_size_mb": round(os.path.getsize(path) / (1024 * 1024), 1),
        })

    if os.path.isdir(folder):
        for name in os.listdir(folder):
            path = os.path.join(folder, name)
            # Lewati file yang sudah tercatat dan sisa render yang setengah jadi
            if (not name.lower().endswith(".mp4") or name in recorded or name.startswith("temp_")
                    or name.endswith(".rendering.mp4") or not os.path.isfile(path)):
                continue
            duration = _clip_duration(path)
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
                "url": f"{host_url}clips/{video_id}/{name}?v={int(mtime)}",
                "file_size_mb": round(os.path.getsize(path) / (1024 * 1024), 1),
            })

    clips.sort(key=lambda c: c.get("rendered_at") or "", reverse=True)
    return clips


def _latest_upload(video_id: str) -> dict | None:
    """File video yang pernah diupload untuk video ini (terbaru), agar tidak perlu upload ulang."""
    folder = os.path.join(UPLOADS_DIR, video_id)
    if not os.path.isdir(folder):
        return None
    files = [
        f for f in os.listdir(folder)
        if os.path.splitext(f)[1].lower() in ALLOWED_VIDEO_EXTENSIONS and os.path.isfile(os.path.join(folder, f))
    ]
    if not files:
        return None
    newest = max(files, key=lambda f: os.path.getmtime(os.path.join(folder, f)))
    return {
        "video_id": video_id,
        "filename": newest,
        "local_video_path": f"{video_id}/{newest}",
        "file_size_mb": round(os.path.getsize(os.path.join(folder, newest)) / (1024 * 1024), 1),
    }


# Analisis yang sedang berjalan per video: request kedua (mis. halaman di-refresh)
# menunggu hasil yang sama alih-alih memanggil Gemini lagi.
_analysis_inflight: dict[str, threading.Event] = {}
_analysis_inflight_lock = threading.Lock()


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
def _enforce_local_access():
    """
    Tolak request yang bukan dari frontend sendiri:
    - Host selain localhost → mencegah DNS rebinding dari website lain.
    - Origin asing → mencegah website lain mengirim request (mis. form upload
      multipart, yang tidak melewati preflight CORS) ke backend lokal ini.
    """
    host = (request.host or "").rsplit(":", 1)[0].lower()
    if host not in ALLOWED_HOSTS:
        abort(403)
    origin = request.headers.get("Origin")
    if origin and origin not in ALLOWED_ORIGINS:
        abort(403)

# ══════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════

@app.route("/")
def health_check():
    return jsonify({"status": "ok", "service": "SlimerClip Backend"})


@app.route("/videos", methods=["GET"])
def videos_list():
    """Riwayat: semua video yang sudah dianalisis, terbaru dulu."""
    with _cache_lock:
        cache = _load_cache()
    items = []
    for vid_id, entry in cache.items():
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
            "clip_count": len(_list_clips(vid_id, request.host_url)) if _is_safe_id(vid_id) else 0,
        })
    items.sort(key=lambda x: x["analyzed_at"] or "", reverse=True)
    return jsonify({"items": items})


@app.route("/videos/<video_id>", methods=["GET"])
def video_detail(video_id):
    """Halaman video: hasil analisis, klip yang sudah dirender, dan file upload yang tersedia."""
    if not _is_safe_id(video_id):
        return jsonify({"error": "video_id tidak valid."}), 400
    analysis = _get_cached_analysis(video_id)
    return jsonify({
        "video_id": video_id,
        "analysis": analysis,
        "analyzing": video_id in _analysis_inflight,
        "clips": _list_clips(video_id, request.host_url),
        "upload": _latest_upload(video_id),
    })


@app.route("/videos/<video_id>/clips", methods=["GET"])
def video_clips(video_id):
    if not _is_safe_id(video_id):
        return jsonify({"error": "video_id tidak valid."}), 400
    return jsonify({"clips": _list_clips(video_id, request.host_url)})


@app.route("/videos/<video_id>", methods=["DELETE"])
def video_delete(video_id):
    """Hapus analisis video beserta klip hasil render (video sumber di downloads/ tetap disimpan)."""
    if not _is_safe_id(video_id):
        return jsonify({"error": "video_id tidak valid."}), 400
    with _cache_lock:
        cache = _load_cache()
        cache.pop(video_id, None)
        _save_cache(cache)
    clip_dir = os.path.join(CLIPS_ROOT, video_id)
    if os.path.isdir(clip_dir):
        shutil.rmtree(clip_dir, ignore_errors=True)
    return jsonify({"message": "Video dihapus dari riwayat."})


@app.route("/cache", methods=["GET"])
def cache_list():
    """Tampilkan daftar semua video yang sudah di-cache."""
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
    """Hapus cache untuk video_id tertentu."""
    with _cache_lock:
        cache = _load_cache()
        if video_id not in cache:
            return jsonify({"error": f"Video {video_id} tidak ada di cache."}), 404
        del cache[video_id]
        _save_cache(cache)
    return jsonify({"message": f"Cache video {video_id} berhasil dihapus."})


@app.route("/cache", methods=["DELETE"])
def cache_clear_all():
    """Hapus seluruh cache analisis."""
    with _cache_lock:
        _save_cache({})
    return jsonify({"message": "Seluruh cache berhasil dihapus."})


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Analisis video YouTube via Gemini AI.
    
    Response: JSON hasil analisis.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body kosong."}), 400

    youtube_url = data.get("youtube_url", "")
    youtube_url = youtube_url.strip() if isinstance(youtube_url, str) else ""
    if not youtube_url:
        return jsonify({"error": "youtube_url tidak boleh kosong."}), 400
    if not _is_youtube_url(youtube_url):
        return jsonify({"error": "URL tidak valid. Masukkan link YouTube yang benar."}), 400

    # ── Cek Cache dulu ──
    video_id = _extract_video_id(youtube_url)
    force_refresh = data.get("force_refresh", False)

    if video_id and not force_refresh:
        cached = _get_cached_analysis(video_id)
        if cached:
            result = dict(cached)  # Salin agar aman
            result["from_cache"] = True
            return jsonify(result), 200

    # ── Analisa baru via Gemini (satu analisis per video dalam satu waktu) ──
    with _analysis_inflight_lock:
        running = _analysis_inflight.get(video_id) if video_id else None
        if running is None and video_id:
            _analysis_inflight[video_id] = threading.Event()
    if running is not None:
        running.wait(timeout=600)
        cached = _get_cached_analysis(video_id)
        if cached:
            return jsonify({**cached, "from_cache": True}), 200
        return jsonify({"error": "Analisis sebelumnya untuk video ini gagal. Coba lagi."}), 422

    try:
        result = analyze_youtube_video(youtube_url)
        if "error" in result:
            return jsonify(result), 422
        return _finish_analysis(video_id, youtube_url, result)
    finally:
        if video_id:
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

@app.route("/upload-video", methods=["POST"])
def upload_video():
    """
    Upload file video lokal dari komputer user.
    Form field: 'video' (file), 'video_id' (string, ID unik untuk sesi analisis)
    """
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
    
    # Simpan file ke folder downloads/<video_id>/
    video_upload_dir = os.path.join(UPLOADS_DIR, video_id)
    os.makedirs(video_upload_dir, exist_ok=True)
    
    safe_filename = secure_filename(file.filename)
    # secure_filename bisa membuang seluruh nama (mis. nama non-ASCII) → pastikan tetap ada nama + ekstensi
    if not safe_filename.lower().endswith(ext):
        safe_filename = f"{os.path.splitext(safe_filename)[0] or 'video'}{ext}"
    save_path = os.path.join(video_upload_dir, safe_filename)
    
    print(f"[Upload] Menyimpan file: {safe_filename} -> {save_path}")
    file.save(save_path)
    
    file_size_mb = os.path.getsize(save_path) / (1024 * 1024)
    print(f"[Upload] Berhasil: {safe_filename} ({file_size_mb:.1f} MB)")
    
    return jsonify({
        "success": True,
        "video_id": video_id,
        "filename": safe_filename,
        # Referensi relatif terhadap folder downloads/ — backend yang menerjemahkan ke path asli
        "local_video_path": f"{video_id}/{safe_filename}",
        "file_size_mb": round(file_size_mb, 1)
    }), 200


@app.route("/generate", methods=["POST"])
def generate_clips():
    """Mulai render batch di belakang layar. Hasil: job yang statusnya bisa dipantau lewat /jobs."""
    data = request.get_json()
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

    # File lokal hanya boleh dari folder downloads/ (hasil /upload-video)
    local_video_path = None
    if upload_ref:
        local_video_path = _resolve_upload_path(upload_ref)
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

    # Momen yang sedang antre/dirender untuk video ini tidak diantrekan lagi
    busy = jobs.active_keys(video_id)
    segments = [seg for seg in segments if f"{seg['start_time']}-{seg['end_time']}" not in busy]
    if not segments:
        return jsonify({"error": "Momen yang dipilih sedang dirender. Tunggu sampai selesai."}), 409

    cached = _get_cached_analysis(video_id) or {}
    title = (cached.get("video_metadata") or {}).get("title", "")
    job = jobs.create(video_id, title, segments)
    request_host = request.host_url  # mis. "http://127.0.0.1:5000/" — dibaca sebelum masuk thread

    threading.Thread(
        target=_run_render_job,
        args=(job["id"], video_id, segments, options, local_video_path, youtube_url, request_host),
        daemon=True,
    ).start()
    return jsonify({"job": job}), 202


def _run_render_job(job_id, video_id, segments, options, local_video_path, youtube_url, request_host):
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
                url = f"{request_host}clips/{video_id}/{filename}?v={int(time.time())}"
                try:
                    _record_clip(video_id, seg, result["output_path"], {**options, "layout_summary": result.get("layout")})
                except OSError as e:
                    print(f"[Manifest] Gagal mencatat klip: {e}")
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
    """Job render aktif & yang baru selesai. Filter opsional: ?video_id=..."""
    video_id = request.args.get("video_id")
    if video_id is not None and not _is_safe_id(video_id):
        return jsonify({"error": "video_id tidak valid."}), 400
    return jsonify({"jobs": jobs.list(video_id)})


@app.route("/jobs/<job_id>", methods=["GET"])
def job_detail(job_id):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job tidak ditemukan (mungkin backend sempat di-restart)."}), 404
    return jsonify({"job": job})


@app.route("/clips/<video_id>/<filename>", methods=["GET"])
def serve_clip(video_id, filename):
    if not _is_safe_id(video_id):
        return jsonify({"error": "File not found"}), 404
    # send_from_directory menolak nama file yang keluar dari folder (mis. "../.env")
    # ?download=1 → paksa simpan file (atribut `download` diabaikan browser untuk URL beda origin)
    return send_from_directory(os.path.join(CLIPS_ROOT, video_id), filename,
                               as_attachment=request.args.get("download") == "1")


@app.route("/uploads/<video_id>/<filename>", methods=["GET"])
def check_upload(video_id, filename):
    """Cek apakah file upload sudah tersedia."""
    if not _is_safe_id(video_id):
        return jsonify({"exists": False}), 404
    upload_path = os.path.join(UPLOADS_DIR, video_id, secure_filename(filename))
    if os.path.exists(upload_path):
        file_size_mb = os.path.getsize(upload_path) / (1024 * 1024)
        return jsonify({"exists": True, "file_size_mb": round(file_size_mb, 1)})
    return jsonify({"exists": False}), 404

# ══════════════════════════════════════════════════════════════
# Startup
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("")
    print("  +==================================+")
    print("  |   SlimerClip Backend             |")
    print("  |   Berjalan di: localhost:5000    |")
    print("  +==================================+")
    print("")
    # Debug (Werkzeug debugger bisa menjalankan kode) hanya jika FLASK_DEBUG=1 di .env
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host="127.0.0.1", port=5000, debug=debug, threaded=True)
