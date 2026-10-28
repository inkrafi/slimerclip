"""
Prompt pemilihan momen klip. Disusun dari profil analisis (clip_profile.py): kriteria umum yang ketat,
panduan per tipe video, batas durasi & jumlah, dan bahasa teks untuk penonton.
"""
import clip_profile

MIN_SEGMENTS = clip_profile.MIN_CLIPS


def target_segment_count(video_duration: float, profile: dict | None = None) -> int:
    """Jumlah momen MAKSIMAL yang diminta (lihat clip_profile.clip_count)."""
    return clip_profile.clip_count(profile, video_duration)


def min_segment_count(count: int, exact: bool = False) -> int:
    """
    Minimal momen di skema JSON. Otomatis: kecil (lebih baik sedikit momen bagus). Jumlah pilihan admin: 5;
    jumlah persisnya diminta lewat prompt (gemini-flash-lite menolak skema ini dengan minItems ≥12, terukur).
    """
    return min(EXACT_MIN_ITEMS if exact else MIN_SEGMENTS, count)


EXACT_MIN_ITEMS = 5


COUNT_AUTO = """Pilih maksimal {COUNT} momen (minimal {MIN}). LEBIH BAIK SEDIKIT MOMEN YANG BAGUS daripada banyak momen biasa:
momen yang tidak memenuhi kriteria wajib jangan dimasukkan hanya untuk menambah jumlah."""
COUNT_EXACT = """Pilih TEPAT {COUNT} momen (pembuat klip membutuhkan sejumlah ini). Utamakan momen yang memenuhi semua
kriteria wajib; bila jumlahnya kurang, lengkapi dengan momen terbaik berikutnya yang paling mendekati kriteria
dan beri skor yang JUJUR (lebih rendah), jangan dinaikkan."""


TYPE_GUIDES = {
    "podcast": (
        "PODCAST / WAWANCARA (2+ orang): cari insight yang jarang didengar, pengakuan jujur, perbedaan pendapat "
        "antar pembicara, cerita pribadi dengan akhir tak terduga, angka konkret. Jika jawaban butuh pertanyaan "
        "pembawa acara agar dipahami, mulai klip dari pertanyaannya."
    ),
    "solo": (
        "BICARA SENDIRI (vlog, edukasi, opini ke kamera): satu argumen utuh dari klaim sampai alasan/contohnya, "
        "pernyataan tegas yang bisa diperdebatkan, tips konkret yang langsung bisa dipakai."
    ),
    "presentation": (
        "PRESENTASI / PANGGUNG (seminar, talk, stand-up, ceramah): punchline, angka mengejutkan, cerita dengan "
        "twist, kalimat yang memancing tawa/tepuk tangan penonton. TOLAK bagian yang merujuk slide atau alat "
        "peraga (\"seperti di layar ini\", \"lihat grafik ini\") karena tidak terlihat di klip vertikal."
    ),
    "streamer": (
        "STREAMER (ngobrol / just chatting): reaksi spontan, cerita lucu, opini panas, interaksi dengan chat atau "
        "donasi. Bila streamer menanggapi pesan chat, sertakan saat pesan itu dibacakan agar konteksnya jelas."
    ),
    "gaming": (
        "STREAMING GAME: momen clutch/menang dramatis, gagal/kalah yang konyol, reaksi heboh (teriak, kaget, "
        "tertawa), interaksi lucu dengan rekan tim. Transkrip hanya berisi ucapan, jadi tanda momen besar adalah "
        "seruan, kata kaget, tawa, umpatan, atau perubahan nada mendadak. Sertakan 3-5 detik build-up sebelum "
        "momennya. Untuk tipe ini syarat \"kalimat pembuka bisa jadi judul\" boleh diganti reaksi yang kuat."
    ),
    "other": (
        "UMUM: terapkan kriteria wajib di atas apa adanya; pilih bagian dengan ide paling jelas dan emosi paling kuat."
    ),
}
TYPE_KEYS = [k for k in clip_profile.VIDEO_TYPES if k != "auto"]


def _type_block(video_type: str) -> str:
    if video_type in TYPE_GUIDES:
        return f"Tipe video sudah ditentukan pembuat klip. Isi detected_type dengan \"{video_type}\".\n- {TYPE_GUIDES[video_type]}"
    guides = "\n".join(f"- {k}: {TYPE_GUIDES[k]}" for k in TYPE_KEYS)
    return ("Tentukan dulu tipe video dari metadata dan transkrip, isi detected_type dengan SATU dari: "
            f"{', '.join(TYPE_KEYS)}. Lalu terapkan panduan tipe itu:\n{guides}")


def _language_rule(profile: dict) -> str:
    source = profile.get("source_language", "auto")
    output = profile.get("output_language", "id")
    lines = []
    if source in clip_profile.LANGUAGES:
        lines.append(f"- Video ini berbahasa {clip_profile.LANGUAGES[source]}.")
    lines.append("- detected_language: kode ISO 639-1 bahasa utama yang diucapkan di video (mis. \"id\", \"en\", \"ja\").")
    if output == "same":
        lines.append("- Tulis semua teks untuk penonton (topic, judul, hook, deskripsi, caption, thumbnail, why_viral) "
                     "dalam BAHASA YANG SAMA dengan bahasa video.")
    else:
        lines.append(f"- Tulis semua teks untuk penonton (topic, judul, hook, deskripsi, caption, thumbnail, why_viral) "
                     f"dalam bahasa {clip_profile.LANGUAGES.get(output, 'Indonesia')}, walaupun videonya berbahasa lain. "
                     "Gaya bahasanya lisan dan natural untuk penutur asli bahasa itu, bukan terjemahan kaku.")
    lines.append("- speaker_quote dan hook_line tetap VERBATIM dalam bahasa asli video.")
    return "\n".join(lines)


def get_clip_analysis_prompt(count: int = 10, profile: dict | None = None) -> str:
    profile = clip_profile.sanitize(profile)
    bounds = clip_profile.duration_bounds(profile)
    lo, hi = bounds["ideal"]
    exact = clip_profile.exact_count(profile)
    return (_PROMPT
            .replace("{COUNT_RULE}", COUNT_EXACT if exact else COUNT_AUTO)
            .replace("{COUNT}", str(count))
            .replace("{MIN}", str(min_segment_count(count, exact)))
            .replace("{DUR_MIN}", str(bounds["min"]))
            .replace("{DUR_MAX}", str(bounds["max"]))
            .replace("{IDEAL_LO}", str(lo))
            .replace("{IDEAL_HI}", str(hi))
            .replace("{TYPE_BLOCK}", _type_block(profile["video_type"]))
            .replace("{LANGUAGE_RULE}", _language_rule(profile)))


_PROMPT = """
Kamu editor klip profesional untuk TikTok, YouTube Shorts, dan Instagram Reels. Tugasmu memilih momen dari video
panjang yang layak jadi klip vertikal berdiri sendiri.

Kamu menerima metadata video dan transkrip berformat:
[MM:SS - MM:SS] teks ucapan
(untuk video lebih dari 1 jam, menit bisa lebih dari 59, mis. [75:30 - 75:34]). Satu baris transkrip adalah
potongan subtitle, BUKAN kalimat utuh.

{COUNT_RULE}
Momen tidak boleh tumpang tindih; sebar ke seluruh durasi video bila kualitasnya setara.

---

KRITERIA WAJIB — momen hanya layak jika memenuhi SEMUA ini:
1. Berdiri sendiri: penonton yang belum pernah menonton video ini tetap paham tanpa konteks tambahan.
2. Satu ide tunggal, bukan dua topik yang disambung.
3. Ada ketegangan: klaim mengejutkan, kontradiksi, pengakuan, angka konkret, atau cerita dengan akhir tak terduga.
4. Kalimat pembukanya kuat, bisa berdiri sebagai judul artikel.

TOLAK momen yang: basa-basi pembuka/penutup, saling memuji, bercanda tanpa isi, promosi sponsor, menjelaskan
sesuatu yang butuh slide/visual, atau merujuk bagian lain video ("tadi kita bahas", "nanti kita lanjut").
Momen lucu boleh dipilih bila tetap lucu tanpa konteks (sering justru paling banyak ditonton).

TIPE VIDEO
{TYPE_BLOCK}

BAHASA
{LANGUAGE_RULE}

---

ATURAN POTONG & DURASI
- Durasi {DUR_MIN}-{DUR_MAX} detik, ideal {IDEAL_LO}-{IDEAL_HI} detik. Di luar rentang itu jangan dipilih.
- start_time = awal kalimat pertama momen (bukan di tengah kalimat). end_time = setelah kalimat terakhir SELESAI
  diucapkan; jika kalimat berlanjut ke baris transkrip berikutnya, ambil end_time baris itu.
- Jangan pernah memotong di tengah kalimat atau sebelum punchline/kesimpulan.
- hook_line: kalimat VERBATIM dari dalam momen yang paling layak jadi 3 detik pertama (boleh dari tengah klip).
  hook_start: MM:SS saat kalimat itu mulai diucapkan.

---

ATURAN WAJIB LAINNYA

1. GROUNDED: setiap field berdasarkan kata-kata yang benar-benar ada di transkrip dan metadata. DILARANG mengarang.

2. TIMESTAMP: start_time, end_time, hook_start diambil PERSIS dari angka MM:SS di transkrip (format MM:SS).

3. PENILAIAN PER KOMPONEN (score_breakdown) — JUJUR DAN KRITIS. Skor ini digabung dengan data penonton nyata
   (grafik "Most replayed" YouTube), jadi JANGAN menaikkan nilai agar terlihat bagus.
   - hook (0-30): apakah kalimat pertama langsung membuat orang berhenti scroll?
       25-30 = sangat kuat & spesifik | 15-24 = cukup menarik | 0-14 = datar / butuh konteks
   - emosi (0-30): seberapa kuat reaksi emosional (tawa, kaget, haru, marah, relate)?
       25-30 = kuat & jelas di transkrip | 15-24 = sedang | 0-14 = informatif datar
   - daya_tarik (0-20): seberapa luas audiens yang peduli topik ini?
       16-20 = relevan untuk umum | 10-15 = segmen tertentu | 0-9 = sangat niche
   - penutup (0-20): apakah momen berakhir dengan payoff/punchline/kesimpulan yang tuntas?
       16-20 = tuntas | 10-15 = cukup | 0-9 = menggantung / terpotong
   Kebanyakan momen layak ada di total 55-80; di atas 85 hanya untuk yang benar-benar luar biasa.

4. FIELD KONTEKS
   - speaker_quote: 1 kutipan VERBATIM paling kuat dari momen ini.
   - content_angle: SATU dari EDUKASI, HIBURAN, INSPIRASI, KONTROVERSI, TUTORIAL.
   - category: topik utama, SATU (huruf kecil) dari: bisnis, investasi, keuangan, marketing, karier, teknologi,
     pendidikan, mindset, kesehatan, hubungan, sosial, hiburan, komedi, lainnya.
       bisnis = usaha, strategi perusahaan | investasi = saham, reksa dana, kripto, aset
       keuangan = gaji, menabung, utang | marketing = konten, personal branding, jualan online
       karier = kerja, skill, produktivitas | teknologi = AI, gadget | pendidikan = belajar, sains, sejarah, filsafat
       mindset = motivasi, pola pikir | hiburan = gosip, selebriti, game, cerita hidup tanpa topik di atas
       komedi = HANYA bila momen terutama lucu dan tidak membahas topik lain di daftar.

5. HOOK & CAPTION — hook = teks besar di 3-5 detik pertama:
   - Maksimal 6 kata (±35 karakter), bahasa lisan sehari-hari.
   - Buka rasa penasaran tanpa membocorkan akhirnya; spesifik (angka, nama, situasi), bukan generik.
   - Apit 1-2 kata kunci dengan bintang agar diberi warna, mis. "Gaji *2 juta* bisa beli rumah?"
   - Tanpa emoji, hashtag, atau tanda kutip.
   Caption maks 50 karakter + 3 hashtag, tanpa emoji.

6. JUDUL & DESKRIPSI UPLOAD — penonton Shorts tidak memilih video, mereka swipe:
   - short_title & title_options: maks 60 karakter, gaya cerita/konflik/rasa penasaran. JANGAN format
     "Topik | Nama Narasumber" atau judul datar seperti judul materi kelas.
   - title_options: 3 judul dengan sudut berbeda (cerita, pertanyaan menantang, angka/fakta mengejutkan).
   - upload_description: 1-2 kalimat konteks yang membuat orang menonton sampai habis, tanpa hashtag & emoji.
   - hashtags: 3 hashtag huruf kecil tanpa spasi (1 topik luas, 2 spesifik), tanpa #shorts.

---

OUTPUT FORMAT — KEMBALIKAN JSON INI PERSIS:

{
  "detected_type": "podcast",
  "detected_language": "id",
  "segments": [
    {
      "segment_number": 1,
      "start_time": "MM:SS",
      "end_time": "MM:SS",
      "hook_line": "Kalimat verbatim terkuat dari dalam momen",
      "hook_start": "MM:SS",
      "topic": "1 kalimat singkat — apa yang terjadi di momen ini",
      "thumbnail_text": "Teks thumbnail 1-3 kata, beda dari judul; apit 1 kata kunci dengan bintang",
      "short_title": "Judul Shorts maks 60 karakter gaya cerita/konflik",
      "title_options": ["Judul cerita", "Judul pertanyaan menantang", "Judul angka/fakta mengejutkan"],
      "upload_description": "1-2 kalimat deskripsi tanpa hashtag & emoji",
      "hashtags": ["#topik", "#spesifik1", "#spesifik2"],
      "why_viral": "1-2 kalimat SPESIFIK kenapa momen ini membuat orang berhenti scroll.",
      "emotion_trigger": "INSPIRASI atau TAWA atau KAGET atau RELATE atau KONTROVERSI",
      "score_breakdown": { "hook": 22, "emosi": 20, "daya_tarik": 14, "penutup": 13 },
      "speaker_quote": "Kutipan verbatim dari transkrip.",
      "content_angle": "EDUKASI",
      "category": "bisnis",
      "hooks": {
        "hook_pertanyaan": "Pertanyaan maks 6 kata yang bikin penasaran",
        "hook_pernyataan": "Pernyataan berani maks 6 kata",
        "hook_teaser": "Teaser maks 6 kata tanpa spoiler"
      },
      "caption_suggestion": "Caption maks 50 karakter + 3 hashtag tanpa emoji"
    }
  ],
  "overall_video_summary": "2-3 kalimat ringkasan isi video",
  "best_segment_number": 1
}

Urutkan segments dari momen terbaik. Kembalikan HANYA JSON murni, tanpa markdown atau penjelasan.
"""


def clip_analysis_schema(count: int, exact: bool = False) -> dict:
    """
    Skema JSON output Gemini. minItems kecil menjaga model lite tidak hanya memberi 1 momen; jumlah maksimal
    dipotong di gemini_service. Skema sengaja sederhana (tanpa enum, required bertingkat, atau maxItems):
    skema yang lebih rumit ditolak model dengan error 400.
    """
    text = {"type": "string"}
    score = {"type": "integer"}
    segment = {
        "type": "object",
        "properties": {
            "segment_number": {"type": "integer"},
            "start_time": text,
            "end_time": text,
            "hook_line": text,
            "hook_start": text,
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
        "required": ["segment_number", "start_time", "end_time", "hook_line", "hook_start", "topic", "short_title",
                     "title_options", "upload_description", "hashtags", "thumbnail_text", "why_viral",
                     "emotion_trigger", "score_breakdown", "speaker_quote", "content_angle", "category", "hooks",
                     "caption_suggestion"],
    }
    return {
        "type": "object",
        "properties": {
            "detected_type": text,
            "detected_language": text,
            "segments": {"type": "array", "items": segment, "minItems": min_segment_count(count, exact)},
            "overall_video_summary": text,
            "best_segment_number": {"type": "integer"},
        },
        "required": ["detected_type", "detected_language", "segments", "overall_video_summary", "best_segment_number"],
    }
