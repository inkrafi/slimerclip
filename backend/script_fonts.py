"""
Font untuk teks non-Latin (caption, hook, watermark). Font bawaan (Montserrat, Poppins, dll.) hanya berisi
huruf Latin, jadi teks Jepang/Korea/Mandarin/Arab/Thai/Hindi akan tampil sebagai kotak kosong.

Teks dideteksi aksaranya, lalu dipakai font Noto Sans yang sesuai (lisensi SIL OFL). File font diunduh sekali
dari repositori resmi Noto saat pertama dibutuhkan (seperti model wajah YuNet), lalu disimpan di backend/fonts.
Untuk server tanpa akses internet saat render: jalankan `python script_fonts.py` sekali untuk mengunduh semuanya.
"""
import os
import re
import threading
import urllib.request

from caption_styles import FONTS_DIR

_CJK = "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF"
_NOTO = "https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts"

# aksara → (nama family di file font, nama file, URL, pola karakter)
SCRIPTS = {
    "ja": ("Noto Sans JP", "NotoSansJP-Bold.otf", f"{_CJK}/JP/NotoSansJP-Bold.otf", r"[぀-ヿㇰ-ㇿ]"),
    "ko": ("Noto Sans KR", "NotoSansKR-Bold.otf", f"{_CJK}/KR/NotoSansKR-Bold.otf", r"[가-힯ᄀ-ᇿ㄰-㆏]"),
    "zh": ("Noto Sans SC", "NotoSansSC-Bold.otf", f"{_CJK}/SC/NotoSansSC-Bold.otf", r"[一-鿿㐀-䶿]"),
    "ar": ("Noto Sans Arabic", "NotoSansArabic-Bold.ttf",
           f"{_NOTO}/NotoSansArabic/hinted/ttf/NotoSansArabic-Bold.ttf", r"[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]"),
    "th": ("Noto Sans Thai", "NotoSansThai-Bold.ttf", f"{_NOTO}/NotoSansThai/hinted/ttf/NotoSansThai-Bold.ttf", r"[฀-๿]"),
    "hi": ("Noto Sans Devanagari", "NotoSansDevanagari-Bold.ttf",
           f"{_NOTO}/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Bold.ttf", r"[ऀ-ॿ]"),
}
# Aksara tanpa spasi antar kata: kata hasil Whisper disambung tanpa spasi
NO_SPACE = {"ja", "zh"}
MAX_FONT_BYTES = 20 * 1024 * 1024

_patterns = {k: re.compile(v[3]) for k, v in SCRIPTS.items()}
_lock = threading.Lock()


def detect(text: str) -> str | None:
    """Aksara non-Latin utama di teks (≥20% huruf), atau None jika teksnya (hampir) semua Latin."""
    letters = sum(1 for ch in text or "" if ch.isalpha())
    if not letters:
        return None
    counts = {k: len(p.findall(text)) for k, p in _patterns.items()}
    # Kana (ja) sering bercampur kanji: kanji di teks berkana = Jepang, bukan Mandarin
    if counts["ja"]:
        counts["ja"] += counts.pop("zh")
    script, n = max(counts.items(), key=lambda kv: kv[1])
    return script if n >= letters * 0.2 else None


def ensure(script: str) -> str | None:
    """Pastikan file font aksara ini ada (unduh sekali). Return nama family, atau None jika gagal."""
    family, filename, url, _ = SCRIPTS[script]
    path = os.path.join(FONTS_DIR, filename)
    if os.path.isfile(path) and os.path.getsize(path) > 0:
        return family
    with _lock:
        if os.path.isfile(path) and os.path.getsize(path) > 0:
            return family
        tmp = path + ".part"
        try:
            print(f"[Font] Mengunduh {filename} untuk teks aksara '{script}'")
            with urllib.request.urlopen(url, timeout=60) as res, open(tmp, "wb") as f:
                size = 0
                while chunk := res.read(1 << 20):
                    size += len(chunk)
                    if size > MAX_FONT_BYTES:
                        raise ValueError("file font terlalu besar")
                    f.write(chunk)
            os.replace(tmp, path)
            return family
        except Exception as e:
            print(f"[Font] Gagal mengunduh {filename}: {e}. Teks memakai font bawaan.")
            try:
                os.remove(tmp)
            except OSError:
                pass
            return None


def family_for(text: str) -> tuple[str | None, str | None]:
    """(family font pengganti, aksara) untuk teks; (None, None) jika font bawaan sudah cukup."""
    script = detect(text)
    if not script:
        return None, None
    return ensure(script), script


if __name__ == "__main__":
    for key in SCRIPTS:
        print(key, ensure(key) or "GAGAL")
