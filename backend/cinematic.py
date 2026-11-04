"""
Preset Cinematic: warna sinematik, zoom ke pembicara, teks kata kunci menggantikan caption per kata,
nama pembicara, dan angka besar.

Teks ("beat") selalu diambil verbatim dari transkrip: AI hanya memilih indeks kata, tidak menulis teks sendiri,
jadi tidak ada kata yang dikarang dan waktunya tetap tepat. Kalau AI gagal, dipakai pemilihan lokal.
Waktu beat disimpan dalam detik video sumber (seperti efek suara), jadi tetap benar saat rentang klip digeser.
"""
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

DEFAULT = {"enabled": False, "grade": 70, "zoom": True, "name": "", "role": "", "beats": [], "scenes": [],
           "glitch": True, "sfx": True}

SERIF = "Instrument Serif"
SANS = "Poppins SemiBold"
BOLD = "Poppins ExtraBold"
ZOOM_FPS = 30
ZOOM_EASE = 0.16
ZOOM_LEVELS = (0.10, 0.16)
ZOOM_NUMBER = 0.2
ZOOM_MIN_WINDOW = 1.2

# Kata yang tidak layak jadi teks besar di awal atau akhir frasa (selain STOPWORDS)
_WEAK_EDGE = frozenset("bukan bahkan hampir seperti nya mana maka lalu kemudian terus memang cuma hanya sangat banget sekali begitu gitu".split())
_GAP_SECONDS = 3.0    # jeda tanpa teks lebih panjang dari ini diisi pemilihan lokal
_DIGIT_RE = re.compile(r"\d")
_NUMBER_RE = re.compile(r"\d[\d.,]*%?")
_TAGS_RE = re.compile(r"[{}\\\r\n]")


def _text(value, limit: int) -> str:
    return re.sub(r"\s+", " ", _TAGS_RE.sub(" ", str(value or ""))).strip()[:limit]


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and abs(number) != float("inf") else None


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
        })
    beats.sort(key=lambda b: b["start"])
    return {
        "enabled": bool(raw.get("enabled", False)),
        "grade": int(max(0, min(100, grade))) if grade is not None else DEFAULT["grade"],
        "zoom": bool(raw.get("zoom", DEFAULT["zoom"])),
        "name": _text(raw.get("name"), NAME_MAX_CHARS),
        "role": _text(raw.get("role"), ROLE_MAX_CHARS),
        "beats": beats[:MAX_BEATS],
        "scenes": cinematic_scenes.sanitize(raw.get("scenes")),
        "glitch": bool(raw.get("glitch", DEFAULT["glitch"])),
        "sfx": bool(raw.get("sfx", DEFAULT["sfx"])),
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


def _make_beat(words: list, first: int, main_from: int, last: int) -> dict:
    main = _join(words[main_from:last + 1])
    return {
        "start": round(words[first]["start"], 3),
        "end": round(words[last]["end"], 3),
        "lead": _join(words[first:main_from]),
        "main": main,
        "kind": "number" if _DIGIT_RE.search(main) else "phrase",
    }


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
            beats.append(_make_beat(words, *tidy))
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


AI_PROMPT = """
Kamu editor video pendek bergaya sinematik. Dari kata-kata bernomor, pilih frasa yang muncul sebagai teks besar.
Tiap beat punya kata pengantar kecil (opsional) dan kata utama besar, misalnya pengantar "entah itu", utama "pivot pendidikan".
Aturan:
- Pilih hanya berdasarkan nomor kata. Jangan menulis atau mengubah teks.
- start_word <= main_word <= end_word. Beat berurutan dan tidak tumpang tindih.
- Satu beat paling banyak 6 kata dan berada dalam satu kalimat. Kata utama 1 sampai 3 kata yang paling bermakna.
- Kata utama harus utuh maknanya saat dibaca sendiri, dan tidak diawali atau diakhiri kata sambung seperti dan, atau, jadi, itu, saya.
- Utamakan angka, usia, nama, dan istilah kunci sebagai kata utama.
- Isi sebagian besar ucapan penting; lewati kata pengisi. Target satu beat tiap 2 sampai 4 detik.
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
            beats.append(_make_beat(words, *tidy))
    return _settle(beats[:MAX_BEATS])


def plan_beats(segments: list, api_key: str | None = None) -> list:
    """Beat untuk transkrip (waktu mengikuti transkrip yang diberikan): AI, atau pemilihan lokal kalau AI gagal."""
    words = flat_words(segments)
    if not words:
        return []
    try:
        from gemini_service import _call_gemini
        numbered = " ".join(f"[{i}]{word['text']}" for i, word in enumerate(words))
        data = _call_gemini(AI_PROMPT, json.dumps({"words": numbered}, ensure_ascii=False), api_key=api_key, schema=_schema())
        beats = beats_from_indexes(data.get("beats") if isinstance(data, dict) else None, words)
        if beats:
            return fill_gaps(beats, words)
    except Exception as e:
        print(f"[Cinematic] Pemilihan AI gagal, memakai pemilihan lokal: {e!r}")
    return local_beats(words)


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


def zoom_windows(beats: list, duration: float) -> list:
    """Jendela zoom (awal, akhir, tambahan zoom): berselang-seling supaya gambar tidak terus membesar."""
    windows, step = [], 0
    for i, beat in enumerate(beats):
        start, end = max(0.0, beat["start"]), min(duration, beat["end"])
        if windows and start < windows[-1][1] + 0.4:
            continue
        if beat["kind"] == "number":
            amount = ZOOM_NUMBER
        elif i % 2 == 0:
            continue    # beat genap pada framing normal
        else:
            amount = ZOOM_LEVELS[step % len(ZOOM_LEVELS)]
            step += 1
        end = min(duration, max(end, start + ZOOM_MIN_WINDOW))
        if end - start >= 0.5:
            windows.append((round(start, 2), round(end, 2), amount))
    return windows


def zoom_filter(beats: list, duration: float, width: int, height: int) -> str | None:
    windows = zoom_windows(beats, duration)
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


def overlay_ass(cinematic: dict, beats: list, duration: float, y: int = 1180, font_override: str | None = None,
                scenes: list | None = None) -> str | None:
    """File ASS untuk beat dan nama pembicara. beats dan scenes sudah relatif terhadap awal klip."""
    events = []
    glow = r"\bord4\3c&H000000&\3a&H70&\shad0\blur9"
    serif = font_override or SERIF
    sans = font_override or SANS
    bold = font_override or BOLD
    italic = 0 if font_override else 1
    for beat in beats:
        start, end = beat["start"], min(duration, beat["end"])
        if end - start < 0.12:
            continue
        # Di dalam adegan, teks mengikuti bentuk adegan itu
        look = cinematic_scenes.look_at(scenes or [], start + min(0.2, (end - start) / 2))
        beat_y = cinematic_scenes.TEXT_Y.get(look, y)
        intro = rf"\an5\pos(540,{beat_y}){glow}\fad(70,90)\fscx107\fscy107\t(0,240,0.6,\fscx100\fscy100)"
        if beat["kind"] == "number":
            main = number_text(beat["main"])
            main_tags = rf"\fn{bold}\i0\fs{_main_size(main, 0.62, 200)}\c&HFFFFFF&"
            lead_tags = rf"\fn{serif}\i{italic}\fs92\c&HFFFFFF&"
        else:
            main = _wrap(beat["main"])
            main_tags = rf"\fn{serif}\i{italic}\fs{_main_size(_longest_line(main), 0.4, 190)}\c&HFFFFFF&"
            lead_tags = rf"\fn{sans}\i0\fs56\c&HFFFFFF&"
        lead = "{" + lead_tags + "}" + beat["lead"] + r"\N" if beat["lead"] else ""
        events.append(f"Dialogue: 1,{_ass_time(start)},{_ass_time(end)},Default,,0,0,0,,"
                      "{" + intro + "}" + lead + "{" + main_tags + "}" + main)

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
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{sans},60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    return header + "\n".join(events) + "\n"


def relative_beats(beats: list, start_sec: float, duration: float) -> list:
    """Beat tersimpan (detik video sumber) → relatif awal klip; yang di luar rentang dibuang."""
    out = []
    for beat in beats or []:
        start, end = beat["start"] - start_sec, beat["end"] - start_sec
        if end > 0.1 and start < duration - 0.1:
            out.append({**beat, "start": max(0.0, start), "end": min(duration, end)})
    return out
