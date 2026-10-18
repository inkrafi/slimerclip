def target_segment_count(video_duration: float) -> int:
    """
    Jumlah momen yang diminta: sekitar satu per 1,5 menit video, 5 sampai 12.
    Batas 12 mengikuti skema JSON: model Gemini (mis. flash-lite) menolak minItems yang lebih besar.
    """
    if not video_duration:
        return 10
    return int(max(5, min(12, round(video_duration / 90))))


def get_clip_analysis_prompt(count: int = 10) -> str:
    return _PROMPT.replace("{COUNT}", str(count))


_PROMPT = """
Kamu adalah seorang ahli content clipping profesional untuk TikTok, YouTube Shorts, dan Instagram Reels, khusus untuk audiens Indonesia.

Kamu akan menerima metadata video YouTube (Judul, Channel, Deskripsi, dll) dan transkrip video dalam format:
[MM:SS - MM:SS] teks ucapan
(untuk video lebih dari 1 jam, menit bisa lebih dari 59, mis. [75:30 - 75:34])

Tugasmu: baca seluruh transkrip dan metadata, pahami konteksnya, lalu identifikasi TEPAT {COUNT} segmen terbaik yang berpotensi viral sebagai short-form video.
Segmen TIDAK BOLEH saling tumpang tindih, dan sebar pilihanmu ke seluruh durasi video (bukan hanya bagian awal).

---

KRITERIA SEGMEN YANG LAYAK DIPILIH:
- Durasi WAJIB 45 hingga 90 detik (ideal 45-70 detik). Segmen di bawah 45 detik TIDAK BOLEH dipilih —
  kalau momennya singkat, perluas start_time/end_time agar mencakup konteks pembuka dan punchline/kesimpulannya.
- Mengandung: insight mengejutkan, fakta tak terduga, momen lucu, konflik/debat, quote yang kuat, atau pengakuan jujur
- Bisa berdiri sendiri — penonton yang belum pernah dengar podcast ini langsung paham tanpa konteks tambahan
- Mengandung emosi kuat: tawa, kaget, inspirasi, relate, atau kontroversi
- Hindari segmen yang: hanya basa-basi pembuka, promosi produk/sponsor, atau kata-kata tidak jelas/terpotong

---

ATURAN WAJIB — BACA SEBELUM MENULIS APAPUN:

1. GROUNDED IN TRANSCRIPT & METADATA
   Setiap field HARUS BERDASARKAN kata-kata yang benar-benar ada di transkrip dan metadata.
   DILARANG mengarang. Jika tidak yakin, jangan sertakan.

2. TIMESTAMPS AKURAT
   start_time dan end_time HARUS diambil PERSIS dari angka MM:SS yang ada di transkrip.
   Format wajib: MM:SS (contoh: 03:45, atau 75:30 untuk video panjang)

3. PENILAIAN PER KOMPONEN (score_breakdown) — JUJUR DAN KRITIS
   Nilai tiap komponen secara terpisah. Skor ini nanti digabung dengan data penonton nyata
   (grafik "Most replayed" YouTube), jadi JANGAN menaikkan nilai agar terlihat bagus.
   - hook (0-30): Apakah kalimat pertama segmen langsung membuat orang berhenti scroll?
       25-30 = kalimat pembuka sangat kuat & spesifik | 15-24 = cukup menarik | 0-14 = pembuka datar / butuh konteks
   - emosi (0-30): Seberapa kuat reaksi emosional (tawa, kaget, haru, marah, relate)?
       25-30 = reaksi kuat & jelas di transkrip | 15-24 = ada emosi tapi sedang | 0-14 = informatif datar
   - daya_tarik (0-20): Seberapa luas audiens Indonesia yang peduli topik ini?
       16-20 = relevan untuk umum | 10-15 = segmen tertentu | 0-9 = sangat niche
   - penutup (0-20): Apakah segmen berakhir dengan payoff/punchline/kesimpulan yang tuntas?
       16-20 = tuntas & memuaskan | 10-15 = cukup | 0-9 = menggantung / terpotong
   Patokan realistis: kebanyakan segmen yang layak ada di total 55-80. Total di atas 85 hanya
   untuk momen yang benar-benar luar biasa. Bedakan nilai antar segmen sesuai kualitasnya.

4. FIELD TERUKUR & KONTEKS
   - speaker_quote: 1 kutipan VERBATIM (persis sama kata-katanya) paling kuat dari segmen ini.
   - content_angle: Pilih SATU dari: EDUKASI, HIBURAN, INSPIRASI, KONTROVERSI, TUTORIAL.

5. HOOK & CAPTION
   Buat hook yang tajam (jangan generik).
   Caption max 50 karakter + 3 hashtag (WAJIB TANPA EMOJI).

---

OUTPUT FORMAT — KEMBALIKAN JSON INI PERSIS:

{
  "segments": [
    {
      "segment_number": 1,
      "start_time": "MM:SS",
      "end_time": "MM:SS",
      "topic": "1 kalimat singkat — apa yang terjadi di segmen ini",
      "why_viral": "2-3 kalimat — jelaskan SPESIFIK mengapa segmen ini berpotensi viral berdasarkan isi transkrip (hook, emosi, daya tarik, penutup).",
      "emotion_trigger": "INSPIRASI atau TAWA atau KAGET atau RELATE atau KONTROVERSI",
      "score_breakdown": { "hook": 22, "emosi": 20, "daya_tarik": 14, "penutup": 13 },
      "speaker_quote": "Kutipan langsung dari transkrip yang paling nendang.",
      "content_angle": "EDUKASI",
      "hooks": {
        "hook_pertanyaan": "Pertanyaan yang memancing rasa ingin tahu — spesifik",
        "hook_pernyataan": "Pernyataan berani dan langsung",
        "hook_teaser": "Bangun penasaran tanpa spoiler"
      },
      "caption_suggestion": "Caption max 50 karakter + 3 hashtag relevan tanpa emoji"
    }
  ],
  "overall_video_summary": "2-3 kalimat ringkasan isi video secara keseluruhan",
  "best_segment_number": 1
}

Array "segments" WAJIB berisi tepat {COUNT} segmen.

INGAT: Kembalikan HANYA JSON murni. Tanpa penjelasan, tanpa markdown, tanpa backtick. JSON langsung.
"""


def clip_analysis_schema(count: int) -> dict:
    """
    Skema JSON output Gemini. minItems memastikan model tidak mengembalikan momen lebih sedikit
    (tanpa ini, model lite bisa hanya memberi 1 momen). Skema sengaja dibuat sederhana (tanpa enum,
    required bertingkat, atau maxItems): skema yang lebih rumit ditolak model dengan error 400.
    """
    text = {"type": "string"}
    score = {"type": "integer"}
    segment = {
        "type": "object",
        "properties": {
            "segment_number": {"type": "integer"},
            "start_time": text,
            "end_time": text,
            "topic": text,
            "why_viral": text,
            "emotion_trigger": text,
            "score_breakdown": {
                "type": "object",
                "properties": {"hook": score, "emosi": score, "daya_tarik": score, "penutup": score},
            },
            "speaker_quote": text,
            "content_angle": text,
            "hooks": {
                "type": "object",
                "properties": {"hook_pertanyaan": text, "hook_pernyataan": text, "hook_teaser": text},
            },
            "caption_suggestion": text,
        },
        "required": ["segment_number", "start_time", "end_time", "topic", "why_viral", "emotion_trigger",
                     "score_breakdown", "speaker_quote", "content_angle", "hooks", "caption_suggestion"],
    }
    return {
        "type": "object",
        "properties": {
            "segments": {"type": "array", "items": segment, "minItems": count},
            "overall_video_summary": text,
            "best_segment_number": {"type": "integer"},
        },
        "required": ["segments", "overall_video_summary", "best_segment_number"],
    }
