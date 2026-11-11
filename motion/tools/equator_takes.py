"""Narasi The Equator Ledger per paragraf: buat beberapa versi, pilih yang paling hidup, atur jedanya.

Pakai:
    python equator_takes.py <folder video> [--jatah N] [--pilih-saja] [--uji]

    --jatah N      batas permintaan TTS sekali jalan (bawaan 60)
    --pilih-saja   tidak membuat suara baru, hanya memilih dari versi yang sudah ada
    --uji          hasil ditulis ke suara/uji/ dan cek-versi-uji.txt, file video tidak ditimpa

Alurnya:
1. Paragraf yang belum punya suara dibuat satu versi.
2. Paragraf yang salah ucap dibuat ulang, sampai 3 versi.
3. Paragraf kunci selalu dibuat 3 versi: paragraf pertama tiap bab dan paragraf yang memakai [jeda].
4. Dari versi yang ucapannya paling akurat, dipilih yang intonasinya paling hidup (rentang nada dan
   variasi keras-pelan), bukan versi pertama. Versi yang temponya jauh dari versi lain dibuang dulu.
5. Jeda diatur dari waktu kata: tanda [jeda] di naskah menjadi diam 0,8 detik (atau [jeda 1.2] untuk
   1,2 detik), sedangkan jeda lain yang lebih dari 0,7 detik dipendekkan menjadi 0,45 detik.

Pilihan bisa ditimpa manual lewat suara/pilihan-manual.json, misalnya {"0_2": "b0_p02_t1.wav"}.
Berhenti total begitu ada tanda kena batas (429) atau dua kali habis waktu berturut-turut, supaya kuota
tidak terbuang.
"""
import glob
import json
import os
import re
import subprocess
import sys
import threading

import numpy as np
from scipy.io import wavfile

B = r"D:\User\www\slimerclip\backend"
T = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [B, T]
import align_words as aw  # noqa: E402

VOICE = {"voice": "voice_746ecuqzzudk",
         "style": "A calm, confident documentary narrator with natural pacing and clear pauses. Speak in English, "
                  "like a business journalist telling a surprising story to a friend. Pronounce every word clearly, "
                  "especially negatives and numbers."}
MAX_TAKES = 3
PARAGRAPH_GAP = 0.42   # jeda antarparagraf
JEDA = 0.8             # lama [jeda] tanpa angka
LONG_GAP = 0.7         # jeda tanpa tanda yang lebih panjang dari ini dipendekkan
SHORT_GAP = 0.45       # menjadi sepanjang ini
TEMPO_LIMIT = 0.12     # versi yang durasinya beda lebih dari 12% dari median dianggap terlalu cepat/lambat
MARKER = re.compile(r"\[jeda(?:\s+([\d.]+))?\]")


def parse(text):
    """Pisahkan tanda [jeda] dari kata. Hasil: teks bersih untuk TTS, kata naskah, dan {indeks kata: lama jeda}."""
    words, pauses = [], {}
    for m in re.finditer(MARKER.pattern + r"|\S+", text):
        if m.group(0).startswith("[jeda"):
            if words:
                pauses[len(words) - 1] = float(m.group(1)) if m.group(1) else JEDA
        else:
            words.append(m.group(0))
    return " ".join(words), words, pauses


def liveliness(path):
    """Skor intonasi: rentang nada (semiton, rentang antarkuartil) ditambah sedikit variasi keras-pelan (dB).

    Nada dicari per 40 ms dengan autokorelasi di 70–320 Hz, hanya pada bagian bersuara. Rentang antarkuartil
    dipakai supaya lonjakan salah oktaf tidak ikut dihitung.
    """
    rate, data = wavfile.read(path)
    x = data.astype(np.float32)
    if x.ndim > 1:
        x = x.mean(axis=1)
    x /= (np.abs(x).max() or 1)
    frame, hop = int(0.04 * rate), int(0.02 * rate)
    lo, hi = int(rate / 320), int(rate / 70)
    pitches, levels = [], []
    for start in range(0, len(x) - frame, hop):
        f = x[start:start + frame] - x[start:start + frame].mean()
        energy = float(np.sqrt((f * f).mean()))
        if energy < 0.02:
            continue
        ac = np.correlate(f, f, mode="full")[frame - 1:]
        if ac[0] <= 0:
            continue
        window = ac[lo:hi] / ac[0]
        peak = float(window.max())
        if peak < 0.45:   # tidak cukup periodik, bukan bunyi bersuara
            continue
        # Ambil periode terpendek yang hampir setinggi puncak, supaya kelipatan periode (salah oktaf) tidak terpilih
        lag = lo + int(np.argmax(window >= 0.9 * peak))
        pitches.append(12 * np.log2(rate / lag))
        levels.append(20 * np.log10(energy))
    if len(pitches) < 10:
        return 0.0
    # Haluskan lonjakan satu-dua bingkai
    pitches = [float(np.median(pitches[max(0, i - 2):i + 3])) for i in range(len(pitches))]
    iqr = lambda v: float(np.subtract(*np.percentile(v, [75, 25])))  # noqa: E731
    return round(iqr(pitches) + 0.15 * iqr(levels), 3)


def retime(path, words, pauses, heard, out):
    """Atur jeda di dalam paragraf dari waktu kata, lalu tulis ke out. Mengembalikan jeda tambahan di akhir."""
    rate, data = wavfile.read(path)
    times = aw.align(heard, words) if heard else []
    edits = []   # (titik potong dalam sampel, perubahan dalam sampel: positif = sisip diam, negatif = buang)
    for i in range(len(times) - 1):
        gap = times[i + 1]["s"] - times[i]["e"]
        target = pauses.get(i)
        if target is None and gap > LONG_GAP:
            target = SHORT_GAP
        if target is None or gap < 0:
            continue
        mid = int((times[i]["e"] + gap / 2) * rate)
        change = int((target - gap) * rate)
        if change < 0:   # buang dari tengah celah, sisakan bagian pinggir supaya akhir kata tidak terpotong
            change = max(change, -int(max(0.0, gap - 0.1) * rate))
        edits.append((mid, change))
    parts, cursor = [], 0
    for mid, change in edits:
        if change >= 0:
            parts += [data[cursor:mid], np.zeros(change, dtype=data.dtype)]
            cursor = mid
        else:
            half = -change // 2
            parts.append(data[cursor:mid - half])
            cursor = mid - half - change
    parts.append(data[cursor:])
    wavfile.write(out, rate, np.concatenate(parts))
    return pauses.get(len(words) - 1, 0.0)


class Stop(Exception):
    pass


def main():
    args = sys.argv[1:]
    folder = os.path.abspath(args[0])
    budget = int(args[args.index("--jatah") + 1]) if "--jatah" in args else 60
    pick_only = "--pilih-saja" in args
    test = "--uji" in args

    takes_dir = os.path.join(folder, "suara", "takes")
    out_dir = os.path.join(folder, "suara", "uji" if test else "")
    olah_dir = os.path.join(out_dir, "olah")
    os.makedirs(takes_dir, exist_ok=True)
    os.makedirs(olah_dir, exist_ok=True)

    script = open(os.path.join(folder, "naskah.md"), encoding="utf-8").read().replace("\r\n", "\n")
    blocks = re.findall(r"### Narasi\n\n(.*?)\n\n---", script, flags=re.S)
    paragraphs = []
    for c, block in enumerate(blocks):
        for p, raw in enumerate(block.split("\n\n")):
            text, words, pauses = parse(raw)
            key = p == 0 or bool(pauses)
            paragraphs.append({"c": c, "p": p, "text": text, "words": words, "pauses": pauses, "key": key})

    state = {"used": 0, "timeouts": 0}
    synthesize = None

    def takes_of(c, p):
        return sorted(glob.glob(os.path.join(takes_dir, f"b{c}_p{p:02}_t*.wav")))

    def synth(par):
        nonlocal synthesize
        if pick_only:
            raise Stop("mode --pilih-saja")
        if state["used"] >= budget:
            raise Stop(f"jatah {budget} permintaan habis")
        if synthesize is None:
            synthesize = load_tts()
        c, p = par["c"], par["p"]
        t = len(takes_of(c, p))
        path = os.path.join(takes_dir, f"b{c}_p{p:02}_t{t}.wav")
        res = {}

        def run():
            try:
                res["d"] = synthesize(par["text"], VOICE, path, None)
            except Exception as e:
                res["e"] = f"{type(e).__name__}: {str(e)[:300]}"

        state["used"] += 1
        th = threading.Thread(target=run, daemon=True)
        th.start()
        th.join(100)
        if "d" in res:
            state["timeouts"] = 0
            print(f"ok b{c}_p{p:02}_t{t} ({state['used']}/{budget})", flush=True)
            return path
        message = res.get("e", "TIMEOUT")
        print(f"gagal b{c}_p{p:02}_t{t}: {message}", flush=True)
        if "429" in message or "RESOURCE_EXHAUSTED" in message or "quota" in message.lower():
            raise Stop("kena batas kuota (429)")
        state["timeouts"] += 1
        if state["timeouts"] >= 2:
            raise Stop("dua kali berturut-turut tidak dijawab, kemungkinan kena batas")
        return None

    model = aw.WhisperModel("small", device="cpu", compute_type="int8")
    cache_path = os.path.join(folder, "suara", "takes-cek.json")
    cache = json.load(open(cache_path, encoding="utf-8")) if os.path.exists(cache_path) else {}

    def check(path, words):
        """Akurasi ucapan, skor intonasi, durasi, dan waktu kata. Disimpan per file supaya tidak dihitung ulang."""
        name = os.path.basename(path)
        stamp = f"{os.path.getmtime(path):.0f}"
        if cache.get(name, {}).get("stamp") == stamp:
            return cache[name]
        segments, _ = model.transcribe(path, language="en", word_timestamps=True)
        heard = [{"w": w.word.strip(), "s": w.start, "e": w.end} for seg in segments for w in seg.words]
        said = [aw.norm(h["w"]) for h in heard]
        script_words = [aw.norm(w) for w in words]
        bad = 0
        for tag, a1, a2, b1, b2 in aw.difflib.SequenceMatcher(a=script_words, b=said, autojunk=False).get_opcodes():
            # Angka yang ditulis Whisper sebagai digit ("60%" untuk "sixty percent") tidak dihitung salah
            if tag != "equal" and not any(re.search(r"\d", x) for x in said[b1:b2]):
                bad += max(a2 - a1, b2 - b1)
        rate, data = wavfile.read(path)
        cache[name] = {"stamp": stamp, "bad": bad, "live": liveliness(path), "dur": round(len(data) / rate, 3), "heard": heard}
        return cache[name]

    stopped = None
    try:
        for par in paragraphs:
            if not takes_of(par["c"], par["p"]):
                synth(par)
        for par in paragraphs:
            while len(takes_of(par["c"], par["p"])) < MAX_TAKES:
                best = min(check(t, par["words"])["bad"] for t in takes_of(par["c"], par["p"]))
                if best < 2 and not par["key"]:
                    break
                if not synth(par):
                    break
    except Stop as e:
        stopped = str(e)
        if not pick_only:
            print("Pembuatan suara dihentikan:", e, flush=True)
    json.dump(cache, open(cache_path, "w", encoding="utf-8"), ensure_ascii=False)

    missing = [f"b{p['c']}_p{p['p']:02}" for p in paragraphs if not takes_of(p["c"], p["p"])]
    print(f"Permintaan terpakai: {state['used']}. Paragraf tanpa suara: {len(missing)} dari {len(paragraphs)}", flush=True)
    if missing:
        print("BERHENTI:", stopped or "masih ada paragraf kosong", flush=True)
        os._exit(2)

    manual_path = os.path.join(folder, "suara", "pilihan-manual.json")
    manual = json.load(open(manual_path, encoding="utf-8")) if os.path.exists(manual_path) else {}
    picked, report, listen = {}, [], []
    for par in paragraphs:
        c, p = par["c"], par["p"]
        options = [(t, check(t, par["words"])) for t in takes_of(c, p)]
        least = min(o["bad"] for _, o in options)
        accurate = [(t, o) for t, o in options if o["bad"] <= least]
        if len(accurate) >= 3:
            median = float(np.median([o["dur"] for _, o in accurate]))
            steady = [(t, o) for t, o in accurate if abs(o["dur"] - median) / median <= TEMPO_LIMIT]
            accurate = steady or accurate
        chosen = max(accurate, key=lambda a: a[1]["live"])[0]
        how = "intonasi"
        if f"{c}_{p}" in manual:
            chosen, how = os.path.join(takes_dir, manual[f"{c}_{p}"]), "manual"
        picked[f"{c}_{p}"] = os.path.basename(chosen)
        detail = ", ".join(f"t{os.path.basename(t)[-5]} beda {o['bad']} hidup {o['live']}" for t, o in options)
        flag = " [kunci]" if par["key"] else ""
        report.append(f"bab{c} p{p:02}{flag} -> {os.path.basename(chosen)} ({how}) | {detail}")
        if par["key"] and how != "manual":
            listen.append(f"bab{c} p{p:02}: {par['text'][:70]}...")

    suffix = "-uji" if test else ""
    with open(os.path.join(folder, f"cek-versi{suffix}.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(report) + "\n\nDENGAR MANUAL (paragraf kunci, timpa lewat suara/pilihan-manual.json kalau kurang pas):\n")
        f.write("\n".join(listen) + "\n")
    json.dump(picked, open(os.path.join(out_dir, "pilihan.json"), "w"), indent=0)

    for c, block in enumerate(blocks):
        pars = [par for par in paragraphs if par["c"] == c]
        inputs, chain = [], []
        for i, par in enumerate(pars):
            src = os.path.join(takes_dir, picked[f"{c}_{par['p']}"])
            olah = os.path.join(olah_dir, os.path.basename(src))
            tail = retime(src, par["words"], par["pauses"], cache[os.path.basename(src)]["heard"], olah)
            gap = (PARAGRAPH_GAP + tail) if i < len(pars) - 1 else 0
            inputs += ["-i", olah]
            chain.append(f"[{i}:a]aresample=24000,aformat=channel_layouts=mono,apad=pad_dur={gap}[a{i}]")
        graph = ";".join(chain) + ";" + "".join(f"[a{i}]" for i in range(len(pars))) + f"concat=n={len(pars)}:v=0:a=1[o]"
        subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", graph, "-map", "[o]", "-c:a", "pcm_s16le",
                        os.path.join(out_dir, f"bab{c}.wav")], check=True)
    print("SELESAI", flush=True)
    os._exit(0)


def load_tts():
    """Klien Gemini tanpa percobaan ulang tersembunyi dari SDK, supaya batas kuota terlihat."""
    from dotenv import load_dotenv
    load_dotenv(os.path.join(B, ".env"))
    import gemini_service
    import longform
    from google import genai
    from google.genai import types
    gemini_service._client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"),
                                          http_options=types.HttpOptions(timeout=90000, retry_options=types.HttpRetryOptions(attempts=1)))
    longform.TTS_MODEL = os.getenv("EQUATOR_TTS_MODEL", "gemini-3.8-flash-tts")
    return longform.synthesize


if __name__ == "__main__":
    main()
