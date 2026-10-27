"""
Kit upload YouTube Shorts per klip: 3 opsi judul, deskripsi singkat, dan 2-3 hashtag, siap disalin ke
YouTube Studio. Analisis baru membawa title_options / upload_description / hashtags dari Gemini;
analisis lama dirakit dari field yang sudah ada (judul, ide hook, topik, kutipan, caption).
"""

import re

TITLE_MAX = 100        # batas judul YouTube
TITLE_OPTIONS = 3
DESCRIPTION_MAX = 300
HASHTAG_MAX = 3

# Hashtag cadangan per sudut konten untuk analisis lama tanpa hashtag
ANGLE_HASHTAGS = {
    "EDUKASI": ["#edukasi", "#belajar"],
    "HIBURAN": ["#podcast", "#lucu"],
    "INSPIRASI": ["#inspirasi", "#motivasi"],
    "KONTROVERSI": ["#podcast", "#opini"],
    "TUTORIAL": ["#tutorial", "#tips"],
}

_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️‍]")


def _clean(value, limit: int) -> str:
    text = _EMOJI.sub("", str(value or "")).replace("*", "")
    text = re.sub(r"#\w+", "", text)
    text = re.sub(r"[\x00-\x1f]", " ", text).strip().strip("\"'“”")
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0].rstrip(" ,.;:")
    return text


def clean_hashtag(value) -> str:
    tag = re.sub(r"[^\w]", "", str(value or "").lstrip("#"))
    return f"#{tag.lower()}" if tag else ""


def _unique(items: list, key=str.lower) -> list:
    seen, out = set(), []
    for item in items:
        if item and key(item) not in seen:
            seen.add(key(item))
            out.append(item)
    return out


def titles(segment: dict, current: str, hooks: list) -> list:
    """Opsi judul: judul klip saat ini, opsi dari analisis (title_options), lalu ide hook sebagai judul."""
    options = segment.get("title_options") if isinstance(segment.get("title_options"), list) else []
    picks = [_clean(t, TITLE_MAX) for t in [current, *options, segment.get("short_title"), *hooks]]
    return _unique(picks)[:TITLE_OPTIONS]


def hashtags(segment: dict) -> list:
    """Hashtag: dari analisis (hashtags), hashtag di caption_suggestion, atau cadangan per sudut konten."""
    raw = segment.get("hashtags") if isinstance(segment.get("hashtags"), list) else []
    raw = [*raw, *re.findall(r"#\w+", str(segment.get("caption_suggestion") or ""))]
    tags = _unique([clean_hashtag(t) for t in raw])
    if len(tags) < 2:
        tags = _unique([*tags, *ANGLE_HASHTAGS.get(str(segment.get("content_angle") or "").upper(), []), "#podcast"])
    return tags[:HASHTAG_MAX]


def description(segment: dict, topic: str) -> str:
    """Deskripsi 1-2 kalimat: dari analisis (upload_description), atau topik + kutipan terkuat."""
    text = _clean(segment.get("upload_description"), DESCRIPTION_MAX)
    if text:
        return text
    parts = [_clean(topic or segment.get("topic"), 160)]
    quote = _clean(segment.get("speaker_quote"), 120)
    if quote:
        parts.append(f"“{quote}”")
    return " ".join(p if p.endswith((".", "!", "?", "”")) else p + "." for p in parts if p)


def build(segment: dict, current_title: str, hooks: list, topic: str = "") -> dict:
    tags = hashtags(segment)
    desc = description(segment, topic)
    return {
        "titles": titles(segment, current_title, hooks),
        "description": desc,
        "hashtags": tags,
        # Teks siap tempel di kolom deskripsi YouTube (3 hashtag pertama tampil di atas judul)
        "description_full": "\n\n".join(p for p in (desc, " ".join(tags)) if p),
    }
