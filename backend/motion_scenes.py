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
# Khusus video channel yang digambar penuh (backend/klik_render.py)
KLIK_TEMPLATES = ("ledger", "number", "share", "verdict", "picture", "choice")
PICTURES = ("phone", "tire", "bowl", "wallet", "laptop")
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


def _number(value) -> int | float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or abs(number) >= 1e13:
        return None
    return int(number) if number == int(number) else round(number, 2)


def _sanitize_klik(template: str, raw: dict) -> dict | None:
    if template == "ledger":
        rows = []
        for item in raw.get("rows") if isinstance(raw.get("rows"), list) else []:
            label, value = _text(item.get("label"), 24) if isinstance(item, dict) else "", _number(item.get("value")) if isinstance(item, dict) else None
            if label and value is not None and value >= 0:
                rows.append({"label": label, "value": value})
        title = _text(raw.get("title"), 50)
        if len(rows) < 2 or not title:
            return None
        start = _number(raw.get("start")) or 0
        return {"template": template, "title": title, "rows": rows[:6], "start": start if start > 0 else 0,
                "prefix": _text(raw.get("prefix"), 8), "suffix": _text(raw.get("suffix"), 12), "result": _text(raw.get("result"), 20)}
    if template == "number":
        value, label = _number(raw.get("value")), _text(raw.get("label"), 50)
        if value is None or not label:
            return None
        return {"template": template, "label": label, "value": value, "prefix": _text(raw.get("prefix"), 8), "suffix": _text(raw.get("suffix"), 12),
                "note": _text(raw.get("note"), 70), "tone": "bad" if raw.get("tone") == "bad" else "plain"}
    if template == "share":
        percent, label = _number(raw.get("percent")), _text(raw.get("label"), 50)
        if percent is None or not 0 < percent <= 100 or not label:
            return None
        return {"template": template, "label": label, "percent": percent, "note": _text(raw.get("note"), 70)}
    if template == "verdict":
        question, answer = _text(raw.get("question"), 40), _text(raw.get("answer"), 20)
        return {"template": template, "question": question, "answer": answer} if question and answer else None
    if template == "picture":
        title = _text(raw.get("title"), 40)
        if raw.get("name") not in PICTURES or not title:
            return None
        return {"template": template, "name": raw["name"], "title": title, "note": _text(raw.get("note"), 70), "screen": _text(raw.get("screen"), 16)}
    options = _texts(raw.get("options"), 24, 6)
    title = _text(raw.get("title"), 50)
    if len(options) < 2 or not title:
        return None
    pick = raw.get("pick") if isinstance(raw.get("pick"), int) and 0 <= raw["pick"] < len(options) else 0
    return {"template": template, "title": title, "options": options, "pick": pick, "result": _text(raw.get("result"), 50)}


def sanitize(raw) -> dict | None:
    """Isi animasi yang aman; None kalau tanpa animasi atau isinya tidak cukup."""
    if not isinstance(raw, dict) or raw.get("template") not in TEMPLATES + KLIK_TEMPLATES:
        return None
    template = raw["template"]
    if template in KLIK_TEMPLATES:
        return _sanitize_klik(template, raw)
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


KLIK_PLAN_PROMPT = """
Kamu editor motion graphic. Dari daftar narasi bernomor, pilih animasi layar penuh untuk HAMPIR SEMUA adegan.
Template:
- ledger: narasi menyebut 2-6 pos dengan nominal. title, rows [{label, value}], start (nilai awal jika ada yang dikurangi, kalau tidak 0), prefix ("Rp"), result ("Sisa" atau "Total"). value angka penuh, mis. 3 juta = 3000000.
- number: satu angka yang harus menonjol. label, value, prefix, suffix, note, tone ("bad" untuk kabar buruk, selain itu "plain").
- share: narasi menyebut persentase. label, percent, note.
- data: minimal dua angka yang berubah dari waktu ke waktu. title, values, prefix, suffix, caption, note.
- verdict: narasi membantah sebuah anggapan. question (maks 40 karakter), answer (kata stempel, maks 20 karakter).
- picture: gagasan yang cocok diberi gambar. name ("phone", "tire" untuk sesuatu yang pelan-pelan habis, "bowl" untuk makan, "wallet" untuk uang, "laptop" untuk kerja atau teknologi), title, note, screen (teks layar ponsel).
- choice: ajakan memilih satu dari beberapa hal. title, options (2-6), pick (nomor mulai 0), result.
- compare: dua hal dibandingkan. left dan right, masing-masing title dan items (1-3).
- flow: 2-4 langkah berurutan. title dan steps (head maks 22 karakter, body maks 40 karakter).
- kinetic: satu gagasan yang perlu ditegaskan. lead (opsional), words (1-3 baris, tiap baris maks 24 karakter), note (opsional).
Aturan:
- Isi HANYA dari narasi adegan itu. Jangan menambah fakta, angka, atau contoh baru.
- Variasikan: jangan pakai template yang sama dua kali berturut-turut. Sekitar satu dari lima adegan dibiarkan tanpa animasi supaya video latarnya terlihat.
- Bahasa Indonesia lisan, singkat, tanpa emoji.
Kembalikan HANYA JSON: {"picks": [{"scene": 0, "motion": {"template": "number", "label": "", "value": 0, "prefix": "", "suffix": "", "note": "", "tone": "plain"}}]}
"""

SCALES = {"ribu": 1e3, "rb": 1e3, "juta": 1e6, "jt": 1e6, "miliar": 1e9, "triliun": 1e12}


def _spoken_numbers(text: str) -> set:
    """Angka di narasi, termasuk bentuk lisan seperti 2,5 juta menjadi 2500000."""
    found = {d.replace(".", "").replace(",", "") for d in re.findall(r"\d[\d.,]*\d|\d", text)}
    for number, scale in re.findall(r"(\d[\d.,]*)\s*(ribu|rb|juta|jt|miliar|triliun)", text.lower()):
        try:
            value = float(number.replace(".", "").replace(",", ".")) * SCALES[scale]
        except ValueError:
            continue
        found.add(str(int(round(value))))
    return found


def _motion_values(motion: dict) -> list:
    template = motion["template"]
    if template == "data":
        return motion["values"]
    if template == "ledger":
        return [r["value"] for r in motion["rows"]] + ([motion["start"]] if motion.get("start") else [])
    if template == "number":
        return [motion["value"]]
    if template == "share":
        return [motion["percent"]]
    return []


def values_in_text(motion: dict, text: str) -> bool:
    """Angka di animasi harus benar-benar diucapkan di narasi."""
    spoken = _spoken_numbers(text)
    return all(str(abs(v)).replace(".", "") in spoken for v in _motion_values(motion))


def apply_picks(scenes: list, picks, dense: bool = False) -> int:
    """Pasang pilihan AI ke adegan narasi yang belum punya animasi. Return jumlah yang terpasang."""
    narration = [s for s in scenes if s["kind"] == "narration"]
    added, last = 0, -2
    for item in sorted((p for p in (picks if isinstance(picks, list) else []) if isinstance(p, dict) and isinstance(p.get("scene"), int)),
                       key=lambda p: p["scene"]):
        index = item["scene"]
        if not 0 <= index < len(narration) or (index - last < 2 and not dense) or narration[index].get("motion"):
            continue
        motion = sanitize(item.get("motion"))
        if motion and values_in_text(motion, narration[index]["text"]):
            narration[index]["motion"] = motion
            last = index
            added += 1
    return added


def plan(scenes: list, api_key: str | None = None, full: bool = False) -> int:
    """Pilih animasi untuk adegan narasi lewat Gemini. Kalau gagal, adegan tetap memakai video latar saja."""
    narration = [s for s in scenes if s["kind"] == "narration"]
    if not narration:
        return 0
    from gemini_service import _call_gemini
    lines = [f"[{i}] {s['text']}" for i, s in enumerate(narration)]
    try:
        data = _call_gemini(KLIK_PLAN_PROMPT if full else PLAN_PROMPT, "\n".join(lines), api_key=api_key)
    except Exception as e:
        print(f"[Motion] Pemilihan animasi gagal: {e!r}")
        return 0
    return apply_picks(scenes, data.get("picks") if isinstance(data, dict) else None, dense=full)


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
