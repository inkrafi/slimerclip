"""
Editor klip (khusus admin): resep edit per klip dan filter FFmpeg-nya.

Resep edit disimpan di manifest klip dan dipakai saat klip dirender ulang:
  - start / end   → rentang klip di video sumber (detik), boleh digeser dari momen asli
  - vignette      → bayangan gelap: dari bawah, atas, atas-bawah, atau lingkaran; kekuatan & tinggi
  - marks         → logo, teks akun, dan teks sumber (mis. "Sumber: YouTube …"); boleh tampil
                    bersamaan, yang posisinya sama ditumpuk dari tepi layar ke dalam
  - music         → musik latar dari aset pengguna, volume + ducking otomatis saat ada suara
  - sfx           → efek suara (pustaka bawaan atau aset pengguna), diputar di detik tertentu
  - hook          → teks pembuka besar di atas video (mis. pertanyaan pemancing), beberapa detik pertama

Teks caption yang sudah diedit tidak ada di resep: disimpan di <klip>.words.json (lihat
RenderPipeline._transcript_for), karena juga dipakai ulang tanpa edit.

Tata letak watermark memakai satuan video 1080×1920 (sama dengan caption ASS); frontend
(components/editor/ClipEditor.tsx) menghitung pratinjaunya dengan rumus yang sama.
"""
import math
import os
import re

ASSETS_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
# Efek suara bawaan (disintesis sendiri oleh tools/make_sfx.py, bebas lisensi)
SFX_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sfx")
SFX_LIBRARY = {
    "lib_whoosh.wav": "Whoosh",
    "lib_swipe.wav": "Swipe cepat",
    "lib_pop.wav": "Pop",
    "lib_ding.wav": "Ding",
    "lib_notif.wav": "Notifikasi",
    "lib_boom.wav": "Boom",
    "lib_riser.wav": "Riser (naik tegang)",
    "lib_click.wav": "Klik",
    "lib_applause.wav": "Tepuk tangan",
}

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
AUDIO_EXTS = {".mp3", ".m4a", ".aac", ".wav", ".ogg"}
ASSET_MAX_MB = {"image": 5, "audio": 30}
ASSET_NAME_RE = re.compile(r"^[A-Za-z0-9_.-]{1,120}$")

POSITIONS = ("tl", "tc", "tr", "bl", "br")
VIGNETTE_SHAPES = ("bottom", "top", "both", "radial")
MARK_KINDS = ("logo", "account", "source")   # urutan tumpukan: paling dekat tepi dulu
MAX_CLIP_SECONDS = 600
MIN_CLIP_SECONDS = 3
MAX_SFX = 30
# Gaya hook: spotlight/tape/poster (khas SlimerClip) + light/dark/outline (klasik)
HOOK_STYLES = ("spotlight", "tape", "poster", "light", "dark", "outline")
HOOK_ANIMS = ("cut", "pop", "slide", "type", "fade")
HOOK_ACCENTS = {"pink": "#FF4D8D", "yellow": "#FFD23F", "lime": "#B6F23A", "cyan": "#38D9F5", "white": "#FFFFFF"}
HOOK_MAX_CHARS = 120
HOOK_LABEL_MAX = 24
TITLE_MAX = 100
FILENAME_MAX = 80

# Tata letak watermark (satuan 1080×1920)
MARGIN_X, MARGIN_Y, STACK_GAP = 54, 130, 14
TEXT_SCALE = 3.2          # ukuran teks = size × 3.2 (size 16 ≈ 51 px)
LINE_HEIGHT = 1.3

DEFAULT_EDIT = {
    "vignette": {"shape": "bottom", "strength": 0, "height": 45},
    "marks": {
        "logo": {"enabled": False, "asset": "", "position": "tr", "size": 18, "opacity": 90},
        "account": {"enabled": False, "text": "", "position": "tr", "size": 16, "opacity": 85},
        "source": {"enabled": False, "text": "", "position": "tl", "size": 13, "opacity": 80},
    },
    "music": {"asset": "", "volume": 35, "ducking": True},
    "sfx": [],
    "hook": {"enabled": False, "text": "", "label": "", "duration": 4, "style": "spotlight", "anim": "cut",
             "accent": "pink", "font": "montserrat", "size": 110, "position_y": 50, "shade": 85},
}


def asset_kind(filename: str) -> str | None:
    ext = os.path.splitext(filename)[1].lower()
    return "image" if ext in IMAGE_EXTS else "audio" if ext in AUDIO_EXTS else None


def _num(value, default, lo, hi):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return default
    return min(hi, max(lo, value)) if math.isfinite(value) else default


def asset_path(assets_dir: str, name) -> str | None:
    """Path file aset: pustaka efek suara bawaan (lib_*) atau aset milik pengguna."""
    if not name:
        return None
    if name in SFX_LIBRARY:
        path = os.path.join(SFX_DIR, name)
    elif assets_dir:
        path = os.path.join(assets_dir, name)
    else:
        return None
    return path if os.path.isfile(path) else None


def _asset_name(value, kind: str) -> str:
    if isinstance(value, str) and ASSET_NAME_RE.match(value) and ".." not in value and asset_kind(value) == kind:
        return value
    return ""


def _clean_text(value, limit: int) -> str:
    # { } \ adalah tag/escape di ASS; baris baru tidak didukung
    return re.sub(r"[{}\\\n\r]", "", str(value or ""))[:limit].strip()


def _legacy_marks(raw: dict) -> dict:
    """Resep lama: satu watermark {kind: text|image} → marks.account / marks.logo."""
    wm = raw.get("watermark") if isinstance(raw.get("watermark"), dict) else {}
    common = {k: wm[k] for k in ("position", "size", "opacity") if k in wm}
    if wm.get("kind") == "text":
        return {"account": {**common, "enabled": True, "text": wm.get("text")}}
    if wm.get("kind") == "image":
        return {"logo": {**common, "enabled": True, "asset": wm.get("asset")}}
    return {}


def sanitize_edit(raw, default_start: float, default_end: float, video_duration: float | None = None) -> dict:
    """Resep edit yang aman dipakai FFmpeg. Nilai tidak valid diganti bawaan."""
    raw = raw if isinstance(raw, dict) else {}
    limit = video_duration if video_duration and video_duration > 0 else None

    start = _num(raw.get("start"), default_start, 0, limit or 1e7)
    end = _num(raw.get("end"), default_end, 0, limit or 1e7)
    if end - start < MIN_CLIP_SECONDS:
        start, end = default_start, default_end
    end = min(end, start + MAX_CLIP_SECONDS)

    # Vignette (resep lama: angka 0–100 = lingkaran)
    vig = raw.get("vignette")
    if not isinstance(vig, dict):
        vig = {"shape": "radial", "strength": vig} if vig else {}
    d_vig = DEFAULT_EDIT["vignette"]
    vignette = {
        "shape": vig.get("shape") if vig.get("shape") in VIGNETTE_SHAPES else d_vig["shape"],
        "strength": int(_num(vig.get("strength"), 0, 0, 100)),
        "height": int(_num(vig.get("height"), d_vig["height"], 10, 100)),
    }

    raw_marks = raw.get("marks") if isinstance(raw.get("marks"), dict) else _legacy_marks(raw)
    marks = {}
    for kind in MARK_KINDS:
        m = raw_marks.get(kind) if isinstance(raw_marks.get(kind), dict) else {}
        d = DEFAULT_EDIT["marks"][kind]
        mark = {
            "enabled": bool(m.get("enabled", False)),
            "position": m.get("position") if m.get("position") in POSITIONS else d["position"],
            "size": int(_num(m.get("size"), d["size"], 5, 40)),
            "opacity": int(_num(m.get("opacity"), d["opacity"], 10, 100)),
        }
        if kind == "logo":
            mark["asset"] = _asset_name(m.get("asset"), "image")
            mark["enabled"] = mark["enabled"] and bool(mark["asset"])
        else:
            mark["text"] = _clean_text(m.get("text"), 60)
            mark["enabled"] = mark["enabled"] and bool(mark["text"])
        marks[kind] = mark

    music = raw.get("music") if isinstance(raw.get("music"), dict) else {}
    d_music = DEFAULT_EDIT["music"]

    sfx = []
    for item in (raw.get("sfx") if isinstance(raw.get("sfx"), list) else [])[:MAX_SFX]:
        if not isinstance(item, dict):
            continue
        asset = item.get("asset") if item.get("asset") in SFX_LIBRARY else _asset_name(item.get("asset"), "audio")
        at = _num(item.get("at"), None, 0, limit or 1e7)
        if asset and at is not None:
            sfx.append({"asset": asset, "at": round(at, 2), "volume": int(_num(item.get("volume"), 80, 0, 100))})
    sfx.sort(key=lambda s: s["at"])

    hook = raw.get("hook") if isinstance(raw.get("hook"), dict) else {}
    d_hook = DEFAULT_EDIT["hook"]
    # Baris baru dipertahankan (maks 3 baris); tag ASS dibuang
    lines = [re.sub(r"[{}\\\r]", "", line).strip() for line in str(hook.get("text") or "").split("\n")]
    hook_text = "\n".join(line for line in lines if line)[:HOOK_MAX_CHARS]
    hook_text = "\n".join(hook_text.split("\n")[:3])
    from caption_styles import FONTS
    hook_clean = {
        "enabled": bool(hook.get("enabled", False)) and bool(hook_text),
        "text": hook_text,
        "duration": round(_num(hook.get("duration"), d_hook["duration"], 0, 60), 1),  # 0 = sepanjang klip
        "label": re.sub(r"[{}\\\r\n*]", "", str(hook.get("label") or "")).strip()[:HOOK_LABEL_MAX],
        "style": hook.get("style") if hook.get("style") in HOOK_STYLES else d_hook["style"],
        "anim": hook.get("anim") if hook.get("anim") in HOOK_ANIMS else d_hook["anim"],
        "accent": hook.get("accent") if hook.get("accent") in HOOK_ACCENTS else d_hook["accent"],
        "font": hook.get("font") if hook.get("font") in FONTS else d_hook["font"],
        "size": int(_num(hook.get("size"), d_hook["size"], 40, 130)),
        "position_y": int(_num(hook.get("position_y"), d_hook["position_y"], 5, 80)),
        # Bayangan bawah selama hook tampil (0 = mati), memudar saat hook hilang
        "shade": int(_num(hook.get("shade"), d_hook["shade"], 0, 100)),
    }

    return {
        "start": round(start, 2),
        "end": round(end, 2),
        "vignette": vignette,
        "marks": marks,
        "music": {
            "asset": _asset_name(music.get("asset"), "audio"),
            "volume": int(_num(music.get("volume"), d_music["volume"], 0, 100)),
            "ducking": bool(music.get("ducking", d_music["ducking"])),
        },
        "sfx": sfx,
        "hook": hook_clean,
    }


def clean_title(value) -> str:
    text = re.sub(r"[\x00-\x1f{}\\]", " ", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()[:TITLE_MAX]


def suggested_title(segment: dict) -> str:
    """
    Judul klip: short_title dari analisis; analisis lama → topik yang dipendekkan
    ("Hesti bercerita soal bisnis bareng suami — dan …" → "Hesti bercerita soal bisnis bareng suami").
    """
    title = clean_title(segment.get("short_title"))
    if title:
        return title
    topic = clean_title(segment.get("topic"))
    topic = re.split(r"\s[—–-]\s|[.;:!?](?:\s|$)|,\s", topic)[0].strip()
    if len(topic) > 60:
        topic = topic[:60].rsplit(" ", 1)[0]
    return topic.rstrip(" ,") or ""


def download_filename(title: str, fallback: str, ext: str = ".mp4") -> str:
    """Nama file unduhan dari judul: aman di Windows/macOS/Android, huruf non-Latin dipertahankan."""
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", clean_title(title))
    name = re.sub(r"\s+", " ", name).strip(" .")[:FILENAME_MAX].strip(" .")
    return f"{name or fallback}{ext}"


TEMPLATE_PARTS = ("vignette", "marks", "music", "hook")


def template_style(raw_edit) -> dict:
    """
    Bagian "tampilan" resep edit yang disimpan sebagai format edit dan bisa dipakai di klip lain:
    vignette, watermark, musik, dan gaya hook. Rentang, teks hook, dan efek suara khas tiap video.
    """
    raw_edit = raw_edit if isinstance(raw_edit, dict) else {}
    raw_hook = raw_edit.get("hook") if isinstance(raw_edit.get("hook"), dict) else {}
    # Teks sementara agar status "tampilkan hook" tidak ikut hilang saat disanitasi
    edit = sanitize_edit({**raw_edit, "hook": {**raw_hook, "text": "x"}}, 0, 60)
    style = {part: edit[part] for part in TEMPLATE_PARTS}
    style["hook"]["text"] = ""
    return style


def apply_template(edit: dict, style: dict, hook_text: str, has_asset, source_text: str | None) -> dict:
    """
    Format edit (hasil template_style) di atas resep satu klip, seperti tombol "Terapkan" di editor:
    rentang, teks hook, dan efek suara klip tetap; aset yang sudah dihapus dilewati.
    source_text = teks sumber dari channel video (format dengan "sumber otomatis"), None = dari format.
    """
    marks = {kind: dict(mark) for kind, mark in style["marks"].items()}
    if marks["logo"]["asset"] and not has_asset(marks["logo"]["asset"]):
        marks["logo"].update(asset="", enabled=False)
    if source_text is not None:
        marks["source"]["text"] = source_text
    music = dict(style["music"])
    if music["asset"] and not has_asset(music["asset"]):
        music["asset"] = ""
    hook = {**style["hook"], "text": hook_text, "enabled": style["hook"]["enabled"] and bool(hook_text)}
    return {**edit, "vignette": dict(style["vignette"]), "marks": marks, "music": music, "hook": hook}


def sanitize_transcript(raw) -> list | None:
    """Transkrip caption hasil edit: [{start, end, words: [{start, end, word}]}] dalam detik video sumber."""
    if not isinstance(raw, list) or len(raw) > 600:
        return None
    clean, total = [], 0
    for seg in raw:
        if not isinstance(seg, dict) or not isinstance(seg.get("words"), list):
            return None
        words = []
        for w in seg["words"]:
            if not isinstance(w, dict):
                return None
            text = str(w.get("word") or "").replace("\n", " ")[:48]
            start, end = _num(w.get("start"), None, 0, 1e7), _num(w.get("end"), None, 0, 1e7)
            if start is None or end is None or not text.strip():
                continue
            words.append({"start": round(start, 3), "end": round(max(start, end), 3), "word": text})
        total += len(words)
        if total > 8000:
            return None
        if words:
            clean.append({"start": words[0]["start"], "end": words[-1]["end"],
                          "text": " ".join(w["word"].strip() for w in words), "words": words})
    clean.sort(key=lambda s: s["start"])
    return clean


# ── Vignette ─────────────────────────────────────────────────

def vignette_filter(vignette: dict) -> str | None:
    """Vignette lingkaran: filter FFmpeg (PI/10 tipis … PI/3.2 kuat)."""
    if vignette["shape"] != "radial" or vignette["strength"] <= 0:
        return None
    angle = math.pi / 10 + (math.pi / 3.2 - math.pi / 10) * vignette["strength"] / 100
    return f"vignette=angle={angle:.4f}"


def shade_max_alpha(strength: int) -> float:
    return 0.25 + 0.65 * strength / 100


def write_shade_png(vignette: dict, width: int, height: int, path: str) -> bool:
    """
    Gradien hitam vertikal (PNG transparan) untuk vignette bawah/atas/atas-bawah.
    Paling gelap di tepi, memudar halus (smoothstep) sampai `height`% tinggi video.
    """
    if vignette["shape"] == "radial" or vignette["strength"] <= 0:
        return False
    import cv2
    import numpy as np

    reach = max(1, int(height * vignette["height"] / 100))
    y = np.arange(height, dtype=np.float32)
    from_bottom = np.clip((y - (height - reach)) / reach, 0, 1)   # 0 di batas gradien → 1 di tepi bawah
    from_top = np.clip((reach - y) / reach, 0, 1)
    smooth = lambda t: t * t * (3 - 2 * t)
    shape = vignette["shape"]
    if shape == "bottom":
        alpha = smooth(from_bottom)
    elif shape == "top":
        alpha = smooth(from_top)
    else:  # atas-bawah: tiap sisi setengah tinggi
        half = max(1, reach // 2)
        alpha = np.maximum(smooth(np.clip((y - (height - half)) / half, 0, 1)), smooth(np.clip((half - y) / half, 0, 1)))
    alpha = (alpha * shade_max_alpha(vignette["strength"]) * 255).astype(np.uint8)
    image = np.zeros((height, width, 4), dtype=np.uint8)
    image[:, :, 3] = alpha[:, None]
    return bool(cv2.imwrite(path, image))


# ── Watermark ────────────────────────────────────────────────

def text_size(mark: dict) -> float:
    return mark["size"] * TEXT_SCALE


def marks_layout(marks: dict, logo_aspect: float | None) -> list:
    """
    Posisi tiap watermark aktif (satuan 1080×1920). Yang posisinya sama ditumpuk:
    logo paling dekat tepi, lalu teks akun, lalu teks sumber.
    Return [{kind, position, offset (jarak dari tepi atas/bawah), width, height}].
    """
    cursor = {p: MARGIN_Y for p in POSITIONS}
    items = []
    for kind in MARK_KINDS:
        mark = marks.get(kind) or {}
        if not mark.get("enabled"):
            continue
        if kind == "logo":
            if not logo_aspect:
                continue
            width = 1080 * mark["size"] / 100
            height = width * logo_aspect
        else:
            width, height = None, text_size(mark) * LINE_HEIGHT
        pos = mark["position"]
        items.append({"kind": kind, "position": pos, "offset": cursor[pos], "width": width, "height": height})
        cursor[pos] += height + STACK_GAP
    return items


def _ass_time(seconds: float) -> str:
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def marks_ass(marks: dict, layout: list, duration: float, font_family: str) -> str | None:
    """File ASS untuk watermark teks (akun & sumber), atau None jika tidak ada."""
    events = []
    for item in layout:
        if item["kind"] == "logo":
            continue
        mark = marks[item["kind"]]
        pos = item["position"]
        top = pos.startswith("t")
        x = {"l": MARGIN_X, "c": 540, "r": 1080 - MARGIN_X}[pos[1]]
        # \an: 7/8/9 = jangkar atas kiri/tengah/kanan, 1/2/3 = bawah
        align = (7 if top else 1) + {"l": 0, "c": 1, "r": 2}[pos[1]]
        # Teks diletakkan di tengah baris setinggi LINE_HEIGHT agar sejajar dengan tumpukan
        pad = text_size(mark) * (LINE_HEIGHT - 1) / 2
        y = item["offset"] + pad if top else 1920 - item["offset"] - pad
        alpha = f"{round(255 * (1 - mark['opacity'] / 100)):02X}"
        events.append(
            f"Dialogue: 1,0:00:00.00,{_ass_time(duration + 1)},Mark,,0,0,0,,"
            f"{{\\an{align}\\pos({x},{y:.0f})\\fs{text_size(mark):.0f}\\alpha&H{alpha}&}}{mark['text']}")
    if not events:
        return None
    return f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Mark,{font_family},50,&H00FFFFFF,&H00FFFFFF,&H60000000,&H90000000,0,0,0,0,100,100,1,0,1,1.5,2,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(events) + "\n"


def logo_graph(mark: dict, item: dict, input_index: int, target_w: int, target_h: int, src: str, dst: str) -> str:
    """Overlay logo (input gambar) di atas [src] sesuai posisi tumpukan; hasil di [dst]."""
    sx, sy = target_w / 1080, target_h / 1920
    logo_w = max(16, int(item["width"] * sx)) // 2 * 2
    pos = mark["position"]
    margin_x = int(MARGIN_X * sx)
    x = {"l": str(margin_x), "c": "(W-w)/2", "r": f"W-w-{margin_x}"}[pos[1]]
    offset = int(item["offset"] * sy)
    y = str(offset) if pos.startswith("t") else f"H-h-{offset}"
    return (f"[{input_index}:v]scale={logo_w}:-2,format=rgba,colorchannelmixer=aa={mark['opacity'] / 100:.2f}[logo];"
            f"[{src}][logo]overlay=x={x}:y={y}:format=auto[{dst}]")


# ── Hook ─────────────────────────────────────────────────────
# Satuan 1080×1920. Frontend (LiveOverlays.tsx → HookOverlay) meniru semua angka di bawah, jadi
# perubahan di sini juga harus dilakukan di sana.

HOOK_MARGIN_X = 90
HOOK_CX = 540
EMPHASIS_RE = re.compile(r"\*([^*\n]+)\*")


def hook_box_padding(hook: dict) -> int:
    return max(12, int(hook["size"] * (0.22 if hook["style"] == "tape" else 0.28)))


def hook_label_metrics(hook: dict) -> tuple[int, int]:
    """(ukuran teks, padding kotak) label kecil di atas hook."""
    size = max(34, round(hook["size"] * 0.52))
    return size, max(10, round(size * 0.34))


def _luminance(hex_color: str) -> float:
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return 0.299 * r + 0.587 * g + 0.114 * b


def _darken(hex_color: str, factor: float) -> str:
    return "#" + "".join(f"{int(int(hex_color[i:i + 2], 16) * factor):02X}" for i in (1, 3, 5))


def hook_look(hook: dict) -> dict:
    """Warna & garis per gaya (hex #RRGGBB). Dipakai hook_ass dan dicerminkan di frontend."""
    accent = HOOK_ACCENTS[hook["accent"]]
    size, style = hook["size"], hook["style"]
    pad = hook_box_padding(hook)
    look = {"fill": "#FFFFFF", "line": "#000000", "line_alpha": 0, "box": False, "bord": 0, "shadow": 0,
            "blur": 0, "rotate": 0, "upper": False, "spacing": 0, "back": "#000000", "back_alpha": 0x80, "emph": accent, "emph_line": None, "emph_underline": False,
            "label_box": accent, "label_text": "#141414"}
    if style == "spotlight":
        # Teks putih dengan pendar gelap lembut: terbaca di latar apa pun tanpa kotak
        look.update(line_alpha=0x28, bord=max(8, round(size * 0.18)), blur=max(6, round(size * 0.18)))
    elif style == "tape":
        # Potongan selotip warna aksen, sedikit miring; kata penekanan digarisbawahi
        look.update(fill="#141414", line=accent, box=True, bord=pad, rotate=2.5, emph=None, emph_underline=True,
                    label_box="#141414", label_text="#FFFFFF")
    elif style == "poster":
        # Stiker: isi warna aksen, garis tebal gelap + bayangan padat; kata penekanan putih
        look.update(fill=accent, line="#141414", bord=max(5, round(size * 0.1)), shadow=max(5, round(size * 0.09)),
                    upper=True, spacing=max(1, round(size * 0.03)), back="#141414", back_alpha=0, emph="#FFFFFF")
    elif style == "light":
        look.update(fill="#141414", line="#FFFFFF", box=True, bord=pad,
                    emph=_darken(accent, 0.55) if _luminance(accent) > 0.55 else accent)
    elif style == "dark":
        look.update(line_alpha=0x1A, box=True, bord=pad)
    else:  # outline
        look.update(bord=max(4, size // 14), shadow=3)
    return look


def _ass_color(hex_color: str, alpha: int = 0) -> str:
    return f"&H{alpha:02X}{hex_color[5:7]}{hex_color[3:5]}{hex_color[1:3]}"


def hook_tokens(text: str, upper: bool = False) -> list:
    """Baris → kata [(teks, ditekankan?)]. *kata* = ditekankan."""
    lines = []
    for line in text.split("\n"):
        words, pos = [], 0
        for m in list(EMPHASIS_RE.finditer(line)) + [None]:
            plain = line[pos:m.start() if m else len(line)].replace("*", "")
            chunks = plain.split()
            if chunks and words and not plain[0].isspace():
                # Tanda baca yang menempel setelah *kata* ("*kalah*?") tetap satu kata
                words[-1] = (words[-1][0] + chunks.pop(0), words[-1][1])
            words += [(w, False) for w in chunks]
            if m:
                words += [(w, True) for w in m.group(1).split()]
                pos = m.end()
        lines.append([(w.upper() if upper else w, e) for w, e in words])
    return [line for line in lines if line]


def hook_type_step(n_words: int) -> int:
    """Jeda antar kata (ms) untuk animasi ketik: total maksimal ±0,9 detik."""
    return min(90, 900 // max(1, n_words))


def hook_block_top(hook: dict) -> tuple:
    """(tepi atas teks label atau None, tepi atas teks utama) dalam piksel 1080×1920."""
    top = int(1920 * hook["position_y"] / 100)
    main_pad = hook_box_padding(hook) if hook_look(hook)["box"] else 0
    if not hook.get("label"):
        return None, top + main_pad
    size, pad = hook_label_metrics(hook)
    return top + pad, top + 2 * pad + size + round(hook["size"] * 0.18) + main_pad


HOOK_CUT_FADE_OUT = 500  # ms; "cut" memudar lebih pelan (animasi lain 200), bersama bayangannya


def _anim_tags(anim: str, y: int) -> str:
    if anim == "cut":
        # Langsung muncul penuh (tanpa animasi masuk), lalu memudar
        return rf"\fad(0,{HOOK_CUT_FADE_OUT})"
    if anim == "pop":
        return r"\fad(80,200)\fscx70\fscy70\t(0,160,\fscx108\fscy108)\t(160,280,\fscx100\fscy100)"
    if anim == "slide":
        return rf"\fad(120,200)\move({HOOK_CX},{y - 80},{HOOK_CX},{y},0,260)"
    if anim == "type":
        return r"\fad(0,200)"
    return r"\fad(150,200)"


HOOK_SHADE_HEIGHT = 70        # % tinggi layar
HOOK_SHADE_OUT = HOOK_CUT_FADE_OUT / 1000  # detik; bayangan langsung tampil, memudar bersama teks


def hook_end(hook: dict, duration: float) -> float:
    return duration if hook["duration"] <= 0 else min(duration, hook["duration"])


def hook_shade(hook: dict) -> dict | None:
    """Vignette bawah yang ikut tampil bersama hook (bentuknya sama dengan write_shade_png)."""
    if not hook.get("enabled") or not hook.get("text") or hook.get("shade", 0) <= 0:
        return None
    return {"shape": "bottom", "strength": hook["shade"], "height": HOOK_SHADE_HEIGHT}


def hook_shade_filter(index: int, src: str, dst: str, end: float, duration: float) -> str:
    """Bayangan hook (input gambar berulang sepanjang `end` detik): langsung tampil, memudar bersama teks hook."""
    fades = f",fade=t=out:st={max(0.0, end - HOOK_SHADE_OUT):.2f}:d={HOOK_SHADE_OUT}:alpha=1" if end < duration else ""
    return f"[{index}:v]format=rgba{fades}[hshade];[{src}][hshade]overlay=format=auto:eof_action=pass[{dst}]"


def hook_ass(hook: dict, duration: float, font_family: str) -> str | None:
    """
    Teks hook di atas video. position_y = tepi atas blok (label + teks) dalam % tinggi.
    *kata* diberi warna aksen; label opsional tampil sebagai pil kecil di atasnya.
    Baris dipotong otomatis oleh libass di dalam margin kiri-kanan.
    """
    if not hook.get("enabled") or not hook.get("text"):
        return None
    look = hook_look(hook)
    end = hook_end(hook, duration)
    label_y, main_y = hook_block_top(hook)
    fill = _ass_color(look["fill"])
    line = _ass_color(look["line"], look["line_alpha"])
    lines = hook_tokens(hook["text"], look["upper"])
    step = hook_type_step(sum(len(words) for words in lines))

    def place(y: int) -> str:
        tags = rf"\an8\pos({HOOK_CX},{y})"
        if look["rotate"]:
            tags += rf"\org({HOOK_CX},{y})\frz{look['rotate']}"
        return tags

    parts, index = [], 0
    for line_words in lines:
        words = []
        for word, emph in line_words:
            tags = ""
            if emph and look["emph"]:
                tags += rf"\c{_ass_color(look['emph'])}"
            if emph and look["emph_line"]:
                tags += rf"\3c{_ass_color(look['emph_line'])}"
            if emph and look["emph_underline"]:
                tags += r"\u1"
            if hook["anim"] == "type":
                a = index * step
                tags += rf"\1a&HFF&\3a&HFF&\4a&HFF&\t({a},{a + 60},\1a&H00&\3a&H{look['line_alpha']:02X}&\4a&H80&)"
            reset = rf"\c{fill}\3c{line}\u0" if emph else ""
            words.append((f"{{{tags}}}" if tags else "") + word + (f"{{{reset}}}" if reset else ""))
            index += 1
        parts.append(" ".join(words))
    text = r"\N".join(parts)
    blur = rf"\blur{look['blur']}" if look["blur"] else ""

    styles = [f"Style: Hook,{font_family},{hook['size']},{fill},{fill},{line},{_ass_color(look['back'], look['back_alpha'])},0,0,0,0,100,100,{look['spacing']},0,"
              f"{3 if look['box'] else 1},{look['bord']},{look['shadow']},8,{HOOK_MARGIN_X},{HOOK_MARGIN_X},0,1"]
    events = [f"Dialogue: 2,0:00:00.00,{_ass_time(end)},Hook,,0,0,0,,"
              f"{{{place(main_y)}{blur}{_anim_tags(hook['anim'], main_y)}}}{text}"]
    if label_y is not None:
        size, pad = hook_label_metrics(hook)
        text_color = _ass_color(look["label_text"])
        styles.append(f"Style: HookLabel,{font_family},{size},{text_color},{text_color},{_ass_color(look['label_box'])},"
                      f"&H00000000,0,0,0,0,100,100,{round(size * 0.08)},0,3,{pad},0,8,"
                      f"{HOOK_MARGIN_X},{HOOK_MARGIN_X},0,1")
        label_anim = _anim_tags("fade" if hook["anim"] == "type" else hook["anim"], label_y)
        events.insert(0, f"Dialogue: 3,0:00:00.00,{_ass_time(end)},HookLabel,,0,0,0,,"
                         f"{{{place(label_y)}{label_anim}}}{hook['label'].upper()}")
    return "\n".join([
        "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1080", "PlayResY: 1920", "WrapStyle: 0",
        "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
        "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
        "MarginR, MarginV, Encoding",
        *styles, "",
        "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
        *events, "",
    ])


# ── Audio ────────────────────────────────────────────────────

NORM = "aformat=sample_rates=48000:channel_layouts=stereo"


def audio_graph(music: dict | None, music_index: int | None, sfx: list, duration: float, has_speech: bool,
                dst: str) -> str | None:
    """
    Campuran audio: suara asli + musik latar (diulang, fade, ducking) + efek suara di detik tertentu.
    sfx: [(input_index, offset_detik, volume 0–100)]. Return None jika tidak ada yang perlu dicampur.
    """
    if music_index is None and not sfx:
        return None
    parts, mix = [], []
    if has_speech:
        parts.append(f"[0:a]{NORM},asplit=2[speech][side]" if music_index is not None and music["ducking"]
                     else f"[0:a]{NORM}[speech]")
        mix.append("[speech]")
    if music_index is not None:
        gain = music["volume"] / 100  # 35% ≈ -9 dB dari level asli musik
        fade_out = max(0.0, duration - 1.5)
        parts.append(f"[{music_index}:a]{NORM},atrim=0:{duration:.3f},volume={gain:.4f},"
                     f"afade=t=in:d=0.5,afade=t=out:st={fade_out:.3f}:d=1.5[bgm]")
        if has_speech and music["ducking"]:
            # Volume musik turun otomatis saat ada suara (kompresor dipicu audio asli)
            parts.append("[bgm][side]sidechaincompress=threshold=0.05:ratio=4:attack=20:release=500[bgmd]")
            mix.append("[bgmd]")
        else:
            mix.append("[bgm]")
    for n, (index, offset, volume) in enumerate(sfx):
        delay = int(offset * 1000)
        parts.append(f"[{index}:a]{NORM},volume={volume / 100:.3f},adelay={delay}|{delay}[sfx{n}]")
        mix.append(f"[sfx{n}]")
    if not has_speech:
        # Tanpa audio asli: alas hening sepanjang klip agar durasi campuran tetap penuh
        parts.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{duration:.3f}[silence]")
        mix.insert(0, "[silence]")
    if len(mix) == 1:
        parts.append(f"{mix[0]}anull[{dst}]")
    else:
        parts.append(f"{''.join(mix)}amix=inputs={len(mix)}:duration=first:normalize=0[{dst}]")
    return ";".join(parts)
