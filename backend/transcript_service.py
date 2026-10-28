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


def _cached_language(video_id: str) -> str | None:
    try:
        with open(_cache_path(video_id), encoding="utf-8") as f:
            return json.load(f).get("lang")
    except (OSError, ValueError, AttributeError):
        return None


def _base_lang(code) -> str:
    return str(code or "").lower().split("-")[0]


def _save_cached(video_id: str, lines: list, source: str, lang: str | None = None):
    tmp = _cache_path(video_id) + ".tmp"
    with _cache_lock:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"source": source, "lang": lang, "lines": lines}, f, ensure_ascii=False)
        os.replace(tmp, _cache_path(video_id))


# ── 1. youtube-transcript-api ────────────────────────────────

def _transcript_api(video_id: str, language: str | None = None) -> tuple[list, str | None]:
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

    # Bahasa pilihan (profil) atau id/en → caption otomatis (= bahasa asli audio) → apa pun.
    # Tidak memakai terjemahan otomatis YouTube: kutipan verbatim dan timing-nya jadi tidak akurat.
    wanted = [language] if language else list(PREFERRED_LANGS)

    def pick():
        try:
            t = transcript_list.find_transcript(wanted)
            return t.fetch(), t.language_code
        except NoTranscriptFound:
            pass
        for t in sorted(transcript_list, key=lambda t: not t.is_generated):
            return t.fetch(), t.language_code
        raise NoTranscriptFound(video_id, wanted, transcript_list)

    fetched, lang = pick()
    lines = []
    for item in fetched:
        start, text = getattr(item, 'start', None), getattr(item, 'text', None)
        if start is None or not text:
            continue
        lines.append((float(start), float(start + (getattr(item, 'duration', 0) or 0)), text.replace("\n", " ")))
    return lines, lang


# ── 2. Subtitle lewat yt-dlp ─────────────────────────────────

def _pick_caption_track(info: dict, language: str | None = None) -> tuple[str, str] | None:
    """
    Pilih URL json3: bahasa pilihan (profil) dulu, lalu subtitle manual id/en → auto-caption bahasa asli
    → auto id/en → manual apa pun.
    """
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

    candidates = []
    if language:
        candidates += [(manual, language), (auto, f"{language}-orig"), (auto, language)]
    candidates += [(manual, lang) for lang in PREFERRED_LANGS]
    candidates += [(auto, lang) for lang in orig]
    candidates += [(auto, lang) for lang in PREFERRED_LANGS]
    candidates += [(manual, lang) for lang in manual if lang != "live_chat"]
    for source, lang in candidates:
        url = json3(source.get(lang))
        if url:
            return lang, url
    return None


def _ytdlp_captions(youtube_url: str, info: dict | None, language: str | None = None) -> tuple[list, str]:
    opts = {'quiet': True, 'no_warnings': True, 'noplaylist': True, 'skip_download': True,
            'socket_timeout': 15, 'js_runtimes': YTDLP_JS_RUNTIMES}
    with yt_dlp.YoutubeDL(opts) as ydl:
        if info is None:
            info = ydl.extract_info(youtube_url, download=False) or {}
        track = _pick_caption_track(info, language)
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
    return lines, _base_lang(lang)


# ── 3. Whisper lokal ─────────────────────────────────────────

def _whisper(youtube_url: str, video_id: str, media_path: str | None, allow_download: bool,
             language: str | None = None) -> tuple[list, str | None]:
    from caption_service import get_caption_service
    from download_service import download_video, find_cached_video

    path = media_path or (find_cached_video(video_id) if allow_download else None)
    if not path:
        if not allow_download:
            raise TranscriptUnavailable("Tidak ada file video untuk ditranskrip.")
        print("[Transcript] Download video untuk ditranskrip Whisper (sekalian dipakai saat render)")
        path = download_video(youtube_url, video_id=video_id)
    print(f"[Transcript] Transkripsi Whisper lokal: {os.path.basename(path)} (video panjang bisa makan waktu beberapa menit)")
    segments, lang = get_caption_service().transcribe_plain(path, language)
    return [(s['start'], s['end'], s['text'].strip()) for s in segments if s['text'].strip()], lang


# ── Jalur utama ──────────────────────────────────────────────

def get_transcript_lines(video_id: str, youtube_url: str, info: dict | None = None,
                         media_path: str | None = None, allow_download: bool = False,
                         language: str | None = None) -> tuple[list, str]:
    """
    Return ([(start_detik, end_detik, teks), ...] urut waktu, sumber).

    Whisper dipakai jika ada media_path (file upload pengguna), atau allow_download (admin)
    untuk mengunduh video dari YouTube lebih dulu.
    """
    cached = _load_cached(video_id)
    cached_lang = _cached_language(video_id)
    # Bahasa dipilih admin tapi transkrip tersimpan berbahasa lain → ambil ulang
    if cached and not (language and cached_lang and _base_lang(cached_lang) != language):
        return cached, "cache"

    attempts = [("youtube-transcript-api", lambda: _transcript_api(video_id, language)),
                ("yt-dlp", lambda: _ytdlp_captions(youtube_url, info, language))]
    whisper_possible = WHISPER_FALLBACK and (media_path or allow_download)
    if whisper_possible:
        attempts.append(("whisper", lambda: _whisper(youtube_url, video_id, media_path, allow_download, language)))

    errors = []
    for source, fetch in attempts:
        try:
            fetched, lang = fetch()
            lines = sorted(fetched, key=lambda l: l[0])
        except Exception as e:
            first_line = str(e).strip().splitlines()[0] if str(e).strip() else type(e).__name__
            print(f"[Transcript] {source} gagal: {type(e).__name__}: {first_line[:200]}")
            errors.append((source, e))
            continue
        if lines:
            _save_cached(video_id, lines, source, _base_lang(lang) or None)
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
