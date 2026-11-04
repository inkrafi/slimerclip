"""Waktu per kata untuk klik.ts, dari rekaman apa pun (suara sendiri atau sintetis).

Pakai: python align_words.py <suara> <naskah.txt> <kata.json>
Whisper memberi waktunya, sedangkan teksnya tetap dari naskah, jadi subtitle dan cue tidak ikut salah dengar.
"""
import difflib
import json
import re
import sys

from faster_whisper import WhisperModel


def norm(word: str) -> str:
    return re.sub(r"[^\w]", "", word.lower())


def align(heard: list, tokens: list) -> list:
    """Kata naskah yang tidak terdengar mendapat waktu dari kata terdekat, dibagi rata di celahnya."""
    matcher = difflib.SequenceMatcher(a=[norm(h["w"]) for h in heard], b=[norm(t) for t in tokens], autojunk=False)
    times = [None] * len(tokens)
    for block in matcher.get_matching_blocks():
        for i in range(block.size):
            times[block.b + i] = (heard[block.a + i]["s"], heard[block.a + i]["e"])
    i = 0
    while i < len(tokens):
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(tokens) and times[j] is None:
            j += 1
        start = times[i - 1][1] if i else 0.0
        end = times[j][0] if j < len(tokens) else heard[-1]["e"]
        step = max(0.02, (end - start) / (j - i))
        for k in range(i, j):
            times[k] = (start + (k - i) * step, start + (k - i + 1) * step)
        i = j
    return [{"w": re.sub(r"[.,?!]+$", "", tok), "s": round(s, 3), "e": round(e, 3), "p": tok[-1] in ".,?!"}
            for tok, (s, e) in zip(tokens, times)]


def main():
    audio, script, out = sys.argv[1:4]
    tokens = open(script, encoding="utf-8").read().split()
    segments, _ = WhisperModel("small", device="cpu", compute_type="int8").transcribe(audio, language="id", word_timestamps=True)
    heard = [{"w": w.word.strip(), "s": w.start, "e": w.end} for seg in segments for w in seg.words]
    words = align(heard, tokens)
    matched = sum(a == b for a, b in zip(sorted(norm(h["w"]) for h in heard), sorted(norm(t) for t in tokens)))
    json.dump(words, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"{len(words)} kata naskah, {len(heard)} terdengar. Whisper: {' '.join(h['w'] for h in heard)}")


if __name__ == "__main__":
    main()
