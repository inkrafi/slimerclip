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
HOOK_STYLES = ("light", "dark", "outline")
HOOK_MAX_CHARS = 120

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
    "hook": {"enabled": False, "text": "", "duration": 4, "style": "light", "font": "montserrat",
             "size": 80, "position_y": 14},
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
        "style": hook.get("style") if hook.get("style") in HOOK_STYLES else d_hook["style"],
        "font": hook.get("font") if hook.get("font") in FONTS else d_hook["font"],
        "size": int(_num(hook.get("size"), d_hook["size"], 40, 130)),
        "position_y": int(_num(hook.get("position_y"), d_hook["position_y"], 5, 80)),
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

HOOK_MARGIN_X = 90


def hook_box_padding(hook: dict) -> int:
    return max(12, int(hook["size"] * 0.28))


def hook_ass(hook: dict, duration: float, font_family: str) -> str | None:
    """
    Teks hook di atas video (satuan 1080×1920). position_y = tepi atas blok teks (% tinggi).
    Gaya light/dark: kotak per baris (BorderStyle 3), outline: teks putih bergaris tepi hitam.
    Baris dipotong otomatis oleh libass di dalam margin kiri-kanan.
    """
    if not hook.get("enabled") or not hook.get("text"):
        return None
    pad = hook_box_padding(hook)
    if hook["style"] == "light":
        primary, outline, border_style, bord, shadow = "&H00141414", "&H00FFFFFF", 3, pad, 0
    elif hook["style"] == "dark":
        primary, outline, border_style, bord, shadow = "&H00FFFFFF", "&H1A000000", 3, pad, 0
    else:
        primary, outline, border_style, bord, shadow = "&H00FFFFFF", "&H00000000", 1, max(4, hook["size"] // 14), 3
    end = duration if hook["duration"] <= 0 else min(duration, hook["duration"])
    margin_v = int(1920 * hook["position_y"] / 100) + (pad if border_style == 3 else 0)
    text = hook["text"].replace("\n", "\\N")
    return f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hook,{font_family},{hook["size"]},{primary},{primary},{outline},&H80000000,0,0,0,0,100,100,0,0,{border_style},{bord},{shadow},8,{HOOK_MARGIN_X},{HOOK_MARGIN_X},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 2,0:00:00.00,{_ass_time(end)},Hook,,0,0,0,,{{\\fad(150,200)}}{text}
"""


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
