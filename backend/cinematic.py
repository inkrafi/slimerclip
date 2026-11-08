"""
Preset Cinematic: warna sinematik, zoom ke pembicara, teks kata kunci menggantikan caption per kata,
nama pembicara, dan angka besar.

Teks ("beat") diambil dari transkrip: AI hanya memilih indeks kata, jadi tidak ada kalimat yang dikarang dan waktunya tetap tepat.
Kata yang salah dengar boleh dikoreksi lebih dulu, asal ejaannya masih mirip. Kalau AI gagal, dipakai pemilihan lokal.
Waktu beat disimpan dalam detik video sumber (seperti efek suara), jadi tetap benar saat rentang klip digeser.
"""
import difflib
import json
import re

import cinematic_scenes
from caption_styles import STOPWORDS

MAX_BEATS = 60
MAIN_MAX_CHARS = 40
LEAD_MAX_CHARS = 50
NAME_MAX_CHARS = 40
ROLE_MAX_CHARS = 50
BEAT_KINDS = ("phrase", "number")

DEFAULT = {"enabled": False, "grade": 70, "highlight": "#F57C1A", "name": "", "role": "", "beats": [], "scenes": []}

SERIF = "Instrument Serif"
SANS = "Poppins SemiBold"
BOLD = "Poppins ExtraBold"
ZOOM_FPS = 30
ZOOM_EASE = 0.16
ZOOM_LEVELS = (0.10, 0.16)

# Ukuran font di ASS mengacu ke tinggi baris. Poppins bertinggi baris ±1,4 kali ukurannya, jadi hurufnya tampil lebih kecil
# dari nilai fs. Karena itu batas ukuran di bawah terlihat besar dan lebar per karakternya kecil.
WHITE = "&HFFFFFF&"
LAYOUTS = ("stack", "caps", "duo", "serif", "stack", "hero")
TAIL_MAX_WORDS = 5
# Kata umum yang tidak layak jadi kata raksasa, walau boleh tampil sebagai teks biasa
WEAK_BIG_WORDS = frozenset("pernah sudah udah sekarang lagi mau bisa gak nggak tidak ada kayak gitu gini emang memang banget juga".split())
REPEAT_SECONDS = 8.0      # teks utama yang sama dalam jarak ini tidak ditampilkan lagi
FIX_MIN_SIMILARITY = 0.35
FIX_MAX_SHARE = 0.25

# Kata yang tidak layak jadi teks besar di awal atau akhir frasa (selain STOPWORDS)
_WEAK_EDGE = frozenset("bukan bahkan hampir seperti nya mana maka lalu kemudian terus memang cuma hanya sangat banget sekali begitu gitu".split())
_GAP_SECONDS = 1.6    # jeda tanpa teks lebih panjang dari ini diisi pemilihan lokal
_DIGIT_RE = re.compile(r"\d")
_NUMBER_RE = re.compile(r"\d[\d.,]*%?")
_TAGS_RE = re.compile(r"[{}\\\r\n]")
_HEX_RE = re.compile(r"#[0-9a-fA-F]{6}")
WORD_FADE_MS = 110      # lama tiap kata muncul
WORD_GAP_SECONDS = 0.22 # jarak antar kata kalau waktunya tidak diketahui, misalnya teks yang sudah diedit
TIMES_MAX = 16


def _text(value, limit: int) -> str:
    return re.sub(r"\s+", " ", _TAGS_RE.sub(" ", str(value or ""))).strip()[:limit]


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and abs(number) != float("inf") else None


def _clean_times(raw) -> dict:
    """Waktu tiap kata per baris teks: {"times": {"lead": [...], "main": [...], "tail": [...]}}."""
    if not isinstance(raw, dict):
        return {}
    times = {}
    for key in ("lead", "main", "tail"):
        values = [_number(v) for v in raw.get(key)[:TIMES_MAX]] if isinstance(raw.get(key), list) else []
        if values and all(v is not None and v >= 0 for v in values):
            times[key] = [round(v, 3) for v in values]
    return {"times": times} if times else {}


def sanitize(raw) -> dict:
    """Pengaturan Cinematic yang aman dipakai FFmpeg dan ASS. Nilai tidak valid diganti bawaan."""
    raw = raw if isinstance(raw, dict) else {}
    grade = _number(raw.get("grade"))
    beats = []
    for item in raw.get("beats") if isinstance(raw.get("beats"), list) else []:
        if not isinstance(item, dict):
            continue
        start, end = _number(item.get("start")), _number(item.get("end"))
        main = _text(item.get("main"), MAIN_MAX_CHARS)
        if start is None or end is None or start < 0 or end <= start or not main:
            continue
        beats.append({
            "start": round(start, 3),
            "end": round(end, 3),
            "lead": _text(item.get("lead"), LEAD_MAX_CHARS),
            "main": main,
            "kind": item.get("kind") if item.get("kind") in BEAT_KINDS else "phrase",
            "tail": _text(item.get("tail"), LEAD_MAX_CHARS),
            **_clean_times(item.get("times")),
            **{key: round(_number(item.get(key)), 3) for key in ("main_at", "tail_at") if _number(item.get(key)) is not None},
        })
    beats.sort(key=lambda b: b["start"])
    return {
        "enabled": bool(raw.get("enabled", False)),
        "grade": int(max(0, min(100, grade))) if grade is not None else DEFAULT["grade"],
        "highlight": raw["highlight"].upper() if isinstance(raw.get("highlight"), str) and _HEX_RE.fullmatch(raw["highlight"]) else DEFAULT["highlight"],
        "name": _text(raw.get("name"), NAME_MAX_CHARS),
        "role": _text(raw.get("role"), ROLE_MAX_CHARS),
        "beats": beats[:MAX_BEATS],
        "scenes": cinematic_scenes.sanitize(raw.get("scenes")),
    }


# ── Memilih teks ─────────────────────────────────────────────

def flat_words(segments: list) -> list:
    """Kata transkrip berurutan: [{start, end, text}]. Tanda baca di ujung kata dibuang."""
    words = []
    for segment in segments or []:
        for word in segment.get("words") or []:
            text = _text(word.get("word"), 60)
            clean = text.rstrip(".,;:!?")
            if clean:
                words.append({"start": float(word["start"]), "end": float(word["end"]), "text": clean,
                              "stop": text[-1:] in ".?!"})
    return words


def _join(words: list) -> str:
    out = ""
    for word in words:
        glued = not out or word["text"][:1] in "-.,!?;:%)]}'’…" or out[-1:] in "-([{"
        out += word["text"] if glued else " " + word["text"]
    return out


def _weak(word: dict) -> bool:
    text = word["text"].lower().strip("?!\"'")
    return (text in STOPWORDS or text in _WEAK_EDGE) and not _DIGIT_RE.search(text)


def _tidy(words: list, first: int, main_from: int, last: int) -> tuple | None:
    """
    Rapikan pilihan kata: beat tidak melewati akhir kalimat, teks besar paling banyak 3 kata, dan tidak diawali atau
    diakhiri kata sambung ("melotot dan" → "melotot"). None kalau tidak tersisa kata yang layak ditonjolkan.
    """
    for i in range(first, last):
        if words[i]["stop"]:
            if i >= main_from:
                last = i
                break
            first = i + 1
    while main_from <= last and _weak(words[main_from]):
        main_from += 1
    last = min(last, main_from + 2)
    # Kata sambung di tengah berarti dua pikiran; teks besar cukup pikiran pertama
    for i in range(main_from + 1, last + 1):
        if _weak(words[i]):
            last = i - 1
            break
    while last >= main_from and _weak(words[last]):
        last -= 1
    return (first, main_from, last) if main_from <= last else None


def _make_beat(words: list, first: int, main_from: int, last: int, group_end: int | None = None) -> dict:
    """group_end: kata terakhir kelompok ini. Kata setelah teks utama menjadi teks penutup kecil."""
    main = _join(words[main_from:last + 1])
    tail_end = last
    if group_end is not None and not words[last]["stop"]:
        for i in range(last + 1, min(group_end, last + TAIL_MAX_WORDS) + 1):
            tail_end = i
            if words[i]["stop"]:
                break
    if tail_end == last + 1:    # satu kata seperti "ya" atau "tuh" tidak perlu baris sendiri
        tail_end = last
    beat = {
        "start": round(words[first]["start"], 3),
        "end": round(words[tail_end]["end"], 3),
        "lead": _join(words[first:main_from]),
        "main": main,
        "kind": "number" if _DIGIT_RE.search(main) else "phrase",
        "main_at": round(words[main_from]["start"], 3),
        "times": {"lead": [round(w["start"], 3) for w in words[first:main_from]], "main": [round(w["start"], 3) for w in words[main_from:last + 1]]},
    }
    if tail_end > last:
        beat["tail"] = _join(words[last + 1:tail_end + 1])
        beat["tail_at"] = round(words[last + 1]["start"], 3)
        beat["times"]["tail"] = [round(w["start"], 3) for w in words[last + 1:tail_end + 1]]
    return beat


def drop_repeats(beats: list) -> list:
    """Teks utama yang baru saja tampil tidak perlu muncul lagi: pembicara sering mengulang kata yang sama."""
    out, seen = [], {}
    for beat in beats:
        key = beat["main"].strip().lower()
        if beat["start"] - seen.get(key, -REPEAT_SECONDS - 1) >= REPEAT_SECONDS:
            out.append(beat)
            seen[key] = beat["start"]
    return out


def _settle(beats: list) -> list:
    """Teks bertahan sampai sebelum beat berikutnya (paling lama 0,6 dtk setelah kata terakhir), tanpa tumpang tindih."""
    for i, beat in enumerate(beats):
        limit = beats[i + 1]["start"] if i + 1 < len(beats) else beat["end"] + 0.6
        beat["end"] = round(min(beat["end"] + 0.6, limit), 3)
    return beats


def local_beats(words: list, max_words: int = 4) -> list:
    """Tanpa AI: kelompokkan kata per frasa pendek; kata bermakna terakhir (atau angka) jadi teks besar."""
    groups, group = [], []
    for i, word in enumerate(words):
        glued = word["text"][:1] in "-.,!?;:%)]}'’…"     # Whisper memecah "nada-nada" jadi "nada" + "-nada"
        if group and not glued and (len(group) >= max_words or words[group[-1]]["stop"]
                                    or word["start"] - words[group[-1]]["end"] > 0.6):
            groups.append(group)
            group = []
        group.append(i)
    if group:
        groups.append(group)
    beats = []
    for ids in groups:
        main_from = next((i for i in ids if _DIGIT_RE.search(words[i]["text"])), None)
        if main_from is None:
            meaningful = [i for i in ids if not _weak(words[i])]
            if not meaningful:
                continue    # hanya kata sambung: tidak perlu teks di layar
            main_from = meaningful[-1]
            # Dua kata bermakna yang berdampingan dibaca sebagai satu frasa ("situasi tenang")
            if main_from - 1 in meaningful:
                main_from -= 1
        tidy = _tidy(words, ids[0], main_from, ids[-1])
        if tidy:
            beats.append(_make_beat(words, *tidy, ids[-1]))
    return _settle(beats[:MAX_BEATS])


def fill_gaps(beats: list, words: list) -> list:
    """Isi jeda panjang yang dilewati AI dengan pemilihan lokal, supaya layar tidak lama tanpa teks saat orang bicara."""
    if not beats:
        return local_beats(words)
    edges = [(-1.0, beats[0]["start"])]
    edges += [(a["end"], b["start"]) for a, b in zip(beats, beats[1:])]
    edges.append((beats[-1]["end"], words[-1]["end"] + 1))
    extra = []
    for lo, hi in edges:
        if hi - lo < _GAP_SECONDS:
            continue
        inside = [w for w in words if w["start"] >= lo and w["end"] <= hi]
        if inside:
            extra += local_beats(inside)
    # Beat lokal sudah diperpanjang sendiri; akhirnya dihitung ulang supaya tidak menimpa beat berikutnya
    return _settle(sorted(beats + extra, key=lambda b: b["start"])[:MAX_BEATS])


FIX_PROMPT = """
Kamu korektor transkrip otomatis percakapan berbahasa Indonesia. Baca seluruh kata bernomor dan pahami topiknya.
Cari kata yang jelas salah dengar, yaitu tidak masuk akal di kalimatnya, lalu tulis kata yang sebenarnya diucapkan.
Aturan:
- Hanya perbaiki kalau yakin. Kalau ragu, biarkan.
- Ejaan perbaikan harus mirip bunyinya dengan kata aslinya. Satu nomor diganti satu kata.
- Jangan mengubah gaya bahasa, kata gaul, atau kata asing yang sudah benar. Jangan menambah atau menghapus kata.
Kembalikan HANYA JSON: {"fixes": [{"index": 0, "text": "..."}]}
"""


def apply_fixes(words: list, fixes) -> list:
    """Terapkan koreksi yang ejaannya masih mirip. Terlalu banyak koreksi berarti AI menulis ulang, jadi semuanya diabaikan."""
    clean = {}
    for item in fixes if isinstance(fixes, list) else []:
        index, text = item.get("index") if isinstance(item, dict) else None, item.get("text") if isinstance(item, dict) else None
        if not isinstance(index, int) or isinstance(index, bool) or not 0 <= index < len(words) or not isinstance(text, str):
            continue
        text = _text(text, 60).rstrip(".,;:!?")
        old = words[index]["text"]
        if text and " " not in text and text.lower() != old.lower() and difflib.SequenceMatcher(None, old.lower(), text.lower()).ratio() >= FIX_MIN_SIMILARITY:
            clean[index] = text
    if len(clean) > max(3, len(words) * FIX_MAX_SHARE):
        return words
    return [{**word, "text": clean[i]} if i in clean else word for i, word in enumerate(words)]


def correct_words(words: list, api_key: str | None = None) -> list:
    """Betulkan kata yang salah dengar. Waktu kata tidak berubah, dan kalau AI gagal transkrip dipakai apa adanya."""
    try:
        from gemini_service import _call_gemini
        numbered = " ".join(f"[{i}]{word['text']}" for i, word in enumerate(words))
        data = _call_gemini(FIX_PROMPT, json.dumps({"words": numbered}, ensure_ascii=False), api_key=api_key)
        return apply_fixes(words, data.get("fixes") if isinstance(data, dict) else None)
    except Exception as e:
        print(f"[Cinematic] Koreksi transkrip gagal: {e!r}")
        return words


AI_PROMPT = """
Kamu editor video pendek bergaya sinematik. Dari kata-kata bernomor, pilih frasa yang muncul sebagai teks besar.
Tiap beat punya kata pengantar kecil (opsional), kata utama besar, dan kata penutup kecil (opsional),
misalnya pengantar "cuman", utama "tiga hal", penutup "yang lu harus lakuin".
Aturan:
- Pilih hanya berdasarkan nomor kata. Jangan menulis atau mengubah teks.
- start_word <= main_word <= end_word. Beat berurutan dan tidak tumpang tindih.
- Satu beat paling banyak 8 kata dan berada dalam satu kalimat. Kata utama 1 sampai 3 kata yang paling bermakna.
- start_word sampai main_word adalah pengantar. Kata setelah kata utama sampai end_word adalah penutup. Kata utama berakhir paling lambat 2 kata setelah main_word.
- Kata utama harus utuh maknanya saat dibaca sendiri, dan tidak diawali atau diakhiri kata sambung seperti dan, atau, jadi, itu, saya.
- Utamakan angka, usia, nama, dan istilah kunci sebagai kata utama.
- Isi sebagian besar ucapan; lewati kata pengisi saja. Target satu beat tiap 1,5 sampai 3 detik, supaya teks terus berganti.
Kembalikan HANYA JSON: {"beats": [{"start_word": 0, "main_word": 2, "end_word": 3}]}
"""


def _schema() -> dict:
    index = {"type": "integer"}
    return {"type": "object", "required": ["beats"], "properties": {"beats": {"type": "array", "items": {
        "type": "object", "required": ["start_word", "main_word", "end_word"],
        "properties": {"start_word": index, "main_word": index, "end_word": index}}}}}


def beats_from_indexes(items, words: list) -> list:
    """Ubah pilihan nomor kata menjadi beat; pilihan yang tidak valid atau tumpang tindih dibuang."""
    beats, cursor = [], 0
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        first, main, last = item.get("start_word"), item.get("main_word"), item.get("end_word")
        if not all(isinstance(v, int) and not isinstance(v, bool) for v in (first, main, last)):
            continue
        if not cursor <= first <= main <= last < len(words):
            continue
        cursor = last + 1
        first = max(first, main - 5)    # pilihan yang terlalu panjang dipendekkan, bukan dibuang
        tidy = _tidy(words, first, main, last)
        if tidy:
            beats.append(_make_beat(words, *tidy, last))
    return _settle(beats[:MAX_BEATS])


def plan_beats(segments: list, api_key: str | None = None) -> list:
    """Beat untuk transkrip (waktu mengikuti transkrip yang diberikan): AI, atau pemilihan lokal kalau AI gagal."""
    words = flat_words(segments)
    if not words:
        return []
    words = correct_words(words, api_key)
    try:
        from gemini_service import _call_gemini
        numbered = " ".join(f"[{i}]{word['text']}" for i, word in enumerate(words))
        data = _call_gemini(AI_PROMPT, json.dumps({"words": numbered}, ensure_ascii=False), api_key=api_key, schema=_schema())
        beats = beats_from_indexes(data.get("beats") if isinstance(data, dict) else None, words)
        if beats:
            return _settle(drop_repeats(fill_gaps(beats, words)))
    except Exception as e:
        print(f"[Cinematic] Pemilihan AI gagal, memakai pemilihan lokal: {e!r}")
    return _settle(drop_repeats(local_beats(words)))


# ── Video ────────────────────────────────────────────────────

def grade_filter(strength: int) -> str | None:
    """Warna sinematik: bayangan dingin, tengah dan terang sedikit hangat, kontras naik."""
    k = max(0, min(100, strength)) / 100
    if k <= 0:
        return None
    return (f"eq=contrast={1 + 0.22 * k:.3f}:brightness={-0.05 * k:.3f}:saturation={1 + 0.14 * k:.3f},"
            f"colorbalance=rs={-0.07 * k:.3f}:gs={-0.015 * k:.3f}:bs={0.08 * k:.3f}"
            f":rm={0.02 * k:.3f}:bm={-0.01 * k:.3f}"
            f":rh={0.05 * k:.3f}:gh={0.012 * k:.3f}:bh={-0.03 * k:.3f}")


def zoom_windows(scenes: list, duration: float) -> list:
    """Jendela zoom (awal, akhir, tambahan zoom) dari adegan zoom, bergantian dua kekuatan supaya tidak monoton."""
    windows = []
    for scene in scenes or []:
        if scene.get("look") == "zoom":
            start, end = max(0.0, scene["start"]), min(duration, scene["end"])
            if end - start >= 0.5:
                windows.append((round(start, 2), round(end, 2), ZOOM_LEVELS[len(windows) % len(ZOOM_LEVELS)]))
    return windows


def zoom_filter(scenes: list, duration: float, width: int, height: int) -> str | None:
    windows = zoom_windows(scenes, duration)
    if not windows:
        return None
    terms = "+".join(
        f"{amount}*clip((it-{start})/{ZOOM_EASE},0,1)*clip(({end}-it)/{ZOOM_EASE},0,1)"
        for start, end, amount in windows)
    # Sedikit ke atas dari tengah: wajah biasanya di sepertiga atas
    return (f"fps={ZOOM_FPS},zoompan=z='1+{terms}':d=1:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*0.36'"
            f":s={width}x{height}:fps={ZOOM_FPS}")


# ── Teks ─────────────────────────────────────────────────────

def _ass_time(seconds: float) -> str:
    cs = int(round(max(0.0, seconds) * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def _main_size(text: str, per_char: float, largest: int) -> int:
    return int(max(72, min(largest, 960 / max(1.0, len(text) * per_char))))


def number_text(main: str) -> str:
    """"20 sampai 25" → "20 — 25". Angka tunggal atau teks lain tetap apa adanya."""
    numbers = _NUMBER_RE.findall(main)
    if len(numbers) == 2 and re.fullmatch(r"\s*\S+\s*(sampai|hingga|to|-|–|—)?\s*\S+\s*", main):
        return f"{numbers[0]} — {numbers[1]}"
    return main


def _wrap(text: str) -> str:
    """Teks utama panjang dibagi dua baris supaya hurufnya tetap besar."""
    if len(text) <= 18 or " " not in text:
        return text
    middle = len(text) / 2
    spaces = [i for i, ch in enumerate(text) if ch == " "]
    cut = min(spaces, key=lambda i: abs(i - middle))
    return text[:cut] + r"\N" + text[cut + 1:]


def _longest_line(text: str) -> str:
    return max(text.split(r"\N"), key=len)


def beat_layout(beat: dict, index: int) -> str:
    """Bentuk teks bergantian supaya tiap kartu terasa beda, tapi selalu cocok dengan panjang teksnya."""
    main = beat["main"]
    if beat["kind"] == "number":
        return "hero"
    words = len(main.split())
    wanted = LAYOUTS[index % len(LAYOUTS)]
    if wanted == "hero" and (words > 1 or len(main) > 11):
        return "stack"
    if wanted == "caps" and len(main) > 16:
        return "stack"
    if wanted == "duo" and not beat.get("lead"):
        return "serif"
    return wanted


def layouts_for(beats: list) -> list:
    """Bentuk teks semua kartu dalam satu klip. Kata raksasa harus bermakna dan tidak dipakai dua kali."""
    layouts, used = [], set()
    for index, beat in enumerate(beats):
        layout = beat_layout(beat, index)
        word = beat["main"].strip().lower()
        if layout == "hero" and beat["kind"] != "number":
            if word in used or word in WEAK_BIG_WORDS:
                layout = "stack"
            else:
                used.add(word)
        layouts.append(layout)
    return layouts


def ass_color(hex_color: str) -> str:
    """#RRGGBB menjadi warna ASS, yang urutannya biru-hijau-merah."""
    value = hex_color.lstrip("#")
    return f"&H{value[4:6]}{value[2:4]}{value[0:2]}&".upper()


def beat_tiers(beat: dict, index: int, center: int, sans: str, bold: str, serif: str, italic: int, layout: str | None = None, color: str | None = None) -> list:
    """Baris teks satu kartu: pengantar kecil, teks utama, dan penutup kecil, masing-masing muncul saat diucapkan."""
    layout = layout or beat_layout(beat, index)
    color = color or ass_color(DEFAULT["highlight"])
    times = beat.get("times") or {}
    start = beat["start"]
    main_at = max(start, _number(beat.get("main_at")) or start)
    tail_at = max(main_at, _number(beat.get("tail_at")) or main_at)
    main = number_text(beat["main"]) if layout == "hero" and beat["kind"] == "number" else beat["main"]

    if layout == "serif":
        main = _wrap(main)
        size = _main_size(_longest_line(main), 0.4, 190)
        big = {"font": serif, "italic": italic, "color": WHITE, "spacing": 0}
    elif layout == "caps":
        main = _wrap(main.upper())
        size = _main_size(_longest_line(main), 0.56, 230)
        big = {"font": bold, "italic": 0, "color": WHITE, "spacing": -4}
    elif layout == "hero":
        main = _wrap(main)
        size = _main_size(_longest_line(main), 0.46, 340)
        big = {"font": bold, "italic": 0, "color": color, "spacing": -8 if " " not in main else -3}
    elif layout == "duo":
        main = _wrap(main)
        size = _main_size(_longest_line(main), 0.47, 250)
        big = {"font": bold, "italic": 0, "color": color, "spacing": -5 if " " not in main else -3}
    else:
        main = _wrap(main)
        size = _main_size(_longest_line(main), 0.47, 220)
        big = {"font": bold, "italic": 0, "color": color, "spacing": -4 if " " not in main else -2}

    lead_size, tail_size = 78, 62
    main_height = size * (main.count(r"\N") + 1) * (0.8 if layout != "serif" else 1.0)
    rows = []
    if beat.get("lead"):
        rows.append((lead_size * 0.8, {"text": beat["lead"], "font": sans, "italic": 0, "color": WHITE, "spacing": -1, "at": start, "size": lead_size, "times": times.get("lead")}))
    rows.append((main_height, {"text": main, "size": size, "at": main_at, "is_main": True, "times": times.get("main"), **big}))
    if beat.get("tail"):
        rows.append((tail_size * 0.8, {"text": beat["tail"], "font": sans, "italic": 0, "color": WHITE, "spacing": 0, "at": tail_at, "size": tail_size, "times": times.get("tail")}))
    gap = 10
    top = center - (sum(height for height, _ in rows) + gap * (len(rows) - 1)) / 2
    tiers = []
    for height, tier in rows:
        tier["y"] = int(top + height / 2)
        top += height + gap
        tiers.append(tier)
    return tiers


def word_times(words: list, tier: dict, end: float) -> list:
    """Kapan tiap kata muncul. Kalau teksnya sudah diedit dan jumlah katanya berubah, kata dibagi rata."""
    times = tier.get("times")
    if isinstance(times, list) and len(times) == len(words):
        return times
    return [min(tier["at"] + i * WORD_GAP_SECONDS, end - 0.12) for i in range(len(words))]


def _tier_event(tier: dict, start: float, end: float) -> str:
    """Satu baris teks. Tiap kata punya tempat tetap dan muncul dari blur saat diucapkan, jadi baris tidak bergeser."""
    tokens = re.split(r"( |\\N)", tier["text"])
    words = [t for t in tokens if t and t not in (" ", r"\N")]
    times = word_times(words, tier, end)
    at = max(0.0, min(min(times, default=tier["at"]), end - 0.12))
    span = int((end - at) * 1000)
    out = max(0, span - 130)
    head = (rf"\an5\pos(540,{tier['y']})\fad(0,110)\bord3\3c&H000000&\3a&H90&\shad0"
            rf"\fn{tier['font']}\i{tier['italic']}\fs{tier['size']}\c{tier['color']}\fsp{tier['spacing']}")
    text, index = "", 0
    for token in tokens:
        if token in (" ", r"\N") or not token:
            text += token
            continue
        shown = max(0, min(int(round((times[index] - at) * 1000)), span - 60))
        text += "{" + (rf"\alpha&HFF&\blur9\t({shown},{shown + WORD_FADE_MS},\alpha&H00&\blur1.2)\t({out},{span},\blur12)") + "}" + token
        index += 1
    return f"Dialogue: 1,{_ass_time(at)},{_ass_time(end)},Default,,0,0,0,," + "{" + head + "}" + text


def _ass_header(font: str) -> str:
    return f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font},60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def overlay_ass(cinematic: dict, beats: list, duration: float, y: int = 1180, font_override: str | None = None,
                scenes: list | None = None) -> str | None:
    """File ASS untuk beat dan nama pembicara. beats dan scenes sudah relatif terhadap awal klip."""
    events = []
    serif = font_override or SERIF
    sans = font_override or SANS
    bold = font_override or BOLD
    italic = 0 if font_override else 1
    layouts = layouts_for(beats)
    color = ass_color(cinematic.get("highlight") or DEFAULT["highlight"])
    for index, beat in enumerate(beats):
        start, end = beat["start"], min(duration, beat["end"])
        if end - start < 0.12:
            continue
        # Animasi mengisi seluruh layar dan punya teks sendiri: teks berhenti saat animasi mulai
        for scene in scenes or []:
            if scene.get("look") == "motion" and start < scene["end"] and end > scene["start"]:
                end = min(end, scene["start"])
        if end - start < 0.12:
            continue
        center = y
        for tier in beat_tiers(beat, index, center, sans, bold, serif, italic, layouts[index], color):
            events.append(_tier_event(tier, start, end))

    name, role = cinematic.get("name"), cinematic.get("role")
    if name and duration > 1:
        start, end = min(0.5, duration / 4), min(4.5, duration)
        x, top = 64, 1490
        motion = rf"\move({x - 28},{top},{x},{top},0,280)\fad(160,220)"
        name_glow = r"\bord3\3c&H000000&\3a&H80&\shad0\blur6"
        events.append(f"Dialogue: 2,{_ass_time(start)},{_ass_time(end)},Default,,0,0,0,,"
                      "{" + rf"\an7{motion}{name_glow}\fn{sans}\i0\fs52\c&HFFFFFF&" + "}" + name)
        if role:
            events.append(f"Dialogue: 2,{_ass_time(start + 0.08)},{_ass_time(end)},Default,,0,0,0,,"
                          "{" + rf"\an7\move({x - 28},{top + 66},{x},{top + 66},0,280)\fad(160,220){name_glow}\fn{sans}\i0\fs36\c&HE0E0E0&" + "}" + role)
    if not events:
        return None
    return _ass_header(sans) + "\n".join(events) + "\n"


def relative_beats(beats: list, start_sec: float, duration: float) -> list:
    """Beat tersimpan (detik video sumber) → relatif awal klip; yang di luar rentang dibuang."""
    out = []
    for beat in beats or []:
        start, end = beat["start"] - start_sec, beat["end"] - start_sec
        if end > 0.1 and start < duration - 0.1:
            shifted = {key: round(beat[key] - start_sec, 3) for key in ("main_at", "tail_at") if key in beat}
            if beat.get("times"):
                shifted["times"] = {key: [round(t - start_sec, 3) for t in values] for key, values in beat["times"].items()}
            out.append({**beat, **shifted, "start": max(0.0, start), "end": min(duration, end)})
    return out
