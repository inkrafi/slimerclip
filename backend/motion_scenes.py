"""
Animasi adegan longform: teks kinetik, grafik, perbandingan, dan alur, ditumpuk di atas video stok.

Template ada di folder motion/ (Revideo) dan dirender transparan. Isinya hanya boleh berasal dari teks adegan:
angka di grafik diperiksa ke narasi, jadi AI tidak bisa menambah data sendiri.
Kalau Node atau Chrome tidak tersedia, atau satu adegan gagal, adegan itu tetap dirender dengan video stok saja.
"""
import json
import os
import re
import subprocess

TEMPLATES = ("kinetic", "data", "compare", "flow")
MOTION_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "motion")
TSX_CLI = os.path.join(MOTION_DIR, "node_modules", "tsx", "dist", "cli.mjs")
SECONDS_PER_JOB = 180   # batas wajar satu adegan di CPU lambat; dipakai menghitung batas waktu proses
MIN_SECONDS = 2.5       # adegan lebih pendek dari ini tidak cukup untuk animasi


def _text(value, limit: int) -> str:
    text = re.sub(r"[\x00-\x1f{}\\]", " ", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()[:limit]


def _texts(values, limit: int, count: int) -> list:
    out = [_text(v, limit) for v in (values if isinstance(values, list) else [])]
    return [v for v in out if v][:count]


def _side(raw) -> dict | None:
    raw = raw if isinstance(raw, dict) else {}
    title, items = _text(raw.get("title"), 28), _texts(raw.get("items"), 40, 3)
    return {"title": title, "items": items} if title and items else None


def sanitize(raw) -> dict | None:
    """Isi animasi yang aman; None kalau tanpa animasi atau isinya tidak cukup."""
    if not isinstance(raw, dict) or raw.get("template") not in TEMPLATES:
        return None
    template = raw["template"]
    if template == "kinetic":
        words = _texts(raw.get("words"), 24, 3)
        if not words:
            return None
        return {"template": template, "lead": _text(raw.get("lead"), 40), "words": words, "note": _text(raw.get("note"), 60)}
    if template == "data":
        values = []
        for value in raw.get("values") if isinstance(raw.get("values"), list) else []:
            try:
                number = float(value)
            except (TypeError, ValueError):
                continue
            if number == number and abs(number) < 1e13:
                values.append(int(number) if number == int(number) else round(number, 2))
        title = _text(raw.get("title"), 60)
        if len(values) < 2 or not title:
            return None
        return {"template": template, "title": title, "values": values[:12], "prefix": _text(raw.get("prefix"), 8),
                "suffix": _text(raw.get("suffix"), 12), "caption": _text(raw.get("caption"), 30), "note": _text(raw.get("note"), 60)}
    if template == "compare":
        left, right = _side(raw.get("left")), _side(raw.get("right"))
        return {"template": template, "left": left, "right": right} if left and right else None
    title = _text(raw.get("title"), 50)
    steps = []
    for item in raw.get("steps") if isinstance(raw.get("steps"), list) else []:
        head = _text(item.get("head"), 22) if isinstance(item, dict) else ""
        if head:
            steps.append({"head": head, "body": _text(item.get("body"), 40)})
    return {"template": template, "title": title, "steps": steps[:4]} if title and len(steps) >= 2 else None


# ── Rencana otomatis ─────────────────────────────────────────

PLAN_PROMPT = """
Kamu editor video YouTube. Dari daftar narasi bernomor, pilih adegan yang lebih kuat kalau diberi animasi di atas video latar.
Template:
- kinetic: satu gagasan yang perlu ditegaskan. lead (kecil, opsional), words (1-3 baris besar, tiap baris maks 24 karakter), note (opsional).
- data: narasi menyebut minimal dua angka yang bisa dibandingkan. title, values (angka dari narasi, berurutan), prefix (mis. "Rp"), suffix (mis. " juta"), caption, note.
- compare: narasi membandingkan dua hal. left dan right, masing-masing title dan items (1-3 poin pendek).
- flow: narasi menjelaskan 2-4 langkah berurutan. title dan steps (head maks 22 karakter, body maks 40 karakter).
Aturan:
- Isi HANYA dari narasi adegan itu. Jangan menambah fakta, angka, atau contoh baru.
- Pilih sekitar sepertiga adegan, jangan dua adegan berurutan, dan variasikan templatenya. Selebihnya biarkan video latar saja.
- Bahasa Indonesia lisan, singkat, tanpa emoji.
Kembalikan HANYA JSON: {"picks": [{"scene": 0, "motion": {"template": "kinetic", "lead": "", "words": ["..."], "note": ""}}]}
"""


def values_in_text(motion: dict, text: str) -> bool:
    """Angka di grafik harus benar-benar diucapkan di narasi."""
    if motion["template"] != "data":
        return True
    digits = {d.replace(".", "").replace(",", "") for d in re.findall(r"\d[\d.,]*\d|\d", text)}
    return all(str(abs(v)).replace(".", "") in digits for v in motion["values"])


def apply_picks(scenes: list, picks) -> int:
    """Pasang pilihan AI ke adegan narasi yang belum punya animasi. Return jumlah yang terpasang."""
    narration = [s for s in scenes if s["kind"] == "narration"]
    added, last = 0, -2
    for item in sorted((p for p in (picks if isinstance(picks, list) else []) if isinstance(p, dict) and isinstance(p.get("scene"), int)),
                       key=lambda p: p["scene"]):
        index = item["scene"]
        if not 0 <= index < len(narration) or index - last < 2 or narration[index].get("motion"):
            continue
        motion = sanitize(item.get("motion"))
        if motion and values_in_text(motion, narration[index]["text"]):
            narration[index]["motion"] = motion
            last = index
            added += 1
    return added


def plan(scenes: list, api_key: str | None = None) -> int:
    """Pilih animasi untuk adegan narasi lewat Gemini. Kalau gagal, adegan tetap memakai video latar saja."""
    narration = [s for s in scenes if s["kind"] == "narration"]
    if not narration:
        return 0
    from gemini_service import _call_gemini
    lines = [f"[{i}] {s['text']}" for i, s in enumerate(narration)]
    try:
        data = _call_gemini(PLAN_PROMPT, "\n".join(lines), api_key=api_key)
    except Exception as e:
        print(f"[Motion] Pemilihan animasi gagal: {e!r}")
        return 0
    return apply_picks(scenes, data.get("picks") if isinstance(data, dict) else None)


# ── Render ───────────────────────────────────────────────────

def available() -> bool:
    return os.path.isfile(TSX_CLI)


def render_overlays(items: list, workdir: str, callback=None) -> dict:
    """
    items: [{"id", "motion", "seconds"}]. Return {id: path .mov transparan}.
    Adegan yang gagal tidak ada di hasil, dan pemanggil merendernya tanpa animasi.
    """
    if not items or not available():
        if items:
            print("[Motion] Template belum terpasang (jalankan npm install di folder motion). Adegan dirender tanpa animasi.")
        return {}
    jobs_path = os.path.join(workdir, "motion_jobs.json")
    jobs = [{**item["motion"], "id": item["id"], "seconds": round(item["seconds"], 2)} for item in items]
    with open(jobs_path, "w", encoding="utf-8") as f:
        json.dump({"outDir": os.path.abspath(workdir).replace("\\", "/"), "jobs": jobs}, f, ensure_ascii=False)
    done = {}
    try:
        process = subprocess.Popen(["node", TSX_CLI, "render.ts", os.path.abspath(jobs_path)], cwd=MOTION_DIR, text=True,
                                   encoding="utf-8", errors="replace", stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    except OSError as e:
        print(f"[Motion] Node tidak bisa dijalankan: {e}")
        return {}
    timer = None
    try:
        import threading
        timer = threading.Timer(SECONDS_PER_JOB * len(jobs) + 120, process.kill)
        timer.start()
        for line in process.stdout:
            line = line.strip()
            if line.startswith("OK "):
                job_id = line[3:].strip()
                path = os.path.join(workdir, f"{job_id}.mov")
                if os.path.isfile(path):
                    done[job_id] = path
                if callback:
                    callback(len(done), len(jobs))
            elif line.startswith("FAIL "):
                print(f"[Motion] {line[:240]}")
        process.wait()
    finally:
        if timer:
            timer.cancel()
    return done
