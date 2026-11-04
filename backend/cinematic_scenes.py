"""
Adegan preset Cinematic: bagian klip yang berganti bentuk (3:4, square, 16:9), kartu berbingkai putih, atau B-roll stok,
dengan transisi glitch dan efek suara di tiap pergantian.

Waktu adegan disimpan dalam detik video sumber. Di luar adegan, klip memakai bingkai utamanya.
Kalau B-roll gagal dicari atau diunduh, adegannya dilewati dan klip tetap selesai dirender.
"""
import json
import os
import re

import clip_frame

FRAME_LOOKS = tuple(clip_frame.RATIOS)
LOOKS = FRAME_LOOKS + ("card", "broll")
MAX_SCENES = 14
MIN_SCENE_SECONDS = 1.0
QUERY_MAX_CHARS = 60

SCENE_FPS = 30
GLITCH_SECONDS = 0.24
SFX_VOLUME = 45
WHOOSH = ("lib_wh_short_1.wav", "lib_wh_short_2.wav", "lib_wh_short_3.wav")

# Kartu: video 3:4 di tengah, dengan bingkai putih membulat (satuan lebar 1080)
CARD_WIDTH = 0.8
CARD_BORDER = 22
CARD_RADIUS = 40

# Teks di dalam adegan (satuan 1080×1920)
TEXT_Y = {**clip_frame.TEXT_Y, "card": 1270, "broll": 1180}

# Jarak dan panjang adegan otomatis
_MIN_GAP = 3.0
_MIN_LEN = 2.4
_MAX_LEN = 4.5
_OPEN_SECONDS = 2.5   # detik pertama tetap pada pembicara, supaya penonton kenal dulu


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and abs(number) != float("inf") else None


def sanitize(raw) -> list:
    """Adegan yang aman dipakai: urut waktu, tidak tumpang tindih, dan cukup panjang."""
    scenes = []
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict) or item.get("look") not in LOOKS:
            continue
        start, end = _number(item.get("start")), _number(item.get("end"))
        if start is None or end is None or start < 0 or end - start < MIN_SCENE_SECONDS:
            continue
        scene = {"start": round(start, 2), "end": round(end, 2), "look": item["look"],
                 "background": item.get("background") if item.get("background") in clip_frame.BACKGROUNDS else "blur"}
        if item["look"] == "broll":
            scene["query"] = re.sub(r"[^\w\s-]", " ", str(item.get("query") or ""), flags=re.UNICODE).strip()[:QUERY_MAX_CHARS]
            visual = _visual(item.get("visual"))
            if visual:
                scene["visual"] = visual
            if not scene["query"] and not visual:
                continue
        scenes.append(scene)
    scenes.sort(key=lambda s: s["start"])
    clean = []
    for scene in scenes:
        if clean and scene["start"] < clean[-1]["end"]:
            continue
        clean.append(scene)
    return clean[:MAX_SCENES]


def _visual(raw) -> dict | None:
    """Data video stok tervalidasi (host-nya diperiksa longform.sanitize_visual)."""
    if not isinstance(raw, dict):
        return None
    import longform
    visual = longform.sanitize_visual(raw)
    return visual if visual and visual.get("link") else None


def relative(scenes: list, start_sec: float, duration: float) -> list:
    """Adegan tersimpan → relatif awal klip; yang di luar rentang dibuang, yang terpotong tetap dipakai kalau cukup panjang."""
    out = []
    for scene in scenes or []:
        start, end = max(0.0, scene["start"] - start_sec), min(duration, scene["end"] - start_sec)
        if end - start >= MIN_SCENE_SECONDS:
            out.append({**scene, "start": round(start, 3), "end": round(end, 3)})
    return out


def look_at(scenes: list, seconds: float) -> str | None:
    return next((s["look"] for s in scenes if s["start"] <= seconds < s["end"]), None)


# ── Rencana otomatis ─────────────────────────────────────────

BROLL_PROMPT = """
Kamu editor video pendek. Dari daftar kalimat bernomor, pilih kalimat yang paling kuat kalau ditimpa cuplikan video stok.
Aturan:
- Pilih kalimat yang bisa digambarkan dengan hal umum yang mudah ditemukan di video stok: laut, gunung, hujan, jalan kota malam, kerumunan, kantor, laptop, uang, sekolah, jam.
- Lewati kalimat tentang emosi, ekspresi wajah, atau percakapan antar orang. Hasil pencarian untuk hal itu biasanya tidak nyambung.
- query: 2 sampai 3 kata benda bahasa Inggris tanpa kata sifat emosi, misalnya "city night traffic" atau "stormy ocean waves".
- Jangan menyebut nama orang, merek, atau judul film.
- Paling banyak {MAX} pilihan. Kalau tidak ada yang cocok, kembalikan daftar kosong.
Kembalikan HANYA JSON: {"picks": [{"beat": 0, "query": "..."}]}
"""


def _broll_schema() -> dict:
    return {"type": "object", "required": ["picks"], "properties": {"picks": {"type": "array", "items": {
        "type": "object", "required": ["beat", "query"],
        "properties": {"beat": {"type": "integer"}, "query": {"type": "string"}}}}}}


def pick_broll(beats: list, duration: float, api_key: str | None = None) -> dict:
    """{nomor beat: kata pencarian}. Kosong kalau AI gagal; klip tetap punya adegan lain."""
    limit = max(1, int(duration // 15))
    lines = [f"[{i}] {b['lead']} {b['main']}".strip() for i, b in enumerate(beats)]
    try:
        from gemini_service import _call_gemini
        data = _call_gemini(BROLL_PROMPT.replace("{MAX}", str(limit)), json.dumps({"lines": lines}, ensure_ascii=False),
                            api_key=api_key, schema=_broll_schema())
    except Exception as e:
        print(f"[Cinematic] Pemilihan B-roll gagal: {e!r}")
        return {}
    picks = {}
    for item in (data.get("picks") if isinstance(data, dict) else None) or []:
        index, query = item.get("beat") if isinstance(item, dict) else None, item.get("query") if isinstance(item, dict) else None
        if isinstance(index, int) and 0 <= index < len(beats) and isinstance(query, str) and query.strip():
            picks[index] = query.strip()[:QUERY_MAX_CHARS]
    return dict(list(picks.items())[:limit])


def plan(beats: list, clip_start: float, clip_end: float, broll: dict | None = None) -> list:
    """
    Rencana adegan dari teks (detik video sumber, sama dengan beats): angka besar jadi kartu, kalimat pilihan AI jadi
    B-roll, dan sesekali berganti bentuk 16:9 atau square. Sisanya tetap pada pembicara.
    """
    broll = broll or {}
    candidates = []
    for i, beat in enumerate(beats):
        if beat["kind"] == "number":
            candidates.append((0, i, {"look": "card"}))
        elif i in broll:
            candidates.append((1, i, {"look": "broll", "query": broll[i]}))
    taken = []

    def place(i, fields) -> bool:
        beat = beats[i]
        start = beat["start"]
        end = min(clip_end, start + _MAX_LEN, max(beat["end"], start + _MIN_LEN))
        if start - clip_start < _OPEN_SECONDS or end - start < MIN_SCENE_SECONDS or clip_end - end < 0.5:
            return False
        if any(start < other["end"] + _MIN_GAP and end > other["start"] - _MIN_GAP for other in taken):
            return False
        taken.append({"start": round(start, 2), "end": round(end, 2), "background": "blur", **fields})
        return True

    for _, i, fields in sorted(candidates, key=lambda c: (c[0], c[1])):
        place(i, fields)

    # Pengisi: berganti bentuk supaya bagian panjang tanpa adegan tetap punya variasi
    shapes = ("landscape", "square")
    used = 0
    for i, beat in enumerate(beats):
        if len(taken) >= MAX_SCENES:
            break
        previous = max((s["end"] for s in taken if s["end"] <= beat["start"]), default=clip_start)
        if beat["start"] - previous >= 7.0 and place(i, {"look": shapes[used % len(shapes)]}):
            used += 1
    return sorted(taken, key=lambda s: s["start"])


def attach_stock(scenes: list) -> list:
    """Isi video stok untuk B-roll yang belum punya. Yang tidak ketemu dibuang, dan video yang sama tidak dipakai dua kali."""
    import longform
    used, out = {s["visual"]["link"] for s in scenes if s.get("visual")}, []
    for scene in scenes:
        if scene["look"] != "broll" or scene.get("visual"):
            out.append(scene)
            continue
        try:
            results = longform.search_stock(scene.get("query", ""))
        except Exception as e:
            print(f"[Cinematic] Pencarian B-roll gagal: {e!r}")
            continue
        choice = next((r for r in results if r.get("link") not in used), None)
        if choice:
            used.add(choice["link"])
            out.append({**scene, "visual": choice})
    return out


def download_broll(scenes: list) -> tuple[list, dict]:
    """(adegan yang bisa dipakai, {indeks adegan: path video}). B-roll yang gagal diunduh dilewati."""
    import longform
    usable, paths = [], {}
    for scene in attach_stock(scenes):
        if scene["look"] == "broll":
            try:
                paths[len(usable)] = longform.download_stock(scene["visual"])
            except Exception as e:
                print(f"[Cinematic] Unduh B-roll gagal: {e!r}")
                continue
        usable.append(scene)
    return usable, paths


# ── Video ────────────────────────────────────────────────────

def _spans(scenes: list) -> str:
    return "+".join(f"between(t,{s['start']:.3f},{s['end']:.3f})" for s in scenes)


def card_size(out_w: int) -> tuple[int, int]:
    width = int(out_w * CARD_WIDTH) // 2 * 2
    return width, int(width / clip_frame.RATIOS["portrait"]) // 2 * 2


def write_card_png(path: str, out_w: int, out_h: int) -> None:
    """Bingkai putih membulat (PNG transparan, lubang di tengah untuk video)."""
    import cv2
    import numpy as np
    scale = out_w / 1080
    border, radius = max(2, int(CARD_BORDER * scale)), max(4, int(CARD_RADIUS * scale))
    width, height = card_size(out_w)
    x, y = (out_w - width) // 2, (out_h - height) // 2

    def rounded(mask, x0, y0, x1, y1, r, value):
        cv2.rectangle(mask, (x0 + r, y0), (x1 - r, y1), value, -1)
        cv2.rectangle(mask, (x0, y0 + r), (x1, y1 - r), value, -1)
        for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
            cv2.circle(mask, (cx, cy), r, value, -1, cv2.LINE_AA)

    alpha = np.zeros((out_h, out_w), dtype=np.uint8)
    rounded(alpha, x - border, y - border, x + width + border, y + height + border, radius + border, 255)
    hole = np.zeros((out_h, out_w), dtype=np.uint8)
    rounded(hole, x, y, x + width, y + height, radius, 255)
    # Di luar kartu transparan; ring putih menutup sudut video supaya tampak membulat
    image = np.full((out_h, out_w, 4), 255, dtype=np.uint8)
    image[:, :, 3] = cv2.subtract(alpha, hole)
    cv2.imwrite(path, image)


def _card_graph(prefix: str, layout_graph: str, src_w: int, src_h: int, out_w: int, out_h: int, png_index: int, label: str) -> str:
    width, height = card_size(out_w)
    x, y = (out_w - width) // 2, (out_h - height) // 2
    crop = clip_frame.crop_filter({"ratio": "portrait"}, src_w, src_h, layout_graph)
    small_w, small_h = out_w // clip_frame.BLUR_SCALE // 2 * 2, out_h // clip_frame.BLUR_SCALE // 2 * 2
    return (f"[0:v]scale={small_w}:{small_h}:force_original_aspect_ratio=increase,crop={small_w}:{small_h},"
            f"boxblur=18:2,eq=brightness=-0.32:saturation=0.8,scale={out_w}:{out_h},setsar=1,fps={SCENE_FPS}[{prefix}bg];"
            f"[0:v]{crop},scale={width}:{height}:flags=lanczos,setsar=1,fps={SCENE_FPS}[{prefix}fg];"
            f"[{prefix}bg][{prefix}fg]overlay={x}:{y}:shortest=1[{prefix}mid];"
            f"[{prefix}mid][{png_index}:v]overlay=0:0:shortest=1[{label}]")


def build_layers(scenes: list, broll_paths: dict, source: str, layout_graph: str, src_w: int, src_h: int,
                 out_w: int, out_h: int, duration: float, first_index: int, card_png: str | None) -> tuple:
    """(graph, label hasil, input FFmpeg tambahan). Tiap bentuk dibuat sekali lalu ditampilkan pada waktunya."""
    parts, inputs = [f"[{source}]fps={SCENE_FPS}[sbase]"], []
    current = "sbase"
    groups = {}
    for i, scene in enumerate(scenes):
        if scene["look"] == "broll":
            continue
        key = (scene["look"], scene["background"] if scene["look"] != "card" else "")
        groups.setdefault(key, []).append(scene)

    for n, ((look, background), group) in enumerate(groups.items()):
        label, prefix = f"sl{n}", f"s{n}"
        if look == "card":
            inputs.append(["-loop", "1", "-framerate", str(SCENE_FPS), "-t", f"{duration + 1:.3f}", "-i", card_png])
            parts.append(_card_graph(prefix, layout_graph, src_w, src_h, out_w, out_h, first_index + len(inputs) - 1, label))
        else:
            parts.append(clip_frame.build_graph({"ratio": look, "background": background}, layout_graph, src_w, src_h,
                                                out_w, out_h, label=label, prefix=prefix))
        parts.append(f"[{current}][{label}]overlay=0:0:enable='{_spans(group)}'[so{n}]")
        current = f"so{n}"

    for n, (index, path) in enumerate(sorted(broll_paths.items())):
        scene = scenes[index]
        length = scene["end"] - scene["start"]
        inputs.append(["-stream_loop", "-1", "-t", f"{length + 0.5:.3f}", "-i", path])
        parts.append(f"[{first_index + len(inputs) - 1}:v]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,"
                     f"crop={out_w}:{out_h},setsar=1,eq=brightness=-0.16:saturation=0.85,vignette=angle=0.7,"
                     f"fps={SCENE_FPS},setpts=PTS-STARTPTS+{scene['start']:.3f}/TB[sb{n}]")
        parts.append(f"[{current}][sb{n}]overlay=0:0:eof_action=pass:enable='{_spans([scene])}'[sbo{n}]")
        current = f"sbo{n}"
    return ";".join(parts), current, inputs


def boundaries(scenes: list, duration: float) -> list:
    """Detik pergantian adegan (tanpa awal dan akhir klip)."""
    points = sorted({t for s in scenes for t in (s["start"], s["end"]) if 0.2 < t < duration - 0.2})
    return points


def glitch_graph(source: str, dst: str, points: list, out_w: int, out_h: int) -> str | None:
    """Gambar pecah menjadi blok dan warnanya bergeser sekejap di tiap pergantian."""
    if not points:
        return None
    half = GLITCH_SECONDS / 2
    spans = "+".join(f"between(t,{p - half:.3f},{p + half:.3f})" for p in points)
    block = max(8, out_w // 22)
    strip_h = out_h // 7 // 2 * 2
    parts = [f"[{source}]split=3[g0][g1][g2]",
             f"[g1]scale={out_w // block}:{out_h // block}:flags=neighbor,scale={out_w}:{out_h}:flags=neighbor,"
             f"rgbashift=rh={out_w // 60}:bh=-{out_w // 60}[gpx]",
             f"[g0][gpx]overlay=0:0:enable='{spans}'[gm]"]
    current = "gm"
    source_splits = ["gs0", "gs1", "gs2"]
    parts.append(f"[g2]split=3[{source_splits[0]}][{source_splits[1]}][{source_splits[2]}]")
    for n, (row, speed) in enumerate(((1, 91), (3, 137), (5, 73))):
        y = row * out_h // 7
        parts.append(f"[{source_splits[n]}]crop={out_w}:{strip_h}:0:{y}[gc{n}]")
        parts.append(f"[{current}][gc{n}]overlay=x='{out_w // 9}*sin(t*{speed})':y={y}:enable='{spans}'[gx{n}]")
        current = f"gx{n}"
    parts.append(f"[{current}]null[{dst}]")
    return ";".join(parts)


def transition_sfx(scenes: list, duration: float) -> list:
    """[(nama efek suara, detik)] untuk tiap pergantian adegan, bergantian supaya tidak monoton."""
    return [(WHOOSH[i % len(WHOOSH)], max(0.0, point - 0.1)) for i, point in enumerate(boundaries(scenes, duration))]
