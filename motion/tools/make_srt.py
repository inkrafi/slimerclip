"""Subtitle .srt dari naskah dan kata.json hasil align_words.py.

Pakai: python make_srt.py <naskah.txt> <kata.json> <out.srt>
Teksnya tetap dari naskah, jadi tanda baca, angka, dan istilah tidak ikut salah dengar.
"""
import json
import sys

MAX_LINE = 42
MAX_LINES = 2
MAX_SECONDS = 6.0
MIN_SECONDS = 1.0
SENTENCE_END = (".", "?", "!")


def stamp(seconds: float) -> str:
    ms = round(seconds * 1000)
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def wrap(tokens: list) -> list:
    """Satu cue menjadi maksimal dua baris dengan panjang yang seimbang."""
    text = " ".join(tokens)
    if len(text) <= MAX_LINE:
        return [text]
    best = min(range(1, len(tokens)), key=lambda i: abs(len(" ".join(tokens[:i])) - len(" ".join(tokens[i:]))))
    return [" ".join(tokens[:best]), " ".join(tokens[best:])]


def cues(tokens: list, times: list) -> list:
    groups, current = [], []
    for i, token in enumerate(tokens):
        current.append(i)
        text = " ".join(tokens[j] for j in current)
        ahead = f"{text} {tokens[i + 1]}" if i + 1 < len(tokens) else text
        too_long = len(ahead) > MAX_LINE * MAX_LINES or times[i]["e"] - times[current[0]]["s"] >= MAX_SECONDS
        if token.endswith(SENTENCE_END) or too_long:
            groups.append(current)
            current = []
    if current:
        groups.append(current)
    result = []
    for n, group in enumerate(groups):
        start = times[group[0]]["s"]
        end = times[group[-1]]["e"]
        following = times[groups[n + 1][0]]["s"] if n + 1 < len(groups) else end + MIN_SECONDS
        end = min(max(end, start + MIN_SECONDS), following)
        result.append((start, end, wrap([tokens[j] for j in group])))
    return result


def main():
    script, words, out = sys.argv[1:4]
    tokens = open(script, encoding="utf-8").read().split()
    times = json.load(open(words, encoding="utf-8"))
    if len(tokens) != len(times):
        raise SystemExit(f"Naskah {len(tokens)} kata, kata.json {len(times)} kata. Keduanya harus dari naskah yang sama.")
    items = cues(tokens, times)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        for n, (start, end, lines) in enumerate(items, 1):
            f.write(f"{n}\n{stamp(start)} --> {stamp(end)}\n" + "\n".join(lines) + "\n\n")
    print(f"{len(items)} subtitle, baris terpanjang {max(len(l) for _, _, ls in items for l in ls)} karakter")


if __name__ == "__main__":
    main()
