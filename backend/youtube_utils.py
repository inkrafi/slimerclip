import os
import re
from urllib.parse import urlparse

YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}

_VIDEO_ID_RE = re.compile(r"(?:v=|\/v\/|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([0-9A-Za-z_-]{11})")
_VIDEO_ID_FALLBACK_RE = re.compile(r"(?:v=|\/)([0-9A-Za-z_-]{11})")

# YouTube mewajibkan yt-dlp menyelesaikan tantangan JavaScript. Tanpa JS runtime, yt-dlp
# jatuh ke client cadangan yang link videonya sering ditolak (HTTP 403 Forbidden).
# Default: Deno lalu Node (yang mana pun yang terpasang). Bisa diubah lewat .env,
# mis. YTDLP_JS_RUNTIMES=node
YTDLP_JS_RUNTIMES = {
    name.strip(): {} for name in os.getenv("YTDLP_JS_RUNTIMES", "deno,node").split(",") if name.strip()
}


def is_youtube_url(url: str) -> bool:
    """Validasi host URL benar-benar YouTube (bukan sekadar mengandung teks 'youtube.com')."""
    if not isinstance(url, str):
        return False
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return False
    return parsed.scheme in ("http", "https") and (parsed.hostname or "").lower() in YOUTUBE_HOSTS


def extract_video_id(url: str) -> str | None:
    """Ekstrak ID video YouTube dari berbagai format URL (watch, youtu.be, embed, shorts, live)."""
    if not isinstance(url, str):
        return None
    match = _VIDEO_ID_RE.search(url) or _VIDEO_ID_FALLBACK_RE.search(url)
    return match.group(1) if match else None
