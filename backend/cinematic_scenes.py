"""
Adegan preset Cinematic: B-roll, zoom ke pembicara, atau animasi penuh 9:16. Tiap adegan punya transisi dan efek suara sendiri.

Waktu adegan disimpan dalam detik video sumber. Di luar adegan, klip memakai bingkai utamanya.
Kalau B-roll gagal diunduh atau animasi gagal dibuat, adegannya dilewati dan klip tetap selesai dirender.
"""
import hashlib
import json
import os
import re
import subprocess

import clip_frame
import motion_scenes

LOOKS = ("broll", "zoom", "motion")
TRANSITIONS = ("glitch", "flash")
SFX_ASSETS = {"glitch": "lib_glitch.wav", "whoosh": "lib_wh_short_1.wav", "flash": "lib_shutter.wav"}
# Animasi yang cocok untuk klip percakapan
MOTION_TEMPLATES = ("number", "ledger", "compare", "flow", "verdict")
MAX_SCENES = 24
MIN_SCENE_SECONDS = 1.0
QUERY_MAX_CHARS = 60
# Pustaka potongan video milik sendiri. Nama file menjelaskan isinya, misalnya "pria jas menatap kota malam.mp4".
BROLL_LIBRARY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "broll_library")
LIBRARY_EXTENSIONS = (".mp4", ".mov", ".mkv", ".webm")
FILE_RE = re.compile(r"""^[^/\\:*?"<>|]{1,120}$""")

SCENE_FPS = 30
GLITCH_SECONDS = 0.24
SFX_VOLUME = 45
MOTION_JOB_SECONDS = 180    # batas wajar satu animasi di CPU lambat

# Jarak dan panjang adegan otomatis
_MIN_GAP = 1.0
_MIN_LEN = 1.8
_MAX_LEN = 3.2
_MOTION_MIN = 3.0
_MOTION_MAX = 6.0
_ZOOM_EVERY = 5.0
_OPEN_SECONDS = 1.5   # detik pertama tetap pada pembicara, supaya penonton kenal dulu
_BROLL_EVERY = 6      # satu cuplikan tiap sekian detik klip


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and abs(number) != float("inf") else None


def sanitize(raw) -> list:
    """Adegan yang aman dipakai: urut waktu, tidak tumpang tindih, dan cukup panjang. Bentuk lama dari klip lama dibuang."""
    scenes = []
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict) or item.get("look") not in LOOKS:
            continue
        start, end = _number(item.get("start")), _number(item.get("end"))
        if start is None or end is None or start < 0 or end - start < MIN_SCENE_SECONDS:
            continue
        scene = {"start": round(start, 2), "end": round(end, 2), "look": item["look"],
                 "transition": item.get("transition") if item.get("transition") in TRANSITIONS else "",
                 "sfx": item.get("sfx") if item.get("sfx") in SFX_ASSETS else ""}
        if item["look"] == "broll":
            scene["query"] = re.sub(r"[^\w\s-]", " ", str(item.get("query") or ""), flags=re.UNICODE).strip()[:QUERY_MAX_CHARS]
            visual = _visual(item.get("visual"))
            if visual:
                scene["visual"] = visual
            name = item.get("file")
            if isinstance(name, str) and FILE_RE.match(name) and name.lower().endswith(LIBRARY_EXTENSIONS) and ".." not in name:
                scene["file"] = name
            if not scene["query"] and not visual and not scene.get("file"):
                continue
        elif item["look"] == "motion":
            motion = motion_scenes.sanitize(item.get("motion"))
            if not motion or motion["template"] not in MOTION_TEMPLATES:
                continue
            scene["motion"] = motion
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
Kamu editor video pendek. Baca dulu seluruh percakapan ("transcript") dan pahami apa yang sebenarnya dibicarakan.
Lalu dari daftar kalimat bernomor ("lines"), pilih kalimat yang paling kuat kalau ditimpa cuplikan video stok.
Aturan:
- Gambarnya harus berkaitan jelas dengan kalimat itu atau topik percakapannya, supaya penonton paham hubungannya.
- Contoh untuk percakapan soal susah tidur: "sleeping pills", "insomnia man bed", "doctor patient talking", "brain scan", "alarm clock". Jangan memakai gambar yang hanya indah tapi tidak terkait.
- Pakai kata pencarian yang berbeda-beda supaya gambarnya beragam. Usahakan mendekati jumlah maksimal, sebar merata sepanjang percakapan.
- Lewati kalimat tentang emosi, ekspresi wajah, atau percakapan antar orang. Hasil pencarian untuk hal itu biasanya tidak nyambung.
- query: 2 sampai 3 kata benda bahasa Inggris tanpa kata sifat emosi, misalnya "city night traffic" atau "stormy ocean waves".
- Jangan menyebut nama orang, merek, atau judul film.
- Paling banyak {MAX} pilihan. Kalau tidak ada yang cocok, kembalikan daftar kosong.
Kembalikan HANYA JSON: {"picks": [{"beat": 0, "query": "..."}]}
"""


LIBRARY_PROMPT = """
Kamu editor video pendek. Baca dulu seluruh percakapan ("transcript") dan pahami apa yang sebenarnya dibicarakan.
Dari daftar kalimat bernomor ("lines"), pilih kalimat yang paling kuat kalau ditimpa potongan video dari pustaka ("files").
Nama file menjelaskan isi potongan itu.
Aturan:
- Pasangkan hanya kalau isi potongan berkaitan jelas dengan kalimat itu atau topik percakapannya.
- Lebih baik tidak ada pilihan daripada pilihan yang tidak nyambung.
- Satu file paling banyak dipakai sekali, dan jangan dua kalimat berurutan.
- Paling banyak {MAX} pilihan. Kalau tidak ada yang cocok, kembalikan daftar kosong.
Kembalikan HANYA JSON: {"picks": [{"beat": 0, "file": 0}]}
"""


def library_files() -> list:
    try:
        return sorted(name for name in os.listdir(BROLL_LIBRARY) if name.lower().endswith(LIBRARY_EXTENSIONS))
    except OSError:
        return []


def beat_lines(beats: list) -> list:
    return [f"[{i}] {b['lead']} {b['main']} {b.get('tail', '')}".strip() for i, b in enumerate(beats)]


def pick_library(beats: list, duration: float, api_key: str | None = None, transcript: str = "") -> dict:
    """{nomor beat: nama file} dari pustaka sendiri. Kosong kalau pustaka kosong atau AI gagal."""
    files = library_files()
    if not files or not beats:
        return {}
    limit = max(1, int(duration // _BROLL_EVERY))
    try:
        from gemini_service import _call_gemini
        data = _call_gemini(LIBRARY_PROMPT.replace("{MAX}", str(limit)),
                            json.dumps({"transcript": transcript, "lines": beat_lines(beats), "files": {i: os.path.splitext(n)[0] for i, n in enumerate(files)}}, ensure_ascii=False), api_key=api_key)
    except Exception as e:
        print(f"[Cinematic] Pemilihan pustaka gagal: {e!r}")
        return {}
    picks, used = {}, set()
    for item in (data.get("picks") if isinstance(data, dict) else None) or []:
        beat, file = item.get("beat") if isinstance(item, dict) else None, item.get("file") if isinstance(item, dict) else None
        if isinstance(beat, int) and 0 <= beat < len(beats) and isinstance(file, int) and 0 <= file < len(files) and file not in used:
            picks[beat] = files[file]
            used.add(file)
    return dict(list(picks.items())[:limit])


def _broll_schema() -> dict:
    return {"type": "object", "required": ["picks"], "properties": {"picks": {"type": "array", "items": {
        "type": "object", "required": ["beat", "query"],
        "properties": {"beat": {"type": "integer"}, "query": {"type": "string"}}}}}}


def pick_broll(beats: list, duration: float, api_key: str | None = None, transcript: str = "") -> dict:
    """{nomor beat: kata pencarian}. Kosong kalau AI gagal; klip tetap punya adegan lain."""
    limit = max(1, int(duration // _BROLL_EVERY))
    try:
        from gemini_service import _call_gemini
        data = _call_gemini(BROLL_PROMPT.replace("{MAX}", str(limit)), json.dumps({"transcript": transcript, "lines": beat_lines(beats)}, ensure_ascii=False),
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


MOTION_PROMPT = """
Kamu editor video pendek. Baca seluruh percakapan ("transcript"), lalu pilih paling banyak {MAX} kalimat dari "lines" yang lebih mudah dipahami kalau ditampilkan sebagai animasi.
Template:
- number: pembicara menyebut satu angka penting. label, value, prefix ("Rp"), suffix, note, tone ("bad" untuk kabar buruk, selain itu "plain").
- ledger: pembicara merinci 2-6 pos dengan nominal. title, rows [{label, value}], start (nilai awal jika dikurangi, kalau tidak 0), prefix, result ("Sisa" atau "Total"). value angka penuh, mis. 3 juta = 3000000.
- compare: pembicara membandingkan dua hal. left dan right, masing-masing title dan items (1-3 poin pendek).
- flow: pembicara menjelaskan 2-4 langkah berurutan. title dan steps (head maks 22 karakter, body maks 40 karakter).
- verdict: pembicara membantah sebuah anggapan. question (maks 40 karakter), answer (teks stempel, maks 20 karakter).
Aturan:
- Isi HANYA dari ucapan. Angka harus benar-benar diucapkan. Jangan menambah fakta, angka, atau contoh baru.
- Kalau tidak ada yang benar-benar cocok, kembalikan daftar kosong. Klip percakapan tetap kuat tanpa animasi.
- Bahasa Indonesia lisan, singkat, tanpa emoji.
Kembalikan HANYA JSON: {"picks": [{"beat": 0, "motion": {"template": "number", "label": "", "value": 0, "prefix": "", "suffix": "", "note": "", "tone": "plain"}}]}
"""


def pick_motion(beats: list, duration: float, api_key: str | None = None, transcript: str = "") -> dict:
    """{nomor beat: isi animasi}. Maksimal 2 per klip, dan angkanya harus ada di ucapan."""
    if not beats or not transcript:
        return {}
    limit = 2 if duration >= 20 else 1
    try:
        from gemini_service import _call_gemini
        data = _call_gemini(MOTION_PROMPT.replace("{MAX}", str(limit)), json.dumps({"transcript": transcript, "lines": beat_lines(beats)}, ensure_ascii=False), api_key=api_key)
    except Exception as e:
        print(f"[Cinematic] Pemilihan animasi gagal: {e!r}")
        return {}
    picks = {}
    for item in (data.get("picks") if isinstance(data, dict) else None) or []:
        index = item.get("beat") if isinstance(item, dict) else None
        motion = motion_scenes.sanitize(item.get("motion")) if isinstance(item, dict) else None
        if (isinstance(index, int) and 0 <= index < len(beats) and motion and motion["template"] in MOTION_TEMPLATES
                and motion_scenes.values_in_text(motion, transcript)):
            picks[index] = motion
    return dict(list(picks.items())[:limit])


def plan(beats: list, clip_start: float, clip_end: float, broll: dict | None = None, library: dict | None = None, motions: dict | None = None) -> list:
    """
    Rencana adegan dari teks (detik video sumber, sama dengan beats): animasi, lalu B-roll, dan zoom ke pembicara di bagian
    yang kosong. Transisi dan efek suara ini hanya pilihan awal, dan semuanya bisa diubah atau dikosongkan di editor.
    """
    broll, library, motions = broll or {}, library or {}, motions or {}
    candidates = []
    for i, beat in enumerate(beats):
        line = f"{beat['lead']} {beat['main']} {beat.get('tail', '')}".strip()
        if i in motions:
            candidates.append((0, i, {"look": "motion", "motion": motions[i], "transition": "flash", "sfx": "whoosh"}))
        elif i in broll:
            # Pencarian stok ditulis khusus untuk kalimat ini, jadi lebih dulu daripada pustaka yang isinya umum
            candidates.append((1, i, {"look": "broll", "query": broll[i], "line": line, "transition": "", "sfx": "whoosh"}))
        elif i in library:
            candidates.append((2, i, {"look": "broll", "query": os.path.splitext(library[i])[0][:QUERY_MAX_CHARS], "file": library[i], "transition": "", "sfx": "whoosh"}))
    taken = []

    def place(i, fields, shortest, longest) -> bool:
        beat = beats[i]
        start = beat["start"]
        end = min(clip_end, start + longest, max(beat["end"], start + shortest))
        if start - clip_start < _OPEN_SECONDS or end - start < MIN_SCENE_SECONDS or clip_end - end < 0.5:
            return False
        if any(start < other["end"] + _MIN_GAP and end > other["start"] - _MIN_GAP for other in taken):
            return False
        taken.append({"start": round(start, 2), "end": round(end, 2), **fields})
        return True

    for _, i, fields in sorted(candidates, key=lambda c: (c[0], c[1])):
        if fields["look"] == "motion":
            place(i, fields, _MOTION_MIN, _MOTION_MAX)
        else:
            place(i, fields, _MIN_LEN, _MAX_LEN)

    # Pengisi: zoom ke pembicara supaya bagian panjang tetap punya gerak
    for i, beat in enumerate(beats):
        if len(taken) >= MAX_SCENES:
            break
        previous = max((s["end"] for s in taken if s["end"] <= beat["start"]), default=clip_start)
        if beat["start"] - previous >= _ZOOM_EVERY:
            place(i, {"look": "zoom", "transition": "", "sfx": ""}, _MIN_LEN, _MAX_LEN)
    return sorted(taken, key=lambda s: s["start"])


STOCK_CHECK_PROMPT = """
Kamu editor video. Tiap item berisi kalimat percakapan dan beberapa kandidat video stok, masing-masing dijelaskan dengan label isi.
Pilih kandidat yang isinya berkaitan jelas dengan kalimat itu atau kata pencariannya. Kalau tidak ada yang berkaitan, pilih -1.
Kembalikan HANYA JSON: {"choices": [{"item": 0, "option": 1}]}
"""
STOCK_CANDIDATES = 6


def _tag_score(query: str, tags: str) -> int:
    wanted = set(re.findall(r"\w+", query.lower()))
    return len(wanted & set(re.findall(r"\w+", tags.lower())))


def choose_stock(pending: list, api_key: str | None = None) -> dict:
    """
    {nomor item: nomor kandidat}, -1 kalau tidak ada yang cocok. pending: [{line, query, options: [{tags}]}].
    Kalau AI gagal, kandidat dipilih dari label yang cocok dengan kata pencarian. Tanpa label, kandidat pertama.
    """
    choices = {}
    if any(o.get("tags") for item in pending for o in item["options"]):
        payload = [{"item": i, "line": item["line"], "query": item["query"], "options": {k: o.get("tags", "") for k, o in enumerate(item["options"])}} for i, item in enumerate(pending)]
        try:
            from gemini_service import _call_gemini
            data = _call_gemini(STOCK_CHECK_PROMPT, json.dumps(payload, ensure_ascii=False), api_key=api_key)
            for row in (data.get("choices") if isinstance(data, dict) else None) or []:
                item, option = row.get("item") if isinstance(row, dict) else None, row.get("option") if isinstance(row, dict) else None
                if isinstance(item, int) and 0 <= item < len(pending) and isinstance(option, int) and -1 <= option < len(pending[item]["options"]):
                    choices[item] = option
        except Exception as e:
            print(f"[Cinematic] Pemeriksaan B-roll gagal: {e!r}")
    for i, item in enumerate(pending):
        if i in choices:
            continue
        if any(o.get("tags") for o in item["options"]):
            scores = [_tag_score(item["query"], o.get("tags", "")) for o in item["options"]]
            choices[i] = scores.index(max(scores)) if max(scores) > 0 else -1
        else:
            choices[i] = 0
    return choices


def attach_stock(scenes: list, api_key: str | None = None) -> list:
    """Isi video stok untuk B-roll yang belum punya, setelah isinya diperiksa cocok dengan kalimatnya. Yang tidak cocok dibuang."""
    import longform
    used = {s["visual"]["link"] for s in scenes if s.get("visual")}
    pending, keep = [], []
    for scene in scenes:
        if scene["look"] != "broll" or scene.get("visual") or scene.get("file"):
            keep.append(scene)
            continue
        try:
            results = longform.search_stock(scene.get("query", ""))
        except Exception as e:
            print(f"[Cinematic] Pencarian B-roll gagal: {e!r}")
            continue
        options = [r for r in results if r.get("link") not in used][:STOCK_CANDIDATES]
        if options:
            pending.append({"scene": scene, "line": scene.get("line") or scene.get("query", ""), "query": scene.get("query", ""), "options": options})
    for i, option in choose_stock(pending, api_key).items():
        if option < 0:
            print(f"[Cinematic] B-roll dilewati, tidak ada yang cocok: {pending[i]['query']}")
            continue
        visual = {k: v for k, v in pending[i]["options"][option].items() if k != "tags"}
        if visual["link"] not in used:
            used.add(visual["link"])
            keep.append({**pending[i]["scene"], "visual": visual})
    return sorted(keep, key=lambda s: s["start"])


def download_broll(scenes: list) -> tuple[list, dict]:
    """(adegan yang bisa dipakai, {indeks adegan: path video}). B-roll yang gagal diunduh dilewati."""
    import longform
    usable, paths = [], {}
    for scene in attach_stock(scenes):
        if scene["look"] == "broll":
            try:
                paths[len(usable)] = library_path(scene["file"]) if scene.get("file") else longform.download_stock(scene["visual"])
            except Exception as e:
                print(f"[Cinematic] Unduh B-roll gagal: {e!r}")
                continue
        usable.append(scene)
    return usable, paths


def library_path(name: str) -> str:
    path = os.path.join(BROLL_LIBRARY, os.path.basename(name))
    if not os.path.isfile(path):
        raise FileNotFoundError(name)
    return path


def library_offset(path: str, length: float) -> float:
    """Titik mulai potongan: tetap untuk file yang sama, dan bukan selalu dari detik pertama."""
    try:
        done = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True, timeout=30)
        total = float(done.stdout.strip())
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0.0
    room = total - length - 1
    if room <= 0:
        return 0.0
    return int(hashlib.sha1(os.path.basename(path).encode()).hexdigest(), 16) % 1000 / 1000 * room


# ── Video ────────────────────────────────────────────────────

def _spans(scenes: list) -> str:
    return "+".join(f"between(t,{s['start']:.3f},{s['end']:.3f})" for s in scenes)


def render_motions(scenes: list, workdir: str, accent: str) -> dict:
    """{nomor adegan: file animasi 9:16}. Yang gagal tidak ada di hasil, dan klip tetap selesai."""
    wanted = [(i, s) for i, s in enumerate(scenes) if s["look"] == "motion"]
    if not wanted:
        return {}
    if not motion_scenes.available():
        print("[Cinematic] Template animasi belum terpasang. Adegan animasi dilewati.")
        return {}
    out = os.path.abspath(workdir).replace("\\", "/")
    jobs = [{"id": f"clipmotion_{i}", "format": "clipmotion", "template": s["motion"]["template"], "motion": s["motion"], "seconds": round(s["end"] - s["start"], 2), "accent": accent}
            for i, s in wanted]
    jobs_path = os.path.join(workdir, "clip_motion_jobs.json")
    with open(jobs_path, "w", encoding="utf-8") as f:
        json.dump({"outDir": out, "jobs": jobs}, f, ensure_ascii=False)
    try:
        done = subprocess.run(["node", motion_scenes.TSX_CLI, "clip-motion.ts", os.path.abspath(jobs_path)], cwd=motion_scenes.MOTION_DIR, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=MOTION_JOB_SECONDS * len(jobs) + 60)
        for line in done.stdout.splitlines():
            if line.startswith("FAIL "):
                print(f"[Cinematic] {line[:240]}")
    except (OSError, subprocess.SubprocessError) as e:
        print(f"[Cinematic] Animasi gagal dijalankan: {e!r}")
    finally:
        if os.path.exists(jobs_path):
            os.remove(jobs_path)
    # Renderer meninggalkan potongan gambar dan suara di samping file hasil
    for name in os.listdir(workdir):
        if re.fullmatch(r"clipmotion_\d+-.+", name):
            os.remove(os.path.join(workdir, name))
    paths = {i: os.path.join(workdir, f"clipmotion_{i}.mp4") for i, _ in wanted}
    return {i: path for i, path in paths.items() if os.path.isfile(path)}


def build_layers(scenes: list, broll_paths: dict, motion_paths: dict, source: str, out_w: int, out_h: int, first_index: int, frame: dict | None = None) -> tuple:
    """
    (graph, label hasil, input FFmpeg tambahan). B-roll mengikuti bingkai utama supaya rasionya konsisten,
    sedangkan animasi mengisi penuh 9:16. Adegan zoom dikerjakan zoom_filter di cinematic.py.
    """
    inner_h = clip_frame.foreground_size(frame, out_w)[1] if clip_frame.is_framed(frame) else out_h
    parts, inputs = [f"[{source}]fps={SCENE_FPS}[sbase]"], []
    current = "sbase"
    for n, (index, path) in enumerate(sorted(broll_paths.items())):
        scene = scenes[index]
        length = scene["end"] - scene["start"]
        offset = ["-ss", f"{library_offset(path, length):.2f}"] if scene.get("file") else []
        inputs.append([*offset, "-stream_loop", "-1", "-t", f"{length + 0.5:.3f}", "-i", path])
        fit = f",pad={out_w}:{out_h}:0:{(out_h - inner_h) // 2}:black" if inner_h < out_h else ""
        parts.append(f"[{first_index + len(inputs) - 1}:v]scale={out_w}:{inner_h}:force_original_aspect_ratio=increase,"
                     f"crop={out_w}:{inner_h},setsar=1,eq=brightness=-0.03:contrast=1.06:saturation=0.85{fit},"
                     f"fps={SCENE_FPS},setpts=PTS-STARTPTS+{scene['start']:.3f}/TB[sb{n}]")
        parts.append(f"[{current}][sb{n}]overlay=0:0:eof_action=pass:enable='{_spans([scene])}'[sbo{n}]")
        current = f"sbo{n}"
    for n, (index, path) in enumerate(sorted(motion_paths.items())):
        scene = scenes[index]
        inputs.append(["-i", path])
        parts.append(f"[{first_index + len(inputs) - 1}:v]scale={out_w}:{out_h},setsar=1,fps={SCENE_FPS},setpts=PTS-STARTPTS+{scene['start']:.3f}/TB[sm{n}]")
        parts.append(f"[{current}][sm{n}]overlay=0:0:eof_action=pass:enable='{_spans([scene])}'[smo{n}]")
        current = f"smo{n}"
    return ";".join(parts), current, inputs


def transition_points(scenes: list, kind: str, duration: float) -> list:
    """
    Detik transisi jenis ini. B-roll dan animasi di awal dan akhir, karena gambarnya berganti dua kali.
    Zoom hanya di awal, karena transisi di tengah orang bicara mengganggu.
    """
    points = set()
    for scene in scenes:
        if scene.get("transition") == kind:
            points.add(scene["start"])
            if scene["look"] != "zoom":
                points.add(scene["end"])
    return sorted(p for p in points if 0.05 < p < duration - 0.05)


def flash_filter(points: list) -> str | None:
    """Kilatan putih singkat yang langsung memudar."""
    if not points:
        return None
    strong = "+".join(f"between(t,{p - 0.03:.3f},{p + 0.04:.3f})" for p in points)
    soft = "+".join(f"between(t,{p + 0.04:.3f},{p + 0.12:.3f})" for p in points)
    return (f"drawbox=x=0:y=0:w=iw:h=ih:t=fill:color=white@0.9:enable='{strong}',"
            f"drawbox=x=0:y=0:w=iw:h=ih:t=fill:color=white@0.4:enable='{soft}'")


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
    """[(nama efek suara, detik)]. Hanya saat adegan masuk, supaya klip tidak terlalu ramai."""
    return [(SFX_ASSETS[s["sfx"]], max(0.0, s["start"] - 0.05)) for s in scenes if s.get("sfx") in SFX_ASSETS and s["start"] < duration - 0.05]
