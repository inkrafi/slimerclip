# The Equator Ledger — Channel Guide

Nov 5, 2026 · @kravio

## Ringkasan

The Equator Ledger adalah channel YouTube berbahasa Inggris berisi motion graphic explainer tentang cerita bisnis dan ekonomi Asia Tenggara, dengan fokus video panjang 12–15 menit.

| Aspek | Keputusan |
| --- | --- |
| Bahasa | Inggris |
| Pasar utama | AS, UK, Kanada, Australia (plus diaspora & pebisnis Asia) |
| Umur target | 25–44 tahun, pekerja dan pebisnis |
| Format | Video panjang 12–15 menit, Shorts hanya sebagai potongan promosi |
| Gaya visual | Peta dan data editorial, 2D flat, tanpa karakter berwajah |
| Suara | Klon suara Rafi di Gemini, dengan subtitle .srt bahasa Inggris di setiap video |
| Pembeda | Perspektif orang dalam Asia Tenggara yang jarang dimiliki kreator Barat |

## Nama channel & handle

Keputusan: **The Equator Ledger**, dengan handle **@TheEquatorLedger**.

Handle terlihat kosong saat dicek 5 Nov 2026, dan kepastiannya baru didapat saat diklaim. Merek dagang, domain, dan media sosial belum dicek.

| Nama yang dicoret | Alasan |
| --- | --- |
| Tropic of Capital | Sudah dipakai @TropicOfCapital (animasi ekonomi dan bisnis) dan @TropicOfCapitalTV |
| Monsoon Money | Sudah dipakai channel dokumenter bisnis |
| The Spice Route | Sudah dipakai channel lain |

Aturan nama: hindari kata "Indonesia" di nama agar cakupan tetap seluruh Asia Tenggara dan penonton global tidak merasa ini channel lokal.

## Icon / logo channel

Konsep: **lingkaran globe dengan garis khatulistiwa yang di ujung kanannya berbelok naik menjadi panah grafik.** Satu simbol menyatukan dua ide: wilayah khatulistiwa dan pertumbuhan ekonomi.

- **Bentuk:** lingkaran solid warna navy, garis lintang dan panah warna saffron. Tanpa teks di dalam icon.
- **Kenapa sederhana:** icon YouTube tampil sekitar 48 px di HP. Detail kecil (peta, tulisan) akan hilang.
- **Versi turunan:** icon yang sama dipakai sebagai watermark pojok video, frame akhir intro, dan bullet di lower-third.
- **Wordmark (untuk banner):** "THE EQUATOR LEDGER" dalam huruf tebal, kata "LEDGER" berwarna saffron.
- **Larangan:** jangan pakai bendera negara, foto, atau gradien rumit di icon.

Icon sudah dibuat sebagai SVG dan PNG, lihat `motion/output/equator/channel-kit/01-logo`.

## Palet warna & tipografi

Paletnya gelap dan editorial agar terasa seperti media bisnis premium, dengan aksen saffron/kunyit sebagai sentuhan Asia Tenggara.

| Peran | Nama | Hex | Dipakai untuk |
| --- | --- | --- | --- |
| Latar utama | Deep Navy | #0F1B2D | Background hampir semua scene |
| Latar terang | Paper | #F3EDE2 | Scene kutipan, dokumen, peta versi terang |
| Aksen utama | Saffron | #E8A33D | Highlight, angka penting, panah naik, wordmark |
| Positif / wilayah | Teal | #1F7A72 | Daratan peta, pertumbuhan, data positif |
| Negatif | Coral | #D9553B | Penurunan, kerugian, peringatan |
| Netral | Slate | #8A94A6 | Label, garis grid, data pembanding |

Aturan warna: maksimal 1 aksen saffron dominan per scene. Saffron = "lihat ini".

| Peran | Font (Google Fonts, gratis komersial) | Dipakai untuk |
| --- | --- | --- |
| Judul | Bricolage Grotesque (Bold/ExtraBold) | Judul chapter, teks thumbnail, kinetic typography |
| Isi & label | Inter | Label peta, keterangan, lower-third |
| Angka | IBM Plex Mono | Counter, harga, persentase, tahun |

## Tema & gaya animasi

Tema: **"Editorial Map & Data"** — motion graphic 2D flat bergaya majalah bisnis, dengan peta Asia Tenggara sebagai panggung utama dan data yang dibangun bergerak di depan penonton.

Kenapa gaya ini:

- **Bisa saya produksi sendiri lewat kode** (SVG/HTML yang dirender jadi MP4), jadi konsisten dan tidak butuh animator manusia.
- **Cocok dengan topiknya:** cerita ekonomi memang soal tempat, uang yang mengalir, dan angka yang berubah.
- **Tanpa karakter berwajah:** animasi karakter adalah bagian paling mahal dan paling sulit konsisten. Manusia cukup diwakili ikon siluet.
- **Skala:** elemen yang sama dipakai ulang tiap video, jadi produksi makin cepat.

### Elemen visual yang berulang (visual vocabulary)

| Elemen | Fungsi di cerita | Gerakan khas |
| --- | --- | --- |
| Map Stage | Membuka konteks lokasi; kamera zoom dari dunia ke negara ke kota | Zoom halus + negara menyala teal |
| Money Flow | Menunjukkan uang/barang berpindah antar negara atau perusahaan | Garis putus-putus saffron mengalir dengan partikel |
| Number Counter | Angka besar yang mengejutkan | Angka berputar naik, berhenti dengan sedikit "pantulan" |
| Chart Build | Tren dari waktu ke waktu | Garis tergambar kiri ke kanan, titik penting diberi label |
| Company Card | Memperkenalkan perusahaan/tokoh | Kartu meluncur masuk: logo generik, tahun berdiri, angka kunci |
| Versus Split | Perbandingan dua pihak (Gojek vs Grab) | Layar terbelah, bar tumbuh bersamaan |
| Timeline Ribbon | Urutan peristiwa sejarah | Pita horizontal bergulir, tahun di atasnya |
| Document Snap | Mengutip laporan/berita sebagai bukti | Kertas "paper" muncul, satu baris di-highlight saffron |
| Chapter Card | Pembatas bab | Layar navy, nomor bab mono + judul besar |

### Aturan gerak

- Easing halus (ease-in-out), tidak ada gerakan memantul berlebihan kecuali Number Counter.
- Satu ide per scene, ganti visual setiap 4–8 detik agar retensi terjaga.
- Transisi antar bab memakai pola geometris tipis terinspirasi motif batik/songket, warnanya slate transparan.
- Tekstur kertas sangat tipis (sekitar 2,5%) di atas semua scene. Lebih tebal membebani kompresi YouTube.
- Logo perusahaan asli tidak dipakai; cukup nama dalam teks dan bentuk generik, untuk menghindari klaim hak cipta/merek.

## Struktur video panjang

Target durasi 12–15 menit: cukup panjang untuk 2–3 slot iklan mid-roll (tersedia mulai 8 menit), tapi masih realistis diproduksi tiap 2 minggu.

1. **Cold open (0:00–0:45):** satu fakta mengejutkan + pertanyaan besar. Contoh: "Two out of every three tons of nickel mined last year came from one country." Tanpa salam, tanpa intro panjang.
2. **Title sting (3–5 detik):** animasi icon + nama channel.
3. **Konteks (1–2 menit):** Map Stage, siapa pemainnya, kenapa penonton global harus peduli.
4. **Bab 1–4 (masing-masing 2–3 menit):** tiap bab dibuka Chapter Card dan ditutup dengan pertanyaan yang membuat penonton lanjut ke bab berikutnya.
5. **Twist / sisi gelap (1–2 menit):** risiko, kegagalan, atau hal yang jarang dibahas. Ini pembeda dari konten yang sekadar memuji.
6. **Penutup (1 menit):** jawab pertanyaan dari cold open, kaitkan ke dampak global.
7. **End screen (20 detik):** satu video rekomendasi + tombol subscribe. Tanpa ajakan panjang.

Target retensi: di atas 50% pada menit pertama. Kalau turun drastis di 0:30, cold open-nya yang perlu diperbaiki.

## Formula naskah

Diolah dari cara kerja penulis naskah channel faceless yang videonya rutin ditonton ratusan ribu kali, lalu disesuaikan untuk channel ini. Ini rangkuman prinsip, bukan salinan.

### Sebelum menulis

1. **Tujuan bersama.** Apa yang penonton cari dari video ini, dan apa tujuan kita membuatnya? Kalau keduanya tidak sejalan, naskah terasa palsu.
2. **Masalah permukaan dan masalah yang lebih dalam.** Permukaan adalah topik teknisnya. Yang lebih dalam adalah pertanyaan besar yang terasa secara emosional. Contoh nikel: bagaimana Indonesia menguasai nikel, dan apakah pengaruh sama dengan kemenangan.
3. **Paket dulu.** Tiga judul dan thumbnail disusun sebelum naskah. Naskah wajib membayar janji paket itu.
4. **Siapa penontonnya.** Tulis satu atau dua profil penonton: apa yang sudah mereka tahu, dan sampai mana kerumitan yang masih bisa mereka ikuti.
5. **Riset, lalu cari celahnya.** Catat apa yang sudah dijelaskan video lain, dan terutama apa yang belum. Celah itu nilai tambah channel kita.

### Struktur

6. **Titik awal dan titik akhir.** Tulis dengan jelas posisi penonton di awal dan di akhir video. Harus ada perubahan pemahaman.
7. **Alur cerita.** Keadaan awal, pemicu, rangkaian bukti dan kejutan, krisis atau titik terendah, temuan, lalu penutup. Tanpa konflik, taruhan, dan perubahan, video hanya jadi kumpulan fakta.
8. **Benang merah lintas video.** Buku besar adalah benang merah channel ini: tiap video menambah catatan, dan suatu hari catatan itu bisa saling terhubung.
9. **Kerangka diuji dulu.** Minta AI mengkritik kerangka, bukan menulis naskahnya: apa yang kurang, apa yang membosankan, apa yang bisa dibuang.

### Menulis

10. **Draf pertama cepat.** Tulis semua poin tanpa memikirkan tata bahasa, lalu rapikan setelahnya.
11. **Kerumitan naik bertahap.** Mulai dari konteks dan konsep sederhana, baru naik ke yang rumit.
12. **Ajak penonton berpikir.** Lempar pertanyaan dan tunda jawabannya, supaya penonton mencoba menebak sendiri.
13. **"Tetapi" dan "karena itu", bukan "lalu".** Tiap fakta harus memicu fakta berikutnya. Alur "ini terjadi, lalu itu terjadi" terasa datar.
14. **Panjang kalimat bervariasi.** Campur kalimat pendek dan panjang supaya tidak monoton.
15. **Catatan edit di naskah.** Tulis visual, animasi, dan efek suara di samping narasi. Naskah channel ini memakai blok Visual dan Sumber di tiap bab.
16. **Tetap punya jiwa.** Jangan membuang bagian yang benar-benar berguna hanya demi retensi.

### Daftar cek sebelum naskah final

- [ ] Hook membayar janji judul dan thumbnail
- [ ] Masalah yang lebih dalam terjawab di akhir
- [ ] Ada minimal satu hal yang belum banyak diketahui penonton
- [ ] Ada momen penonton diajak menebak
- [ ] Transisi antar bagian memakai "tetapi" atau "karena itu"
- [ ] Panjang kalimat bervariasi
- [ ] Semua angka punya sumber di riset-terverifikasi.md

## Audio

Channel memakai klon suara Rafi sendiri, supaya punya suara yang tidak dipakai channel lain dan tetap terasa dari Asia Tenggara. Risikonya, logat bisa membuat kata seperti "wasn't" kurang jelas, jadi setiap narasi wajib dicek dan diberi subtitle.

| Komponen | Pilihan | Catatan |
| --- | --- | --- |
| Voiceover | Klon suara Rafi lewat Gemini TTS, ID `voice_746ecuqzzudk`. | Bahasa Inggris, tempo \~150 kata/menit. Aktif selama 1 tahun sejak terakhir dipakai. |
| Subtitle | File .srt bahasa Inggris dari naskah, dengan waktu dari audio | Teksnya dari naskah, bukan dari transkrip otomatis, supaya istilah dan angka tidak salah. |
| Musik | YouTube Audio Library (gratis) atau Epidemic Sound (berlangganan) | Lo-fi/ambient elektronik pelan di bawah suara, naik saat transisi bab |
| SFX | Whoosh halus, klik, tick counter, "paper" | Volume rendah; untuk menegaskan gerakan, bukan mengganggu |
| Mixing | Lihat Standar audio di bawah | Bisa dikerjakan di DaVinci Resolve gratis |

Keputusan: klon suara Rafi dengan .srt. Sebelum render, narasi dibandingkan dengan naskah secara otomatis, dan bagian yang berbeda didengar lalu dibuat ulang kalau perlu.

Menurut YouTube Help, kloning suara sendiri untuk voiceover tidak wajib ditandai sebagai konten AI. Deskripsi channel tetap menyebutnya terus terang.

### Standar audio

Suara utama selalu nomor satu. Musik dan efek hanya pendukung, dan penonton tidak boleh harus berusaha mendengar narasi.

| Lapisan | Standar | Cara cek |
| --- | --- | --- |
| Hasil akhir | -14 LUFS, puncak maksimal -1.5 dBTP | Diukur otomatis saat render |
| Suara utama | Lapisan paling keras, kata-kata tetap jelas di speaker HP | Diukur, lalu didengar |
| Musik saat ada suara | 14 LU di bawah suara | Diatur otomatis dari pengukuran |
| Musik saat jeda dan chapter card | Boleh naik beberapa dB, lalu turun lagi saat suara masuk | Ducking otomatis |
| Rentang tengah musik | Dikurangi sekitar 4 dB di 2,5 kHz, supaya tidak berebut dengan suara | Otomatis |
| Efek aksen | 6 LU di bawah suara, maksimal 0,9 detik, sedikit mengecil saat ada kata | Diatur otomatis per suara |
| Efek latar | 12 LU di bawah suara, turun tajam saat ada kata | Diatur otomatis per suara |
| Pemilihan musik | Instrumental, tanpa vokal, tidak didominasi bass atau melodi yang menonjol | Diukur rentang 250 Hz sampai 4 kHz |

**Dasar angka:** panduan praktisi umumnya memakai rentang 15 sampai 24 dB untuk musik. Channel memilih 14 LU untuk musik, 12 LU untuk efek latar, dan 6 LU untuk efek aksen, setelah membandingkannya langsung. Ini keputusan final pemilik channel per 6 November 2026. Sebagai pembanding, WCAG 2.2 poin 1.4.7 menetapkan 20 dB untuk tingkat aksesibilitas tertinggi. Target -14 LUFS adalah kebiasaan yang umum untuk YouTube, belum dari dokumen resmi YouTube.

### Daftar efek suara

| Kelompok | Level | Fungsi | Efek |
| --- | --- | --- | --- |
| Aksen, transisi | 6 LU di bawah suara | Pergantian adegan dan bab | Whoosh pendek, classy, synthetic, deep, zoom in |
| Aksen, penekanan | 6 LU di bawah suara | Momen yang perlu terasa | Stempel (impact), palu (hit), boom, gong, dun dun, riser, slide down |
| Latar, suasana | 12 LU di bawah suara | Menghidupkan ilustrasi | Mesin, gear, angin, air, gelembung, alarm |
| Latar, antarmuka | 12 LU di bawah suara | Detail kecil saat angka dan teks muncul | Klik, pop, ketikan, shutter, tik-tok, kasir, sparkle, salah |

**Aturan pemakaian:**

- Efek aksen ditaruh tepat sebelum kata berikutnya dimulai, jangan di tengah kalimat penting.
- Efek baru masuk ke kelompok latar, kecuali memang berfungsi sebagai transisi atau penekanan.
- Efek pendek diukur dari bagian terkerasnya, karena LUFS kurang akurat untuk suara yang sangat pendek.

**Pemeriksaan akhir oleh manusia:** dengarkan dengan speaker HP dan earphone. Angka yang lolos belum menjamin enak didengar. Kalau musik masih mengganggu, turunkan lagi, jangan naikkan suara.

## Thumbnail & judul

Thumbnail dan judul bekerja sebagai satu paket: judul memancing pertanyaan, thumbnail memberi satu gambar yang membuat pertanyaan itu terasa nyata.

### Sistem thumbnail

- **Satu objek utama** besar di tengah-kanan (bijih nikel, motor ojol, semangkuk mi), digambar dengan gaya yang sama seperti video.
- **2–4 kata teks** di kiri, font Bricolage Grotesque, satu kata berwarna saffron. Teks tidak mengulang judul.
- **Latar navy** dengan siluet peta negara samar, supaya channel langsung dikenali di beranda.
- **Hindari pojok kanan bawah** untuk elemen penting, karena tertutup label durasi.
- **Satu elemen emosi:** panah merah turun, panah saffron naik, atau tanda tanya.
- Uji keterbacaan di ukuran 160 px lebar (seukuran tampilan di HP).

### Riset thumbnail (November 2026)

Dari video sejenis yang banyak ditonton, thumbnail yang efektif membuat penonton paham dalam satu detik: di mana, siapa, dan apa taruhannya. Riset ini baru mengamati tampilan dan jumlah views, belum data CTR.

- **Tunjukkan konteks.** Peta negara, bendera, atau tokoh nyata lebih kuat daripada benda umum seperti piala atau wastafel tanpa keterangan.
- **Tunjukkan konflik.** Angle Indonesia melawan Tiongkok berulang kali muncul di video nikel yang paling banyak ditonton.
- **Hubungkan ke penonton.** Contoh: mobil listrik mereka, atau uang mereka.
- **Teks adalah klaim atau pertanyaan yang tajam,** bukan label topik.
- **Uji di ukuran 168 px lebar.** Kalau ceritanya tidak terbaca, ganti konsepnya.

### Formula judul

| Pola | Contoh |
| --- | --- |
| How \[negara/perusahaan\] became \[hal mengejutkan\] | How Indonesia Took Over the World's Nickel |
| Why \[hal yang dikenal\] is \[masalah\] | Why Southeast Asia's Super-Apps Can't Make Money |
| The \[X\] nobody talks about | The Trillion-Dollar Strait Nobody Talks About |
| \[A\] vs \[B\]: \[taruhannya\] | Gojek vs Grab: The War That Had No Winner |

Aturan: judul di bawah 60 karakter, tidak clickbait palsu (isi video harus menjawab janji judul).

### A/B testing: 3 judul dan 3 thumbnail per video

Setiap video panjang wajib punya **3 paket judul dan thumbnail**, diuji lewat fitur A/B test di YouTube Studio.

**Cara kerja fitur (YouTube Help):**

- Maksimal 3 judul dan/atau thumbnail per video.
- Pemenang adalah yang menghasilkan **watch time tertinggi**, bukan yang paling banyak diklik.
- Hanya tersedia di YouTube Studio versi komputer.
- Mengubah judul atau thumbnail di tengah tes akan menghentikan tes, dan tes harus dimulai ulang.
- Opsi yang terlalu mirip membuat tes lebih lama dan bisa tanpa pemenang jelas.

**Aturan channel:**

1. **Paket disusun sebelum naskah.** Janji judul menentukan isi cold open dan alur video.
2. **Tiap paket beda sudut, bukan beda kata.** Contoh sudut: kekuasaan, misteri, dan dampak ke penonton. Ganti warna atau satu kata saja tidak dihitung.
3. **Tiap paket harus benar dan terjawab di video.** Ketiganya perlu bisa dibuktikan dari isi video yang sama.
4. **Cold open harus cocok dengan ketiga janji.** Karena pemenangnya diukur dari watch time, paket yang memancing klik tapi mengecewakan penonton akan kalah.
5. **Thumbnail boleh beda objek dan komposisi,** tapi tetap memakai palet, font, dan aturan keterbacaan channel. Teks thumbnail tidak mengulang judul.
6. **Paket yang paling kita yakini dipasang sebagai opsi pertama.**
7. **Tidak mengubah apa pun selama tes berjalan.**
8. **Catat hasilnya** di log: sudut, tiga paket, pemenang, dan watch time share. Setelah beberapa video, log ini menunjukkan sudut mana yang cocok untuk penonton The Equator Ledger.

**Keterbatasan:** kalau judul dan thumbnail diuji berpasangan, kita tahu paket mana yang menang, tapi tidak tahu elemen mana penyebabnya. Channel baru dengan penonton sedikit juga kemungkinan butuh waktu lebih lama untuk mendapat hasil.

## Aset channel yang perlu dibuat

Semua aset di bawah bisa saya buat dari kode (SVG/HTML → PNG/MP4) mengikuti palet dan font di atas.

- [x] Icon channel 800×800 px (SVG + PNG)
- [x] Banner channel 2560×1440 px, area aman 1546×423 px
- [x] Watermark video (icon transparan, 150×150 px)
- [x] Title sting 3 detik (MP4 1080p)
- [x] Contoh Chapter Card
- [x] Contoh lower-third (nama sumber, lokasi, tahun)
- [x] Template end screen 20 detik
- [x] Teks deskripsi channel dan template deskripsi video dalam bahasa Inggris
- [ ] Library elemen berulang. Baru ada versi awal: Map Stage, Money Flow, Number Counter, Document Snap. Belum ada: Chart Build, Company Card, Versus Split, Timeline Ribbon
- [ ] Template thumbnail dengan 3 varian (baru ada satu contoh)
- [ ] Log hasil A/B test

Semua aset yang sudah jadi ada di `motion/output/equator/channel-kit/`. Render memakai 1080p dulu; 4K belum perlu.

## 10 ide video pertama

Urutan disusun dari topik dengan hook global paling kuat. Fakta tiap video diriset ulang saat penulisan naskah; judul di bawah masih draf, dan tiap video nanti punya 3 paket judul dan thumbnail.

| # | Judul draf | Sudut global (kenapa penonton Barat peduli) |
| --- | --- | --- |
| 1 | How Indonesia Took Over the World's Nickel | Baterai mobil listrik mereka bergantung pada ini |
| 2 | Gojek vs Grab: The War That Had No Winner | Pelajaran soal super-app dan bakar uang startup |
| 3 | How Vietnam Is Quietly Replacing China | Rantai pasok barang yang mereka beli sehari-hari |
| 4 | Why Singapore Got So Rich With No Resources | Kisah "underdog" negara kecil |
| 5 | How Indomie Conquered Africa and the Middle East | Brand Asia yang mendunia tanpa disadari |
| 6 | The Strait That Controls Asia's Oil (Malacca) | Geopolitik dan harga energi global |
| 7 | Why the Philippines Runs on Money From Abroad | Ekonomi remitansi dan pekerja migran |
| 8 | How Thailand Became the "Detroit of Asia" | Industri otomotif Jepang di Asia Tenggara |
| 9 | The Palm Oil Dilemma: Malaysia and Indonesia | Produk di supermarket mereka dan isu lingkungan |
| 10 | How Shopee Beat Amazon in Southeast Asia | Kenapa raksasa Barat kalah di pasar ini |

## Alur produksi & jadwal

Jadwal awal: **1 video panjang setiap 2 minggu**, plus 2–3 Shorts yang dipotong dari tiap video. Kualitas dan konsistensi lebih penting daripada frekuensi di 6 bulan pertama.

| Tahap | Rafi | Claude |
| --- | --- | --- |
| 1. Pilih topik | Setujui topik dari daftar | Riset awal dan usulan sudut cerita |
| 2. Paket | Pilih 3 paket judul dan thumbnail | Usulan beberapa paket, dicek terhadap fakta |
| 3. Naskah | Edit, tambahkan insight & pengalaman orang dalam | Draf naskah bahasa Inggris + daftar sumber |
| 4. Storyboard | Setujui | Pecah naskah jadi scene, tentukan elemen visual tiap scene |
| 5. Voiceover | Dengarkan dan setujui narasi | Buat narasi dengan klon suara, cek terhadap naskah, buat file .srt |
| 6. Animasi | Review dan minta revisi | Bangun scene lewat kode, render MP4 1080p |
| 7. Edit akhir | Gabungkan VO, musik, SFX di DaVinci/CapCut | Bisa merakit sekaligus jika file VO dan musik dikirim |
| 8. Thumbnail & upload | Upload, pasang A/B test, jangan ubah selama tes | 3 thumbnail final, deskripsi, chapter timestamp |
| 9. Evaluasi | Kirim hasil tes dan data retensi | Catat di log, usulan perbaikan video berikutnya |

Batasan yang perlu diketahui sejak awal:

- Animasi dibuat dengan kode, jadi kuat untuk peta, grafik, tipografi, dan ikon. Animasi karakter frame-by-frame bukan kekuatannya, dan memang tidak dipakai di gaya ini.
- Ilustrasi tambahan (misalnya gambar objek untuk thumbnail) bisa dibuat oleh kamu
- Fakta dan angka di naskah tetap perlu Rafi baca ulang sebelum direkam, karena channel bisnis hidup dari kredibilitas.
