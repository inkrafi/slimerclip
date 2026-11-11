"""Gabungkan narasi per bab The Equator Ledger, cek terhadap naskah, lalu buat kata.json, narasi, dan subtitle.

Pakai:
    python equator_narasi.py <folder video>

Jalankan setelah equator_takes.py membuat suara/bab*.wav. Hasilnya:
- kata.json      waktu tiap kata naskah (dipakai storyboard untuk memicu adegan)
- cek-narasi.txt kata yang terdengar berbeda dari naskah, untuk didengar ulang
- narasi-rafi.m4a narasi lengkap dengan ruang untuk title sting dan chapter card
- video.srt      subtitle bahasa Inggris, teksnya dari naskah (tanda [jeda] dibuang)
"""
import json
import os
import re
import subprocess
import sys

T = os.path.dirname(os.path.abspath(__file__))
B = r"D:\User\www\slimerclip\backend"
sys.path[:0] = [B, T]
import align_words as aw  # noqa: E402
import make_srt  # noqa: E402
from equator_takes import parse  # noqa: E402

STING_GAP = 3.0     # ruang title sting setelah cold open
CHAPTER_GAP = 2.0   # ruang chapter card antar bab


def wav_duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def main():
    folder = os.path.abspath(sys.argv[1])
    out = os.path.join(folder, "suara")
    script = open(os.path.join(folder, "naskah.md"), encoding="utf-8").read().replace("\r\n", "\n")
    blocks = re.findall(r"### Narasi\n\n(.*?)\n\n---", script, flags=re.S)

    model = aw.WhisperModel("small", device="cpu", compute_type="int8")
    times, tokens, cursor, parts, report = [], [], 0.0, [], []
    for i, block in enumerate(blocks):
        wav = os.path.join(out, f"bab{i}.wav")
        words = [w for raw in block.split("\n\n") for w in parse(raw)[1]]
        segments, _ = model.transcribe(wav, language="en", word_timestamps=True)
        heard = [{"w": w.word.strip(), "s": w.start, "e": w.end} for seg in segments for w in seg.words]
        aligned = aw.align(heard, words)
        matcher = aw.difflib.SequenceMatcher(a=[aw.norm(t) for t in words], b=[aw.norm(h["w"]) for h in heard], autojunk=False)
        for tag, a1, a2, b1, b2 in matcher.get_opcodes():
            if tag != "equal":
                at = heard[min(b1, len(heard) - 1)]["s"]
                report.append(f"bab{i} {at:6.1f} dtk | naskah: {' '.join(words[a1:a2])} | terdengar: {' '.join(h['w'] for h in heard[b1:b2])}")
        duration = wav_duration(wav)
        times += [{"w": item["w"], "s": round(item["s"] + cursor, 3), "e": round(item["e"] + cursor, 3)} for item in aligned]
        tokens += words
        parts.append((wav, cursor))
        print(f"bab{i}: {duration:.1f} dtk, mulai {cursor:.1f}", flush=True)
        cursor += duration + (STING_GAP if i == 0 else CHAPTER_GAP if i < len(blocks) - 1 else 0)

    json.dump(times, open(os.path.join(folder, "kata.json"), "w", encoding="utf-8"), ensure_ascii=False)
    open(os.path.join(folder, "cek-narasi.txt"), "w", encoding="utf-8").write("\n".join(report) + "\n")
    print("BEDA", len(report), flush=True)
    print("\n".join(report), flush=True)

    inputs, filt = [], []
    for n, (wav, start) in enumerate(parts):
        inputs += ["-i", wav]
        filt.append(f"[{n}:a]aresample=48000,adelay={round(start * 1000)}:all=1[a{n}]")
    filt.append("".join(f"[a{n}]" for n in range(len(parts))) + f"amix=inputs={len(parts)}:normalize=0,aformat=channel_layouts=stereo[out]")
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(filt), "-map", "[out]", "-c:a", "aac", "-b:a", "192k",
                    os.path.join(folder, "narasi-rafi.m4a")], check=True)
    items = make_srt.cues(tokens, times)
    with open(os.path.join(folder, "video.srt"), "w", encoding="utf-8", newline="\n") as f:
        for n, (start, end, lines) in enumerate(items, 1):
            f.write(f"{n}\n{make_srt.stamp(start)} --> {make_srt.stamp(end)}\n" + "\n".join(lines) + "\n\n")
    print("SRT", len(items), "subtitle, total", round(cursor, 1), "dtk", flush=True)
    os._exit(0)


if __name__ == "__main__":
    main()
