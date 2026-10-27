"""
Niche channel per pengguna. Analisis Gemini tetap umum (dibagi antar pengguna lewat cache) dan memberi
setiap momen satu kategori; pengguna memilih kategori niche-nya, lalu momen di luar niche disembunyikan.
Momen lucu (kategori komedi) boleh ikut sebagai selingan.
"""

# Sama dengan frontend/src/lib/niche.ts
CATEGORIES = {
    "bisnis": "Bisnis & entrepreneurship",
    "investasi": "Investasi & saham",
    "keuangan": "Keuangan pribadi",
    "marketing": "Digital marketing & personal branding",
    "karier": "Karier & produktivitas",
    "teknologi": "Teknologi & AI",
    "pendidikan": "Pendidikan & ilmu pengetahuan",
    "mindset": "Mindset & motivasi",
    "kesehatan": "Kesehatan & gaya hidup",
    "hubungan": "Hubungan & keluarga",
    "sosial": "Isu sosial & politik",
    "hiburan": "Hiburan & selebriti",
    "komedi": "Komedi / momen lucu",
    "lainnya": "Lainnya",
}
# Bukan topik niche: komedi diatur lewat "selingan", lainnya tidak bisa dipilih
NICHE_TOPICS = tuple(k for k in CATEGORIES if k not in ("komedi", "lainnya"))
FUNNY = "komedi"

# topics kosong = semua topik (tanpa filter)
DEFAULT_NICHE = {"topics": [], "comedy": True}


def normalize_category(value) -> str:
    key = str(value or "").strip().lower()
    return key if key in CATEGORIES else "lainnya"


def sanitize_niche(raw) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    topics = raw.get("topics") if isinstance(raw.get("topics"), list) else []
    return {
        "topics": [t for t in NICHE_TOPICS if t in topics],
        "comedy": raw.get("comedy") if isinstance(raw.get("comedy"), bool) else DEFAULT_NICHE["comedy"],
    }
