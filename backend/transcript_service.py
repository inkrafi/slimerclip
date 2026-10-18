"""
Ambil transkrip video YouTube dengan beberapa jalur cadangan, karena YouTube sering
memblokir IP yang terlalu banyak meminta transkrip (RequestBlocked / IpBlocked).

Urutan:
1. Cache lokal (cache/transcripts/<id>.json) — tidak ada request ke YouTube sama sekali
2. youtube-transcript-api (bisa lewat proxy: TRANSCRIPT_PROXY di .env)
3. Subtitle/auto-caption lewat yt-dlp (jalur & header berbeda dari no. 2)
4. Whisper lokal dari file video (file upload pengguna; admin boleh mengunduh dari YouTube dulu)
"""
import json
import os
import re
import threading

import yt_dlp
from requests import Session
from youtube_transcript_api import NoTranscriptFound, YouTubeTranscriptApi

from youtube_utils import YTDLP_JS_RUNTIMES

TRANSCRIPT_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache", "transcripts")
os.makedirs(TRANSCRIPT_CACHE_DIR, exist_ok=True)

PREFERRED_LANGS = ('id', 'en')
WHISPER_FALLBACK = os.getenv("TRANSCRIPT_WHISPER_FALLBACK", "1") == "1"

_cache_lock = threading.Lock()


class TranscriptUnavailable(Exception):
    """Semua jalur gagal. Pesan sudah ramah pengguna."""


# ── Cache ─────────────────────────────────────────────────────

def _cache_path(video_id: str) -> str:
    return os.path.join(TRANSCRIPT_CACHE_DIR, f"{video_id}.json")


def _load_cached(video_id: str) -> list | None:
    try:
        with open(_cache_path(video_id), encoding="utf-8") as f:
            data = json.load(f)
        lines = [(float(s), float(e), str(t)) for s, e, t in data.get("lines", [])]
        return lines or None
    except (OSError, ValueError, TypeError):
        return None


def _save_cached(video_id: str, lines: list, source: str):
    tmp = _cache_path(video_id) + ".tmp"
    with _cache_lock:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"source": source, "lines": lines}, f, ensure_ascii=False)
        os.replace(tmp, _cache_path(video_id))


# ── 1. youtube-transcript-api ────────────────────────────────

def _transcript_api(video_id: str) -> list:
    session = Session()
    # Verifikasi SSL tetap aktif. Hanya jika muncul SSLError (mis. antivirus/proxy yang
    # mengintersep HTTPS), bisa dimatikan sementara dengan TRANSCRIPT_INSECURE_SSL=1 di .env.
    if os.getenv("TRANSCRIPT_INSECURE_SSL", "0") == "1":
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        session.verify = False
        print("[Transcript] PERINGATAN: verifikasi SSL dimatikan (TRANSCRIPT_INSECURE_SSL=1)")

    proxy_config = None
    proxy = os.getenv("TRANSCRIPT_PROXY", "").strip()
    if proxy:
        from youtube_transcript_api.proxies import GenericProxyConfig
        proxy_config = GenericProxyConfig(http_url=proxy, https_url=proxy)

    transcript_list = YouTubeTranscriptApi(proxy_config=proxy_config, http_client=session).list(video_id)

    def pick():
        try:
            return transcript_list.find_transcript(list(PREFERRED_LANGS)).fetch()
        except NoTranscriptFound:
            pass
        for t in transcript_list:
            if t.is_translatable:
                for lang in PREFERRED_LANGS:
                    try:
                        return t.translate(lang).fetch()
                    except Exception:
                        continue
        for t in transcript_list:
            return t.fetch()
        raise NoTranscriptFound(video_id, list(PREFERRED_LANGS), transcript_list)

    lines = []
    for item in pick():
        start, text = getattr(item, 'start', None), getattr(item, 'text', None)
        if start is None or not text:
            continue
        lines.append((float(start), float(start + (getattr(item, 'duration', 0) or 0)), text.replace("\n", " ")))
    return lines


# ── 2. Subtitle lewat yt-dlp ─────────────────────────────────

def _pick_caption_track(info: dict) -> tuple[str, str] | None:
    """Pilih URL json3: subtitle manual id/en → auto-caption bahasa asli → auto id/en → manual apa pun."""
    manual = info.get("subtitles") or {}
    auto = info.get("automatic_captions") or {}

    def json3(tracks):
        for t in tracks or []:
            if t.get("ext") == "json3" and t.get("url"):
                return t["url"]
        return None

    # Video dengan audio sulih-suara otomatis punya beberapa "-orig"; yang benar = bahasa asli video
    video_lang = (info.get("language") or "").split("-")[0]
    orig = sorted((lang for lang in auto if lang.endswith("-orig")),
                  key=lambda lang: (lang.split("-")[0] != video_lang, lang.split("-")[0] not in PREFERRED_LANGS))

    candidates = [(manual, lang) for lang in PREFERRED_LANGS]
    candidates += [(auto, lang) for lang in orig]
    candidates += [(auto, lang) for lang in PREFERRED_LANGS]
    candidates += [(manual, lang) for lang in manual if lang != "live_chat"]
    for source, lang in candidates:
        url = json3(source.get(lang))
        if url:
            return lang, url
    return None


def _ytdlp_captions(youtube_url: str, info: dict | None) -> list:
    opts = {'quiet': True, 'no_warnings': True, 'noplaylist': True, 'skip_download': True,
            'socket_timeout': 15, 'js_runtimes': YTDLP_JS_RUNTIMES}
    with yt_dlp.YoutubeDL(opts) as ydl:
        if info is None:
            info = ydl.extract_info(youtube_url, download=False) or {}
        track = _pick_caption_track(info)
        if not track:
            raise TranscriptUnavailable("Video ini tidak punya subtitle.")
        lang, url = track
        print(f"[Transcript] Mengambil subtitle '{lang}' lewat yt-dlp")
        data = json.loads(ydl.urlopen(url).read().decode("utf-8"))

    lines = []
    for ev in data.get("events", []):
        text = "".join(s.get("utf8", "") for s in ev.get("segs") or []).replace("\n", " ").strip()
        if not text or "tStartMs" not in ev:
            continue
        start = ev["tStartMs"] / 1000
        lines.append((start, start + (ev.get("dDurationMs") or 0) / 1000, re.sub(r"\s+", " ", text)))
    return lines


# ── 3. Whisper lokal ─────────────────────────────────────────

def _whisper(youtube_url: str, video_id: str, media_path: str | None, allow_download: bool) -> list:
    from caption_service import get_caption_service
    from download_service import download_video, find_cached_video

    path = media_path or (find_cached_video(video_id) if allow_download else None)
    if not path:
        if not allow_download:
            raise TranscriptUnavailable("Tidak ada file video untuk ditranskrip.")
        print("[Transcript] Download video untuk ditranskrip Whisper (sekalian dipakai saat render)")
        path = download_video(youtube_url, video_id=video_id)
    print(f"[Transcript] Transkripsi Whisper lokal: {os.path.basename(path)} (video panjang bisa makan waktu beberapa menit)")
    return [(s['start'], s['end'], s['text'].strip()) for s in get_caption_service().transcribe_plain(path) if s['text'].strip()]


# ── Jalur utama ──────────────────────────────────────────────

def get_transcript_lines(video_id: str, youtube_url: str, info: dict | None = None,
                         media_path: str | None = None, allow_download: bool = False) -> tuple[list, str]:
    """
    Return ([(start_detik, end_detik, teks), ...] urut waktu, sumber).

    Whisper dipakai jika ada media_path (file upload pengguna), atau allow_download (admin)
    untuk mengunduh video dari YouTube lebih dulu.
    """
    cached = _load_cached(video_id)
    if cached:
        return cached, "cache"

    attempts = [("youtube-transcript-api", lambda: _transcript_api(video_id)),
                ("yt-dlp", lambda: _ytdlp_captions(youtube_url, info))]
    whisper_possible = WHISPER_FALLBACK and (media_path or allow_download)
    if whisper_possible:
        attempts.append(("whisper", lambda: _whisper(youtube_url, video_id, media_path, allow_download)))

    errors = []
    for source, fetch in attempts:
        try:
            lines = sorted(fetch(), key=lambda l: l[0])
        except Exception as e:
            first_line = str(e).strip().splitlines()[0] if str(e).strip() else type(e).__name__
            print(f"[Transcript] {source} gagal: {type(e).__name__}: {first_line[:200]}")
            errors.append((source, e))
            continue
        if lines:
            _save_cached(video_id, lines, source)
            print(f"[Transcript] Berhasil lewat {source} ({len(lines)} baris)")
            return lines, source
        errors.append((source, TranscriptUnavailable("transkrip kosong")))

    blocked = any(type(e).__name__ in ("RequestBlocked", "IpBlocked") or "429" in str(e) for _, e in errors)
    if whisper_possible:
        raise TranscriptUnavailable(
            "Transkrip tidak bisa didapat dari YouTube, dan transkripsi dari file video juga gagal. "
            "Pastikan file videonya bisa diputar, lalu coba lagi."
        )
    if blocked:
        raise TranscriptUnavailable(
            "YouTube sedang membatasi permintaan transkrip dari server. "
            "Upload file videonya agar transkrip dibuat langsung dari file."
        )
    raise TranscriptUnavailable(
        "Video ini tidak punya subtitle. Upload file videonya agar transkrip dibuat langsung dari file."
    )
