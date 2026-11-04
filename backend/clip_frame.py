"""
Bingkai video di dalam output 9:16: penuh (mengikuti pembicara), 3:4, square 1:1, atau landscape 16:9.
Selain penuh, video diletakkan di tengah dengan latar hitam atau blur dari video yang sama.
"""
import re

# Lebar dibagi tinggi
RATIOS = {"portrait": 3 / 4, "square": 1.0, "landscape": 16 / 9}
BACKGROUNDS = ("black", "blur")
DEFAULT = {"ratio": "full", "background": "blur"}
BLUR_SCALE = 4   # latar diperkecil dulu supaya blur kuat tetap cepat
FPS = 30         # sama dengan zoom Cinematic, supaya gerak video di tengah tidak tersendat

# Posisi teks Cinematic (satuan 1080×1920): landscape di bawah video, lainnya di bagian bawah video
TEXT_Y = {"portrait": 1280, "square": 1240, "landscape": 1420}


def sanitize(raw) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    return {
        "ratio": raw.get("ratio") if raw.get("ratio") in RATIOS else "full",
        "background": raw.get("background") if raw.get("background") in BACKGROUNDS else DEFAULT["background"],
    }


def is_framed(frame: dict | None) -> bool:
    return bool(frame) and frame.get("ratio") in RATIOS


def _even(value: float) -> int:
    return max(2, int(value) // 2 * 2)


def foreground_size(frame: dict, out_w: int) -> tuple[int, int]:
    return out_w, _even(out_w / RATIOS[frame["ratio"]])


def speaker_center(layout_graph: str) -> str | None:
    """
    Titik tengah pembicara (ekspresi FFmpeg terhadap waktu), diambil dari crop penuh hasil lacak wajah:
    bingkai 3:4 dan square ikut pembicara tanpa perlu melacak wajah lagi. None kalau tata letaknya tidak punya crop itu.
    """
    match = re.search(r"crop=(\d+):\d+:x='([^']*)':y=0", layout_graph)
    return f"({match.group(2)})+{int(match.group(1)) / 2}" if match else None


def crop_filter(frame: dict, src_w: int, src_h: int, layout_graph: str) -> str:
    ratio = RATIOS[frame["ratio"]]
    if src_w / src_h >= ratio:
        crop_w, crop_h = _even(src_h * ratio), _even(src_h)
    else:
        crop_w, crop_h = _even(src_w), _even(src_w / ratio)
    room = src_w - crop_w
    center = speaker_center(layout_graph) if room > 0 else None
    x = f"clip({center}-{crop_w / 2},0,{room})" if center else str(room // 2)
    return f"crop={crop_w}:{crop_h}:x='{x}':y={(src_h - crop_h) // 2}"


def build_graph(frame: dict, layout_graph: str, src_w: int, src_h: int, out_w: int, out_h: int,
                fg_zoom: str | None = None, label: str = "vlayout", prefix: str = "f") -> str:
    """Filter graph [0:v] → [label] berukuran output. fg_zoom = filter zoom khusus video di tengah (tanpa latar)."""
    fg_w, fg_h = foreground_size(frame, out_w)
    y = (out_h - fg_h) // 2
    fg = f"[0:v]{crop_filter(frame, src_w, src_h, layout_graph)},scale={fg_w}:{fg_h}:flags=lanczos,setsar=1"
    if fg_zoom:
        fg += f",{fg_zoom}"
    if frame["background"] == "blur":
        small_w, small_h = _even(out_w / BLUR_SCALE), _even(out_h / BLUR_SCALE)
        bg = (f"[0:v]scale={small_w}:{small_h}:force_original_aspect_ratio=increase,crop={small_w}:{small_h},"
              f"boxblur=18:2,eq=brightness=-0.1:saturation=1.1,scale={out_w}:{out_h},setsar=1,fps={FPS}[{prefix}bg]")
    else:
        bg = f"color=c=black:s={out_w}x{out_h}:r={FPS},setsar=1[{prefix}bg]"
    return f"{fg}[{prefix}fg];{bg};[{prefix}bg][{prefix}fg]overlay=0:{y}:shortest=1[{label}]"
