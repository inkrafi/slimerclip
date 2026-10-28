"""
Terjemahan subtitle klip (mis. klip berbahasa Inggris dengan subtitle Indonesia).

Whisper memberi kalimat beserta waktu tiap kata dalam bahasa aslinya. Kalimat diterjemahkan Gemini (satu panggilan
per klip, jumlah & urutan kalimat dipertahankan), lalu waktu kata hasil terjemahan dipetakan ke urutan
kata-kata aslinya: jeda bicara tetap jeda, jadi subtitle muncul bersamaan dengan ucapannya walau susunan kata
kedua bahasa berbeda. Sorotan per kata (karaoke) jadi perkiraan; batas kalimat tetap akurat.
"""
import json

import clip_profile

PROMPT = """
Kamu penerjemah subtitle video pendek (TikTok/Shorts/Reels). Terjemahkan setiap baris ke bahasa {LANG}.
- Bahasa lisan yang natural untuk penutur asli, bukan terjemahan kaku kata per kata; ringkas agar enak dibaca cepat.
- Pertahankan nama orang, merek, angka, dan istilah teknis yang lazim tidak diterjemahkan.
- Jumlah dan urutan baris HARUS sama dengan input: satu baris input = satu baris output, jangan digabung atau dipecah.
- Jangan menambah penjelasan, tanda kutip, atau catatan.
Kembalikan HANYA JSON: {"translations": ["...", "..."]}
"""


def _schema() -> dict:
    return {"type": "object", "properties": {"translations": {"type": "array", "items": {"type": "string"}}},
            "required": ["translations"]}


def retime(words: list, tokens: list) -> list:
    """
    Petakan token terjemahan ke urutan kata asli: token ke-i menempati porsi i/m..(i+1)/m dari deretan kata asli
    (waktu bicara per kata), jadi jeda di antara kata asli tidak pernah diisi teks dan batas kalimat tetap akurat.
    """
    spans = [(w["start"], w["end"]) for w in words if w["end"] > w["start"]]
    if not spans or not tokens:
        return []
    n, m = len(spans), len(tokens)

    def at(pos):
        """Detik video pada posisi `pos` (0..n) di deretan kata asli."""
        k = min(int(pos), n - 1)
        a, b = spans[k]
        return a + (b - a) * min(1.0, pos - k)

    out = []
    for i, token in enumerate(tokens):
        start, end = at(i * n / m), at((i + 1) * n / m)
        out.append({"start": round(start, 3), "end": round(max(start + 0.05, end), 3), "word": " " + token})
    return out


def translate_segments(segments: list, target: str, api_key: str | None = None) -> list:
    """Segmen Whisper [{start, end, text, words}] → segmen yang sama dalam bahasa target. ValueError jika gagal."""
    from gemini_service import _call_gemini
    lines = [s.get("text", "").strip() for s in segments]
    if not any(lines):
        return segments
    prompt = PROMPT.replace("{LANG}", clip_profile.LANGUAGES.get(target, target))
    data = _call_gemini(prompt, json.dumps({"lines": lines}, ensure_ascii=False), api_key=api_key, schema=_schema())
    translations = data.get("translations") if isinstance(data, dict) else None
    if not isinstance(translations, list) or len(translations) != len(lines):
        raise ValueError(f"Jumlah baris terjemahan tidak sesuai ({len(translations or [])} dari {len(lines)})")
    out = []
    for seg, text in zip(segments, translations):
        text = str(text or "").strip()
        words = retime(seg.get("words") or [], text.split())
        if words:
            out.append({"start": words[0]["start"], "end": words[-1]["end"], "text": text, "words": words})
    return out
