# UX Discovery Document: SlimerClip — Jasa Clipping
**Tanggal**: 2026-10-28
**Penyusun**: pemilik SlimerClip + UX Superpowers
**Status**: Disetujui (semua bagian ditinjau & disetujui pemilik produk, 2026-10-28)

Detail per bagian: [01-personas](01-personas.md) · [02-jobs-to-be-done](02-jobs-to-be-done.md) · [03-user-journey](03-user-journey.md) · [04-telemetry](04-telemetry.md)

---

## 1. Ringkasan masalah

SlimerClip berawal sebagai alat pembuat klip 9:16 dari podcast YouTube (momen dipilih dari data tonton ulang, kamera mengikuti pembicara, edit otomatis). Arahnya kini menjadi **jasa clipping** untuk podcaster/kreator di Indonesia dan luar negeri, dengan halaman publik dua bahasa (`/jasa`, harga Rp/USD sesuai IP).

**Masalah pengguna**: podcaster yang rutin merilis episode panjang tidak berhasil menumbuhkan channel lewat video pendek karena (1) memotong klip menyita waktu sehingga berhenti, (2) editor lepas & tool AI menghasilkan klip yang tidak konsisten atau asal potong, dan (3) **tidak ada bukti apakah klip benar-benar menaikkan angka** yang mereka butuhkan untuk monetisasi dan sponsor.

**Kenapa sekarang**: tool AI clipping makin murah ($15–50/bulan) sehingga "memotong video" sudah jadi komoditas; nilai yang tersisa ada di kurasi, konsistensi, dan bukti hasil — tepat di celah yang belum dilayani pesaing.

## 2. Persona (ringkas)

| Persona | Prioritas | Inti |
|---|---|---|
| **Podcaster Sibuk** | Utama | Pemilik podcast/channel obrolan panjang (Indonesia & luar negeri), 1–2 episode/minggu; ingin klip rutin tanpa repot; review di HP lewat WA/email; tidak mau belajar aplikasi baru |
| Operator Clipping | Sekunder | Pemilik jasa (dan tim kelak) yang memproses video semua klien di SlimerClip; butuh banyak klip per jam dengan kualitas konsisten per klien |
| Clipper Mandiri | Tersier | Clipper Indonesia pengguna aplikasi gratis; **kepentingannya berlawanan** dengan persona utama (mengunggah ulang klip podcast orang lain) |

Semua persona = asumsi, divalidasi pemilik produk. Detail: [01-personas](01-personas.md).

## 3. Jobs to Be Done (ringkas)

**Job utama** — skor peluang 14:
> Saat channel saya stagnan dan saya tidak sempat lagi mengurus klip, saya ingin setiap episode berubah jadi klip pendek yang rutin terbit dan menjaring penonton baru, supaya views & followers naik dan channel saya layak disponsori.

- Fungsional: menaikkan angka untuk monetisasi & sponsor · Emosional: yakin uangnya kembali, tenang, bangga · Sosial: layak disponsori, kreator profesional
- Job pendukung: klip rutin 1–3 hari tanpa ditagih (11) · **bukti angka untuk sponsor (14)** · aman dari klaim & salah kutip (6)

**Insight utama**: klien membayar untuk angka yang bisa ditunjukkan ke sponsor, tapi hampir tidak ada pesaing yang membuktikan dampak klipnya. Detail: [02-jobs-to-be-done](02-jobs-to-be-done.md).

## 4. User journey (ringkas)

Fase: Menyadari → Menilai penyedia → Coba & sepakat → **Produksi rutin** → Jalur gagal → **Memantau hasil** → **Perpanjang**.

- **Momen penentu**: 3 klip gratis pertama · klip rutin pertama setelah bayar · akhir bulan pertama
- **Titik sakit tertinggi**: memantau hasil (tanpa bukti) · menagih & mengurus file · klaim hak cipta / salah kutip
- **Yang sudah bagus (pertahankan)**: momen dari data tonton ulang · paket upload siap salin · subtitle terjemahan

| Gap prioritas tinggi | Fase |
|---|---|
| Link review per klien tanpa login (putar, approve/revisi, unduh, salin paket upload) | 2, 4, 5 |
| Pelacakan views per klip + laporan bulanan siap untuk sponsor | 6, 7 |
| Alur "contoh untuk prospek" (3 klip dari episode calon klien dalam satu link) | 2 |

Kanal kerja: WhatsApp (Indonesia) / email (luar negeri) + Google Drive sekarang; link review & laporan nanti. Detail: [03-user-journey](03-user-journey.md).

## 5. Metrik sukses & telemetry (ringkas)

- **North Star**: jumlah klien berbayar yang memperpanjang ≥ 3 bulan · baseline 0 · target 6 bulan: 10
- **Guard rail**: batch ≤ 3 hari (≥ 95%) · revisi per klip (≤ 0,3) · klaim hak cipta (0) · waktu operator per klip (≤ 8 menit) · margin per klien (≥ 60%)
- **Pendorong**: pertumbuhan views klip klien 30 hari · % klien membuka laporan · % klip dengan link unggahan · % prospek membalas setelah contoh · tingkat edit otomatis dipertahankan
- 14 event (akuisisi, produksi, klien, bisnis) di backend sendiri, tanpa pelacak pihak ketiga; mulai dari spreadsheet klien

Detail: [04-telemetry](04-telemetry.md).

## 6. Prinsip desain

1. **Bukti di atas janji**: setiap hal yang dikirim ke klien harus bisa dihubungkan dengan angka pertumbuhan.
   - *Karena*: job utama & insight JTBD — klien membayar untuk angka sponsor; fase "memantau" & "perpanjang" adalah titik sakit dan momen penentu terbesar.
   - *Artinya*: pelacakan performa klip dan laporan bulanan didahulukan; portofolio `/jasa` memakai angka nyata; skor analisis dikalibrasi dengan views sungguhan.
   - *Bukan*: menjual jumlah klip atau menambah efek edit baru yang tidak berdampak pada angka klien.

2. **Nol repot bagi klien**: klien cukup membuka link di HP; tidak ada akun, aplikasi, atau langkah yang harus dipelajari.
   - *Karena*: persona utama tidak mau belajar aplikasi baru, review lewat HP, emosi target "tenang, tidak repot"; titik sakit "harus menagih".
   - *Artinya*: link review & laporan tanpa login (bertanda tangan, kedaluwarsa), komunikasi lewat WA/email, paket upload siap salin, notifikasi saat klip siap.
   - *Bukan*: portal klien dengan akun & dashboard, atau meminta klien mengisi form panjang.

3. **Otomatis dulu, manusia memutuskan**: mesin mengerjakan 90%, operator memastikan setiap klip layak sebelum dikirim.
   - *Karena*: klien kecewa dengan tool AI yang "asal potong"; operator butuh banyak klip per jam (guard rail ≤ 8 menit/klip).
   - *Artinya*: edit otomatis sebagai titik awal yang bisa diubah apa pun; preset per klien; event `clip_operator_changed` untuk memperbaiki otomatisasi di bagian yang paling sering diganti.
   - *Bukan*: mengirim hasil otomatis tanpa dicek, dan bukan menyunting manual dari nol.

4. **Aman untuk channel klien**: tidak ada yang dikirim ke klien yang bisa membuat channel atau nama tamunya bermasalah.
   - *Karena*: job pendukung "aman dari klaim & salah kutip"; guard rail klaim hak cipta = 0; ketegangan dengan persona tersier.
   - *Artinya*: musik bebas royalti/berlisensi sebagai default untuk klien, pengecekan kutipan, portofolio hanya dengan izin, file klien tidak dibagikan.
   - *Bukan*: memakai lagu viral berhak cipta untuk klien tanpa izin, atau memasarkan jasa sebagai cara mengunggah ulang konten orang lain.

## 7. Asumsi & risiko

### Asumsi yang sudah tervalidasi
- Pemotongan klip di jeda bicara bekerja — *bukti*: uji pada podcast asli, 7 dari 8 titik potong jatuh di jeda 10–40 dB lebih hening.
- Edit otomatis (hook, musik, SFX, suara jernih, HD) dapat dirender utuh — *bukti*: render final 1080p berhasil, loudness −13,4 LUFS.
- Terjemahan subtitle EN↔ID mempertahankan jumlah kalimat & waktu — *bukti*: uji Gemini, 7 → 7 kalimat dengan rentang waktu sama.
- Bentuk persona, job, journey, dan metrik — *bukti*: dikonfirmasi pemilik produk (bukan data klien; lihat asumsi belum tervalidasi).

### Asumsi yang belum tervalidasi
- **Klien membayar terutama untuk pertumbuhan angka/sponsor** (bukan sekadar menghemat waktu). — *Validasi*: wawancara 3–5 klien/prospek pertama. — *Risiko jika salah*: prioritas laporan keliru; mungkin kecepatan & harga lebih penting.
- **Harga paket (Rp750 rb–2,5 jt / $249–799) wajar untuk pasar.** — *Validasi*: survei 5–10 penyedia jasa lokal & di marketplace; uji penawaran ke 10 prospek. — *Risiko*: terlalu mahal → tidak ada yang beli; terlalu murah → margin di bawah 60%.
- **3 klip gratis dari episode prospek meningkatkan balasan & konversi.** — *Validasi*: catat % balasan & % trial → bayar untuk 20 penawaran pertama. — *Risiko*: waktu operator habis untuk prospek yang tidak membeli.
- **Klien mau menempelkan link unggahan klip** (agar performa bisa dilacak). — *Validasi*: uji dengan 3 klien pertama. — *Risiko*: laporan kosong → prinsip "bukti di atas janji" tidak bisa dijalankan; perlu alternatif (menghubungkan channel/akses analitik).
- **Data views TikTok/Shorts bisa diambil dengan andal.** — *Validasi*: uji teknis (YouTube Data API untuk Shorts; TikTok memerlukan API resmi/izin klien). — *Risiko*: laporan hanya mencakup YouTube.
- **Satu operator bisa melayani ±10 klien** dengan edit otomatis. — *Validasi*: ukur waktu per klip & per batch selama bulan pertama. — *Risiko*: kapasitas penuh sebelum target, kualitas turun.

### Risiko yang diketahui

| Risiko | Kemungkinan | Dampak | Mitigasi |
|---|---|---|---|
| Pertumbuhan channel klien dipengaruhi faktor di luar kendali (topik, tamu, algoritma) | Tinggi | Tinggi | Laporan membandingkan klip vs baseline klien sendiri; tetapkan ekspektasi di awal; fokus metrik yang bisa dikendalikan (konsistensi, kualitas) |
| Klaim hak cipta (musik, atau klien yang ternyata tidak punya hak atas konten) | Sedang | Tinggi | Musik bebas royalti default; pernyataan klien bahwa mereka pemilik konten; minta file asli |
| Mengunduh dari YouTube melanggar ketentuan YouTube | Tinggi | Sedang | Minta klien mengirim file asli (fitur upload sudah ada); unduhan hanya untuk video milik klien |
| Kuota/biaya Gemini membatasi produksi | Sedang | Sedang | Pantau guard rail kuota; billing berbayar saat ada klien; cadangan TTS/penyedia lain |
| Kapasitas render (satu render sekaligus, PC lokal) | Sedang | Sedang | Antre per klien, render malam hari, pertimbangkan server/GPU saat > 5 klien |
| Harga tool AI terus turun, klien membandingkan dengan $15/bulan | Tinggi | Sedang | Posisikan pada hasil terukur & kurasi manusia, bukan pada pemotongan |
| Menjual source code melahirkan pesaing jasa | Sedang | Sedang | Tunda penjualan kode; jika dijual, utamakan model langganan (SaaS) |
| Data & file klien bocor | Rendah | Tinggi | Link bertanda tangan & kedaluwarsa, file per pemilik, hapus file sumber setelah proyek selesai |

## 8. Batasan & ruang lingkup

### Batasan teknis
- Backend Flask + frontend Next.js 16; render FFmpeg di satu mesin dengan satu render berjalan sekaligus (±1 menit per klip 1080p)
- Whisper `small` di CPU; Gemini (model lite) dengan kuota terbatas
- Deteksi bahasa per IP butuh hosting yang mengirim header negara (Vercel/Cloudflare)
- Font non-Latin diunduh saat pertama dibutuhkan; bahasa yang ditawarkan saat ini hanya Indonesia & Inggris

### Batasan pengguna
- Klien mereview di HP dan tidak mau membuat akun
- Klien Indonesia lewat WhatsApp, klien luar negeri lewat email; beda zona waktu
- Klien tidak selalu punya file asli atau waktu menulis brief panjang

### Batasan bisnis
- Satu operator (pemilik) dengan waktu sangat terbatas
- Pembayaran: transfer/QRIS (Indonesia), Wise/PayPal/Payoneer (luar negeri)
- Tidak boleh memakai materi berhak cipta untuk klien tanpa izin

### Ruang lingkup
- **Termasuk**: alur jasa clipping end-to-end — profil analisis & preset klien, edit otomatis, render & SRT, halaman `/jasa` dua bahasa, **link review per klien**, **pelacakan performa & laporan bulanan**, alur contoh untuk prospek, pencatatan event
- **Tidak termasuk (dan alasannya)**:
  - Portal klien dengan akun & dashboard — bertentangan dengan prinsip "nol repot"
  - Unggah otomatis ke TikTok/YouTube atas nama klien — butuh izin API platform & menambah risiko akun klien
  - Dubbing/suara terjemahan — tidak terkait langsung dengan job utama
  - Menerjemahkan ruang kerja & editor — dipakai operator saja
  - Menjual source code — risiko melahirkan pesaing; ditunda
- **Pertimbangan nanti**: versi langganan (SaaS) untuk clipper mandiri, akun tim untuk operator kedua, jadwal unggah yang disarankan, cadangan TTS (Azure) untuk video panjang, bahasa tambahan

## 9. Ringkasan riset

Belum ada data riset pengguna (wawancara, survei, data penjualan). Satu-satunya data eksternal: penelusuran harga pasar (Oktober 2026) — agensi clipping podcast menyebut $500–2.000/klien/bulan (sumber: blog vendor), tool AI $8–50/bulan, harga jasa dalam Rupiah tidak ditemukan dari sumber publik. **Seluruh persona & job perlu divalidasi dengan klien sungguhan** (lihat bagian 7).

## 10. Langkah berikutnya

- [ ] Mulai spreadsheet klien (status, paket, mata uang, tanggal mulai, perpanjangan) → North Star & MRR berjalan sejak klien pertama
- [ ] Isi kontak (`NEXT_PUBLIC_CONTACT_WHATSAPP`, `NEXT_PUBLIC_CONTACT_EMAIL`) dan portofolio di `/jasa`
- [ ] Kirim 3 klip gratis ke 10–20 prospek (DM/email + marketplace), catat balasan & konversi
- [ ] Wawancara 3–5 klien/prospek pertama untuk memvalidasi job utama & harga
- [ ] Bangun **link review per klien tanpa login** (approve/revisi/unduh/salin paket upload) + event pengiriman & revisi
- [ ] Bangun **pelacakan performa klip & laporan bulanan** (mulai dari YouTube Shorts)
- [ ] Tinjau ulang target metrik setelah 3 klien pertama
