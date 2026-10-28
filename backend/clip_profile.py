"""
Profil analisis klip (admin): bahasa video, bahasa teks untuk penonton, tipe video, target jumlah & durasi klip.
Pengguna biasa selalu memakai DEFAULT_PROFILE (tipe & bahasa video dideteksi otomatis).

Profil memengaruhi:
  - prompt pemilihan momen (kriteria per tipe, durasi, jumlah, bahasa output)  → prompt_templates.py
  - batas durasi saat merapikan momen                                          → scoring.py
  - bahasa transkrip YouTube & Whisper                                         → transcript_service.py, caption_service.py
  - tata letak 9:16 (split atas-bawah hanya untuk podcast/lainnya)              → render_pipeline.py
"""

# Kode ISO 639-1 (dipakai Whisper & YouTube) → nama untuk prompt dan UI
LANGUAGES = {
    "id": "Indonesia", "en": "Inggris", "ms": "Melayu", "jv": "Jawa", "su": "Sunda",
    "es": "Spanyol", "pt": "Portugis", "fr": "Prancis", "de": "Jerman", "it": "Italia", "nl": "Belanda",
    "ar": "Arab", "tr": "Turki", "ru": "Rusia", "hi": "Hindi",
    "ja": "Jepang", "ko": "Korea", "zh": "Mandarin", "th": "Thai", "vi": "Vietnam", "tl": "Filipina",
}

VIDEO_TYPES = {
    "auto": "Otomatis",
    "podcast": "Podcast / wawancara (2+ orang)",
    "solo": "Bicara sendiri (vlog, edukasi, opini)",
    "presentation": "Presentasi / panggung / seminar",
    "streamer": "Streamer (ngobrol / just chatting)",
    "gaming": "Streaming game",
    "other": "Lainnya",
}

# (minimal, maksimal, ideal_bawah, ideal_atas) detik
DURATIONS = {
    "short": {"label": "15–30 detik", "min": 15, "max": 35, "ideal": (18, 30)},
    "medium": {"label": "30–60 detik", "min": 30, "max": 65, "ideal": (35, 50)},
    "long": {"label": "60–90 detik", "min": 55, "max": 95, "ideal": (60, 80)},
}

CLIP_COUNTS = ("auto", 5, 10, 15, 20)
MAX_CLIPS = 20
AUTO_MAX_CLIPS = 12     # mode otomatis: ±1 momen per menit, maksimal 12
MIN_CLIPS = 3           # di bawah ini model lite cenderung hanya memberi 1 momen

# Bahasa yang ditawarkan di form admin (untuk sekarang Indonesia & Inggris); backend tetap menerima LANGUAGES
OFFERED_LANGUAGES = ("id", "en")

DEFAULT_PROFILE = {
    "source_language": "auto",
    "output_language": "id",   # produk utama untuk penonton Indonesia; admin bisa memilih "same" / bahasa lain
    "subtitle_language": "same",   # "same" = bahasa ucapan; kode bahasa = diterjemahkan (mis. klip Inggris, subtitle Indonesia)
    "video_type": "auto",
    "clip_count": "auto",
    "duration": "medium",
}

# Tata letak split atas-bawah hanya masuk akal bila ada ≥2 orang yang bergantian bicara
SPLIT_TYPES = {"podcast", "other", "auto"}


def sanitize(raw) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    out = dict(DEFAULT_PROFILE)
    if raw.get("source_language") == "auto" or raw.get("source_language") in LANGUAGES:
        out["source_language"] = raw["source_language"]
    if raw.get("output_language") == "same" or raw.get("output_language") in LANGUAGES:
        out["output_language"] = raw["output_language"]
    if raw.get("subtitle_language") == "same" or raw.get("subtitle_language") in LANGUAGES:
        out["subtitle_language"] = raw["subtitle_language"]
    if raw.get("video_type") in VIDEO_TYPES:
        out["video_type"] = raw["video_type"]
    if raw.get("clip_count") in CLIP_COUNTS and not isinstance(raw.get("clip_count"), bool):
        out["clip_count"] = raw["clip_count"]
    if raw.get("duration") in DURATIONS:
        out["duration"] = raw["duration"]
    return out


def duration_bounds(profile: dict | None) -> dict:
    return DURATIONS[(profile or DEFAULT_PROFILE).get("duration", "medium")]


def clip_count(profile: dict | None, video_duration: float) -> int:
    """
    Jumlah momen: pilihan admin (5/10/15/20), atau otomatis ±satu per menit (3-12). Keduanya dibatasi
    jumlah momen berdurasi minimal yang muat di video tanpa tumpang tindih.
    """
    bounds = duration_bounds(profile)
    fits = max(1, int((video_duration or 600) // bounds["min"]))
    wanted = (profile or DEFAULT_PROFILE).get("clip_count", "auto")
    if wanted == "auto":
        wanted = max(MIN_CLIPS, min(AUTO_MAX_CLIPS, round((video_duration or 600) / 60)))
    return int(max(1, min(fits, wanted, MAX_CLIPS)))


def ask_count(profile: dict | None, video_duration: float) -> int:
    """
    Jumlah yang diminta ke AI. Jumlah pasti: sedikit lebih banyak (±25%), karena sebagian momen biasanya
    tumpang tindih dan dibuang saat dirapikan; hasil akhirnya dipotong lagi ke clip_count.
    """
    count = clip_count(profile, video_duration)
    if not exact_count(profile):
        return count
    fits = max(1, int((video_duration or 600) // duration_bounds(profile)["min"]))
    return int(min(fits, count + max(2, count // 4)))


def exact_count(profile: dict | None) -> bool:
    """Admin memilih jumlah tertentu → AI diminta memberi tepat sejumlah itu (bukan "yang layak saja")."""
    return (profile or DEFAULT_PROFILE).get("clip_count", "auto") != "auto"


def resolved_type(profile: dict | None, detected) -> str:
    chosen = (profile or DEFAULT_PROFILE).get("video_type", "auto")
    if chosen != "auto":
        return chosen
    return detected if detected in VIDEO_TYPES and detected != "auto" else "other"


def resolved_language(profile: dict | None, detected) -> str | None:
    """Bahasa ucapan untuk Whisper: pilihan admin, atau hasil deteksi analisis; None = biar Whisper menebak."""
    chosen = (profile or DEFAULT_PROFILE).get("source_language", "auto")
    if chosen in LANGUAGES:
        return chosen
    code = str(detected or "").lower().split("-")[0]
    return code if code in LANGUAGES else None


def subtitle_target(profile: dict | None, spoken: str | None) -> str | None:
    """Bahasa tujuan terjemahan subtitle; None = subtitle tetap bahasa ucapan."""
    target = (profile or DEFAULT_PROFILE).get("subtitle_language", "same")
    if target not in LANGUAGES or (spoken and spoken.split("-")[0] == target):
        return None
    return target


def options() -> dict:
    """Pilihan untuk form admin di frontend."""
    return {
        "languages": [{"id": k, "label": LANGUAGES[k]} for k in OFFERED_LANGUAGES],
        "video_types": [{"id": k, "label": v} for k, v in VIDEO_TYPES.items()],
        "durations": [{"id": k, "label": v["label"]} for k, v in DURATIONS.items()],
        "clip_counts": list(CLIP_COUNTS),
        "default": DEFAULT_PROFILE,
    }
