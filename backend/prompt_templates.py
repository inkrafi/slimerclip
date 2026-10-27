MIN_SEGMENTS = 8
MIN_CLIP_SECONDS = 45


def target_segment_count(video_duration: float) -> int:
    """
    Jumlah momen MAKSIMAL yang diminta: sekitar satu per menit video, 8 sampai 12; Gemini diminta minimal
    MIN_SEGMENTS. Video pendek dibatasi agar tiap momen tetap bisa 45 detik tanpa tumpang tindih.
    Batas 12 mengikuti skema JSON: model Gemini (mis. flash-lite) menolak minItems yang lebih besar.
    """
    if not video_duration:
        return 10
    fits = max(1, int(video_duration // MIN_CLIP_SECONDS))
    return int(min(fits, max(MIN_SEGMENTS, min(12, round(video_duration / 60)))))


def min_segment_count(count: int) -> int:
    return min(MIN_SEGMENTS, count)


def get_clip_analysis_prompt(count: int = 10) -> str:
    return _PROMPT.replace("{COUNT}", str(count)).replace("{MIN}", str(min_segment_count(count)))


_PROMPT = """
Kamu adalah seorang ahli content clipping profesional untuk TikTok, YouTube Shorts, dan Instagram Reels, khusus untuk audiens Indonesia.

Kamu akan menerima metadata video YouTube (Judul, Channel, Deskripsi, dll) dan transkrip video dalam format:
[MM:SS - MM:SS] teks ucapan
(untuk video lebih dari 1 jam, menit bisa lebih dari 59, mis. [75:30 - 75:34])

Tugasmu: baca seluruh transkrip dan metadata, pahami konteksnya, lalu identifikasi segmen terbaik yang berpotensi viral sebagai short-form video: MINIMAL {MIN}, maksimal {COUNT}.
Gali seluruh video sampai menemukan minimal {MIN} momen; tambah sampai {COUNT} hanya bila momennya memang layak.
Jangan memilih basa-basi pembuka atau promosi sponsor; nilai skornya dengan jujur (skor rendah tetap boleh dipilih).
Segmen TIDAK BOLEH saling tumpang tindih, dan sebar pilihanmu ke seluruh durasi video (bukan hanya bagian awal).

---

KRITERIA SEGMEN YANG LAYAK DIPILIH:
- Durasi WAJIB 45 hingga 90 detik (ideal 45-70 detik). Segmen di bawah 45 detik TIDAK BOLEH dipilih —
  kalau momennya singkat, perluas start_time/end_time agar mencakup konteks pembuka dan punchline/kesimpulannya.
- Mengandung: insight mengejutkan, fakta tak terduga, momen lucu, konflik/debat, quote yang kuat, atau pengakuan jujur
- Bisa berdiri sendiri — penonton yang belum pernah dengar podcast ini langsung paham tanpa konteks tambahan
- Mengandung emosi kuat: tawa, kaget, inspirasi, relate, atau kontroversi
- Momen yang benar-benar memancing tawa (candaan, cerita konyol, reaksi spontan) WAJIB ikut dipilih walaupun
  tidak edukatif — momen lucu sering justru yang paling banyak ditonton.
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
   - category: topik utama segmen, pilih SATU (huruf kecil) dari: bisnis, investasi, keuangan, marketing,
     karier, teknologi, pendidikan, mindset, kesehatan, hubungan, sosial, hiburan, komedi, lainnya.
       bisnis = usaha, entrepreneur, strategi perusahaan | investasi = saham, reksa dana, kripto, aset
       keuangan = gaji, menabung, utang, keuangan pribadi | marketing = digital marketing, konten, personal branding, jualan online
       karier = kerja, skill, produktivitas | teknologi = AI, gadget, perkembangan teknologi
       pendidikan = sekolah, cara belajar, berpikir kritis, sains, sejarah, filsafat, tokoh pemikir
       mindset = motivasi, pola pikir, kisah sukses | hiburan = gosip, selebriti, cerita hidup tanpa topik di atas
       komedi = HANYA bila segmen terutama lucu dan tidak membahas topik lain di daftar
       (candaan soal bisnis tetap "bisnis").

5. HOOK & CAPTION
   Hook = teks besar di 3-5 detik pertama, dibaca sekilas sebelum orang scroll. Aturan:
   - PENDEK: maksimal 6 kata (±35 karakter). Bahasa lisan sehari-hari, bukan kalimat berita.
   - Buka rasa penasaran (open loop) tanpa membocorkan jawaban/akhir ceritanya.
   - Spesifik ke isi segmen (angka, nama, situasi), jangan generik seperti "Kamu harus tahu ini".
   - Apit 1-2 kata kunci dengan bintang agar diberi warna, mis. "Gaji *2 juta* bisa beli rumah?"
   - Tanpa emoji, hashtag, atau tanda kutip.
   Caption max 50 karakter + 3 hashtag (WAJIB TANPA EMOJI).

6. JUDUL & DESKRIPSI UPLOAD
   Penonton Shorts tidak memilih video, mereka swipe; judul yang menang berbentuk cerita, konflik,
   atau tantangan ke penonton, bukan judul materi kelas.
   - short_title & title_options: maks 60 karakter, gaya cerita/konflik/rasa penasaran,
     mis. "Dulu Sopir Angkot, Sekarang Orang Terkaya di Indonesia!" atau "Masih 20-an Tapi Udah Santai? Salah Besar!".
   - JANGAN format "Topik | Nama Narasumber" dan jangan judul datar seperti "Apa itu Personal Branding?".
     Sebut nama hanya bila orangnya sangat terkenal dan namanya bagian dari cerita.
   - title_options: 3 judul dengan sudut berbeda (cerita, pertanyaan menantang, angka/fakta mengejutkan).
   - upload_description: 1-2 kalimat konteks yang membuat orang menonton sampai habis, tanpa hashtag & emoji.
   - hashtags: 3 hashtag relevan huruf kecil tanpa spasi (1 topik luas mis. #bisnis, 2 spesifik), tanpa #shorts.

---

OUTPUT FORMAT — KEMBALIKAN JSON INI PERSIS:

{
  "segments": [
    {
      "segment_number": 1,
      "start_time": "MM:SS",
      "end_time": "MM:SS",
      "topic": "1 kalimat singkat — apa yang terjadi di segmen ini",
      "thumbnail_text": "Teks thumbnail 1-3 kata, BEDA dari judul, bikin penasaran; apit 1 kata kunci dengan bintang, mis. 'Ditolak *1 MILIAR*'",
      "short_title": "Judul YouTube Shorts maks 60 karakter gaya cerita/konflik (lihat aturan 6), tanpa emoji, hashtag, atau tanda kutip",
      "title_options": ["Judul cerita", "Judul pertanyaan menantang", "Judul angka/fakta mengejutkan"],
      "upload_description": "1-2 kalimat deskripsi YouTube tanpa hashtag & emoji",
      "hashtags": ["#bisnis", "#spesifik1", "#spesifik2"],
      "why_viral": "2-3 kalimat — jelaskan SPESIFIK mengapa segmen ini berpotensi viral berdasarkan isi transkrip (hook, emosi, daya tarik, penutup).",
      "emotion_trigger": "INSPIRASI atau TAWA atau KAGET atau RELATE atau KONTROVERSI",
      "score_breakdown": { "hook": 22, "emosi": 20, "daya_tarik": 14, "penutup": 13 },
      "speaker_quote": "Kutipan langsung dari transkrip yang paling nendang.",
      "content_angle": "EDUKASI",
      "category": "bisnis",
      "hooks": {
        "hook_pertanyaan": "Pertanyaan maks 6 kata yang bikin penasaran, mis. 'Kenapa dia *nolak* 1 miliar?'",
        "hook_pernyataan": "Pernyataan berani maks 6 kata, mis. 'Ini *kesalahan* terbesar saya'",
        "hook_teaser": "Teaser maks 6 kata tanpa spoiler, mis. 'Tunggu sampai dia *jujur*'"
      },
      "caption_suggestion": "Caption max 50 karakter + 3 hashtag relevan tanpa emoji"
    }
  ],
  "overall_video_summary": "2-3 kalimat ringkasan isi video secara keseluruhan",
  "best_segment_number": 1
}

Array "segments" WAJIB berisi {MIN} sampai {COUNT} segmen.

INGAT: Kembalikan HANYA JSON murni. Tanpa penjelasan, tanpa markdown, tanpa backtick. JSON langsung.
"""


def clip_analysis_schema(count: int) -> dict:
    """
    Skema JSON output Gemini. minItems menjaga agar model tidak hanya memberi 1 momen (model lite
    cenderung begitu); jumlah maksimal dipotong di gemini_service. Skema sengaja dibuat sederhana (tanpa
    enum, required bertingkat, atau maxItems): skema yang lebih rumit ditolak model dengan error 400.
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
            "short_title": text,
            "title_options": {"type": "array", "items": text},
            "upload_description": text,
            "hashtags": {"type": "array", "items": text},
            "thumbnail_text": text,
            "why_viral": text,
            "emotion_trigger": text,
            "score_breakdown": {
                "type": "object",
                "properties": {"hook": score, "emosi": score, "daya_tarik": score, "penutup": score},
            },
            "speaker_quote": text,
            "content_angle": text,
            "category": text,
            "hooks": {
                "type": "object",
                "properties": {"hook_pertanyaan": text, "hook_pernyataan": text, "hook_teaser": text},
            },
            "caption_suggestion": text,
        },
        "required": ["segment_number", "start_time", "end_time", "topic", "short_title", "title_options", "upload_description", "hashtags",
                     "thumbnail_text", "why_viral", "emotion_trigger",
                     "score_breakdown", "speaker_quote", "content_angle", "category", "hooks", "caption_suggestion"],
    }
    return {
        "type": "object",
        "properties": {
            "segments": {"type": "array", "items": segment, "minItems": min_segment_count(count)},
            "overall_video_summary": text,
            "best_segment_number": {"type": "integer"},
        },
        "required": ["segments", "overall_video_summary", "best_segment_number"],
    }
