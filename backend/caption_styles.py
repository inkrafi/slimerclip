"""
Gaya caption: font yang dibundel (backend/fonts, lisensi SIL OFL) dan validasi opsi dari frontend.

Preset (Sorot, Kotak, dst.) didefinisikan di frontend (src/lib/caption-presets.ts); backend hanya
menerima gaya yang sudah lengkap dan memastikan tiap nilainya aman.
"""
import os
import re

FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")

# key → nama family di file TTF (dicocokkan libass lewat fontsdir)
FONTS = {
    "montserrat": "Montserrat Black",
    "poppins": "Poppins ExtraBold",
    "poppins-semibold": "Poppins SemiBold",
    "anton": "Anton",
    "bebas": "Bebas Neue",
    "bangers": "Bangers",
}

# Font kata utama untuk tipografi "dua font" (serif, ditulis miring)
ACCENT_FONTS = {
    "instrument": "Instrument Serif",
    "dmserif": "DM Serif Display",
}
EMPHASIS_SCALE = 1.5   # kata utama 1,5x ukuran teks

# Kata sambung / kata ganti yang tidak ditonjolkan sebagai kata utama
STOPWORDS = frozenset("""
yang dan di ke dari itu ini aja saja sih kan ya lah dong nih tuh deh kok pun untuk buat dengan sama atau juga
tapi karena kalau kalo jadi ada aku saya kamu gue gua gw lu lo dia kita kami mereka udah sudah lagi mau bisa
the a an and of to in on is it i you so that this
""".split())

HIGHLIGHT_STYLES = ("color", "box", "none")
ANIMATIONS = ("pop", "none")
# karaoke = kata yang sedang diucapkan disorot; duo = per halaman, satu kata utama beda font/warna/ukuran
MODES = ("karaoke", "duo")
HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

DEFAULT_STYLE = {
    "font": "montserrat",
    "size": 110,                # satuan PlayRes 1080x1920
    "uppercase": True,
    "color": "#FFFFFF",
    "highlight_color": "#3CFF8F",
    "outline_color": "#000000",
    "outline_width": 6,
    "shadow": 0,
    "highlight_style": "color",
    "words_per_line": 3,
    "position_y": 70,           # % tinggi layar (tengah teks)
    "animation": "pop",
    "background": False,        # kotak gelap transparan di belakang seluruh baris
    "mode": "karaoke",
    "accent_font": "instrument",
    # Khusus mode duo: kata muncul saat diucapkan; kata utama di baris sendiri
    "reveal": False,
    "stack": False,
}

# Opsi lama (sebelum ada preset) → nilai baru
_LEGACY_POSITION = {"top": 22, "center": 50, "bottom": 75}


def emphasis_index(words: list) -> int:
    """Kata utama satu halaman (tipografi dua font): kata bermakna terakhir; kata sambung dilewati."""
    for i in range(len(words) - 1, -1, -1):
        if words[i].lower().strip("?!\"'") not in STOPWORDS:
            return i
    return len(words) - 1


def sanitize_caption_style(raw) -> dict:
    """Gabungkan gaya dari frontend dengan nilai bawaan; nilai yang tidak valid diabaikan."""
    raw = raw if isinstance(raw, dict) else {}
    style = dict(DEFAULT_STYLE)

    def num(key, lo, hi):
        try:
            style[key] = int(max(lo, min(hi, int(raw[key]))))
        except (KeyError, TypeError, ValueError):
            pass

    if raw.get("font") in FONTS:
        style["font"] = raw["font"]
    num("size", 40, 200)
    num("outline_width", 0, 12)
    num("shadow", 0, 8)
    num("words_per_line", 1, 6)
    num("position_y", 10, 90)
    for key in ("color", "highlight_color", "outline_color"):
        if isinstance(raw.get(key), str) and HEX_COLOR_RE.match(raw[key]):
            style[key] = raw[key].upper()
    for key in ("uppercase", "background", "reveal", "stack"):
        if isinstance(raw.get(key), bool):
            style[key] = raw[key]
    if raw.get("highlight_style") in HIGHLIGHT_STYLES:
        style["highlight_style"] = raw["highlight_style"]
    if raw.get("animation") in ANIMATIONS:
        style["animation"] = raw["animation"]
    if raw.get("mode") in MODES:
        style["mode"] = raw["mode"]
    if raw.get("accent_font") in ACCENT_FONTS:
        style["accent_font"] = raw["accent_font"]

    # Kompatibel dengan opsi lama
    if "position_y" not in raw and raw.get("position") in _LEGACY_POSITION:
        style["position_y"] = _LEGACY_POSITION[raw["position"]]
    if "highlight_style" not in raw and raw.get("highlight_mode") == "none":
        style["highlight_style"] = "none"
    # Kotak sorotan per kata tidak bisa digabung dengan kotak latar seluruh baris
    if style["background"] and style["highlight_style"] == "box":
        style["highlight_style"] = "color"
    return style
