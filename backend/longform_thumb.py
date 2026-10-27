"""
Thumbnail video panjang (YouTube 1280x720, JPG < 2 MB).

Bukan gambar AI: latarnya frame asli dari video stok adegan (frame paling tajam), lalu tipografi tebal dengan
gaya tetap per channel (gaya + warna aksen disimpan sebagai "brand"), jadi semua video channel punya ciri yang sama.
  - tajuk     : foto penuh, bayangan dari kiri, huruf condensed kapital, kata aksen di blok warna
  - panel     : panel gelap solid di kiri + garis aksen, foto di kanan, kata aksen berwarna
  - editorial : foto duotone, serif besar gaya majalah, kata aksen italic berwarna
"""
import itertools
import os
import re
import subprocess

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1280, 720
FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
TEXT_MAX = 60
ACCENT_SCALE = 1.14   # Instrument Serif Italic tampak lebih kecil dari DM Serif pada ukuran yang sama
MAX_LINES = 3

ACCENTS = {
    "kuning": "#FFD23F",
    "merah": "#FF4438",
    "hijau": "#3DDC84",
    "biru": "#3D9BFF",
    "pink": "#FF5C93",
    "putih": "#F4F1EA",
}
STYLES = {"tajuk": "Tajuk", "panel": "Panel", "editorial": "Editorial"}
DEFAULT_BRAND = {"channel": "", "accent": "kuning", "style": "tajuk"}
INK = (14, 14, 16)


def sanitize_brand(raw) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    channel = re.sub(r"[\x00-\x1f{}\\<>*]", "", str(raw.get("channel") or "")).strip()[:40]
    return {
        "channel": channel,
        "accent": raw.get("accent") if raw.get("accent") in ACCENTS else DEFAULT_BRAND["accent"],
        "style": raw.get("style") if raw.get("style") in STYLES else DEFAULT_BRAND["style"],
    }


def clean_text(value) -> str:
    """Teks thumbnail satu baris (dipecah otomatis), *kata* = aksen."""
    text = re.sub(r"[\x00-\x1f{}\\<>]", " ", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()[:TEXT_MAX]


def parse_words(text: str) -> list:
    """[(kata, aksen?)] — *beberapa kata* juga boleh; tanda baca ikut katanya (mis. "*Bokek*?")."""
    words, accent, current = [], False, []
    for ch in clean_text(text) + " ":
        if ch == "*":
            accent = not accent
        elif ch == " ":
            word = "".join(c for c, _ in current)
            if word:
                words.append((word, any(a for c, a in current if c.isalnum())))
            current = []
        else:
            current.append((ch, accent))
    return words


def _font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(os.path.join(FONTS_DIR, name), max(8, int(size)))


def _rgb(hex_color: str) -> tuple:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _is_light(rgb: tuple) -> bool:
    r, g, b = (c / 255 for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55


# ── Latar ────────────────────────────────────────────────────

def _cover(img: Image.Image, w: int, h: int) -> Image.Image:
    scale = max(w / img.width, h / img.height)
    img = img.resize((max(w, round(img.width * scale)), max(h, round(img.height * scale))), Image.LANCZOS)
    left, top = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((left, top, left + w, top + h))


def best_frame(video_path: str, duration: float) -> Image.Image | None:
    """Frame paling tajam & tidak terlalu gelap/terang dari beberapa titik video."""
    duration = duration if duration and duration > 0 else 10
    best, best_score = None, -1.0
    for frac in (0.2, 0.35, 0.5, 0.65, 0.8):
        cmd = ["ffmpeg", "-v", "error", "-ss", f"{duration * frac:.2f}", "-i", video_path, "-frames:v", "1",
               "-vf", "scale=1280:-2", "-f", "image2pipe", "-vcodec", "png", "-"]
        try:
            raw = subprocess.run(cmd, capture_output=True, timeout=30).stdout
        except subprocess.TimeoutExpired:
            continue
        frame = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR) if raw else None
        if frame is None:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        sharp = float(cv2.Laplacian(cv2.resize(gray, (640, 360)), cv2.CV_64F).var())
        exposure = 1 - abs(float(gray.mean()) - 115) / 140
        score = sharp * max(0.2, exposure)
        if score > best_score:
            best, best_score = frame, score
    if best is None:
        return None
    return Image.fromarray(cv2.cvtColor(best, cv2.COLOR_BGR2RGB))


def _plain_background(accent: tuple) -> Image.Image:
    """Tanpa video stok: latar gelap dengan cahaya lembut warna aksen (bukan gradien norak)."""
    y, x = np.mgrid[0:H, 0:W]
    d = np.sqrt(((x - W * 0.78) / W) ** 2 + ((y - H * 0.3) / H) ** 2)
    glow = np.clip(1 - d / 0.75, 0, 1) ** 2 * 0.22
    base = np.array([20, 19, 24], np.float32)
    img = base + (np.array(accent, np.float32) - base) * glow[..., None]
    return Image.fromarray(img.astype(np.uint8))


def _grade(img: Image.Image) -> Image.Image:
    """Kontras sedikit naik, saturasi sedikit turun: kesan sinematik, tidak kartun."""
    arr = np.asarray(img).astype(np.float32) / 255
    gray = arr.mean(axis=2, keepdims=True)
    arr = gray + (arr - gray) * 0.9
    arr = np.clip((arr - 0.5) * 1.12 + 0.5, 0, 1)
    return Image.fromarray((arr * 255).astype(np.uint8))


def _duotone(img: Image.Image, accent: tuple) -> Image.Image:
    lum = np.asarray(img.convert("L")).astype(np.float32) / 255
    lum = np.clip((lum - 0.5) * 1.25 + 0.5, 0, 1)[..., None]
    dark = np.array(INK, np.float32)
    light = np.array(accent, np.float32) * 0.35 + np.array([236, 232, 222], np.float32) * 0.65
    return Image.fromarray((dark + (light - dark) * lum).astype(np.uint8))


def _gradient(w: int, h: int, stops: list, horizontal: bool) -> Image.Image:
    """Masker alfa dari titik [(posisi 0-1, alfa 0-255)]."""
    n = w if horizontal else h
    pos = np.linspace(0, 1, n)
    alpha = np.interp(pos, [s[0] for s in stops], [s[1] for s in stops]).astype(np.uint8)
    arr = np.tile(alpha, (h, 1)) if horizontal else np.tile(alpha[:, None], (1, w))
    return Image.fromarray(arr, "L")


def _shade(img: Image.Image, mask: Image.Image, color=(8, 8, 10)) -> Image.Image:
    return Image.composite(Image.new("RGB", img.size, color), img, mask)


def _finish(img: Image.Image) -> Image.Image:
    """Vignette halus + grain tipis agar terasa seperti foto, bukan render datar."""
    arr = np.asarray(img).astype(np.float32)
    y, x = np.mgrid[0:H, 0:W]
    d = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
    arr *= (1 - np.clip(d - 0.75, 0, 1) * 0.35)[..., None]
    arr += np.random.default_rng(7).normal(0, 5, (H, W, 1))
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


# ── Tipografi ────────────────────────────────────────────────

def _layout(words: list, font_name: str, box_w: int, box_h: int, line_gap: float, upper: bool,
            max_size: int, accent_font: str | None = None) -> tuple[int, list]:
    """
    Pecahan baris terbaik (semua kemungkinan 1-3 baris) yang menghasilkan huruf terbesar di dalam kotak.
    Return (ukuran font, [[(kata, aksen), ...], ...]).
    """
    ref = 100
    base, alt = _font(font_name, ref), _font(accent_font or font_name, ref * (ACCENT_SCALE if accent_font else 1))
    space = base.getlength(" ")

    def width(group):
        return sum((alt if a and accent_font else base).getlength(w.upper() if upper else w) for w, a in group) + space * (len(group) - 1)

    best = (0, [words])
    for n in range(1, min(MAX_LINES, len(words)) + 1):
        for cuts in itertools.combinations(range(1, len(words)), n - 1):
            bounds = (0, *cuts, len(words))
            lines = [words[bounds[i]:bounds[i + 1]] for i in range(n)]
            widest = max(width(line) for line in lines)
            size = min(box_w / widest * ref, box_h / (n * line_gap) * ref, max_size)
            # Baris seimbang lebih enak dilihat: sedikit penalti untuk baris yang sangat timpang
            shortest = min(width(line) for line in lines)
            score = size * (0.85 + 0.15 * shortest / widest)
            if score > best[0]:
                best = (score, lines, int(size))
    if len(best) == 2:
        return max_size, best[1]
    return best[2], best[1]


def _shadow_text(img: Image.Image, xy: tuple, text: str, font, fill, blur: int = 10, alpha: int = 170, offset: int = 4):
    layer = Image.new("L", img.size, 0)
    ImageDraw.Draw(layer).text((xy[0], xy[1] + offset), text, font=font, fill=alpha)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.paste(Image.new("RGB", img.size, (0, 0, 0)), (0, 0), layer)
    ImageDraw.Draw(img).text(xy, text, font=font, fill=fill)


def _draw_lines(img: Image.Image, lines: list, size: int, x0: int, y0: int, font_name: str, accent: tuple,
                upper: bool, line_gap: float, mode: str, accent_font: str | None = None, align: str = "left",
                box_w: int = 0):
    """mode: "block" = kata aksen di blok warna, "color" = kata aksen berwarna."""
    font = _font(font_name, size)
    alt = _font(accent_font, size * ACCENT_SCALE) if accent_font else font
    space = font.getlength(" ")
    draw = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        y = y0 + i * size * line_gap
        widths = [(alt if a and accent_font else font).getlength(w.upper() if upper else w) for w, a in line]
        line_w = sum(widths) + space * (len(line) - 1)
        x = x0 + (box_w - line_w) / 2 if align == "center" else x0
        for (word, is_accent), wdt in zip(line, widths):
            text = word.upper() if upper else word
            f = alt if is_accent and accent_font else font
            if is_accent and mode == "block":
                pad = size * 0.07
                _, top, _, bottom = draw.textbbox((x, y), text.rstrip("?!.,"), font=f)
                draw.rectangle((x - pad, top - pad * 0.8, x + wdt + pad, bottom + pad * 0.8), fill=accent)
                draw.text((x, y), text, font=f, fill=INK if _is_light(accent) else (255, 255, 255))
            else:
                _shadow_text(img, (x, y), text, f, accent if is_accent else (255, 255, 255))
            x += wdt + space


def _channel_tag(img: Image.Image, channel: str, accent: tuple, x: int, y: int, light_text=True):
    if not channel:
        return
    font = _font("Montserrat-Black.ttf", 24)
    draw = ImageDraw.Draw(img)
    text = channel.upper()
    draw.rectangle((x, y + 2, x + 6, y + 28), fill=accent)
    tx = x + 16
    for ch in text:  # spasi antarhuruf lebar, gaya label siaran
        _shadow_text(img, (tx, y), ch, font, (255, 255, 255) if light_text else INK, blur=4, alpha=120, offset=2)
        tx += font.getlength(ch) + 2.5


# ── Gaya ─────────────────────────────────────────────────────

def _style_tajuk(bg: Image.Image, words: list, accent: tuple, channel: str) -> Image.Image:
    img = _shade(_grade(bg), _gradient(W, H, [(0, 235), (0.42, 170), (0.75, 20), (1, 0)], True))
    img = _shade(img, _gradient(W, H, [(0, 0), (0.6, 0), (1, 120)], False))
    gap = 1.08
    size, lines = _layout(words, "Anton-Regular.ttf", 700, 480, gap, True, 180)
    block_h = size * gap * len(lines)
    _draw_lines(img, lines, size, 64, int(H - 70 - block_h), "Anton-Regular.ttf", accent, True, gap, "block")
    _channel_tag(img, channel, accent, 64, 48)
    return img


def _style_panel(bg: Image.Image, words: list, accent: tuple, channel: str) -> Image.Image:
    panel_w = 560
    img = Image.new("RGB", (W, H), (16, 16, 19))
    img.paste(_grade(_cover(bg, W - panel_w + 40, H)), (panel_w - 40, 0))
    img = _shade(img, _gradient(W, H, [(0, 0), ((panel_w - 40) / W, 0), ((panel_w + 120) / W, 140), ((panel_w + 260) / W, 0), (1, 0)], True))
    ImageDraw.Draw(img).rectangle((0, 0, panel_w, H), fill=(16, 16, 19))
    ImageDraw.Draw(img).rectangle((panel_w, 0, panel_w + 12, H), fill=accent)
    gap = 1.0
    size, lines = _layout(words, "Anton-Regular.ttf", panel_w - 110, 500, gap, True, 170)
    block_h = size * gap * len(lines)
    _draw_lines(img, lines, size, 56, int((H - block_h) / 2 + 10), "Anton-Regular.ttf", accent, True, gap, "color")
    _channel_tag(img, channel, accent, 56, 44)
    return img


def _style_editorial(bg: Image.Image, words: list, accent: tuple, channel: str) -> Image.Image:
    img = _duotone(bg, accent)
    img = _shade(img, _gradient(W, H, [(0, 60), (0.4, 40), (1, 225)], False))
    gap = 1.02
    size, lines = _layout(words, "DMSerifDisplay-Regular.ttf", W - 160, 400, gap, False, 150,
                          accent_font="InstrumentSerif-Italic.ttf")
    block_h = size * gap * len(lines)
    _draw_lines(img, lines, size, 80, int(H - 60 - block_h), "DMSerifDisplay-Regular.ttf", accent, False, gap, "color",
                accent_font="InstrumentSerif-Italic.ttf")
    if channel:
        font = _font("Montserrat-Black.ttf", 20)
        text = channel.upper()
        tw = sum(font.getlength(ch) + 2 for ch in text)
        draw = ImageDraw.Draw(img)
        draw.rectangle((80, 48, 80 + tw + 28, 86), fill=accent)
        tx = 94
        for ch in text:
            draw.text((tx, 55), ch, font=font, fill=INK if _is_light(accent) else (255, 255, 255))
            tx += font.getlength(ch) + 2
    return img


RENDERERS = {"tajuk": _style_tajuk, "panel": _style_panel, "editorial": _style_editorial}


def render(text: str, brand: dict, out_path: str, video_path: str | None = None, duration: float = 0) -> str:
    """Render thumbnail ke out_path (JPG). video_path = video stok untuk latar (opsional)."""
    brand = sanitize_brand(brand)
    words = parse_words(text)
    if not words:
        raise ValueError("Teks thumbnail kosong.")
    accent = _rgb(ACCENTS[brand["accent"]])
    frame = best_frame(video_path, duration) if video_path else None
    bg = _cover(frame, W, H) if frame else _plain_background(accent)
    img = _finish(RENDERERS[brand["style"]](bg, words, accent, brand["channel"]))
    tmp = out_path + ".tmp.jpg"
    for quality in (92, 85, 75):  # batas YouTube 2 MB
        img.save(tmp, "JPEG", quality=quality, optimize=True, progressive=True)
        if os.path.getsize(tmp) < 1_900_000:
            break
    os.replace(tmp, out_path)
    return out_path
