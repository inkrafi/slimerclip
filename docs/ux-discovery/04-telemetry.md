# Telemetry & Metrik Sukses — Jasa clipping SlimerClip

**Visi 6 bulan** (dipilih pemilik produk): klien bertahan berbulan-bulan · pendapatan bulanan stabil · produksi efisien.
**Status**: baseline belum ada (jasa baru mulai). Target = asumsi awal, ditinjau ulang setelah 3 klien pertama.

## North Star

- **Metrik**: **jumlah klien berbayar aktif yang sudah memperpanjang ≥ 3 bulan berturut-turut**
- **Baseline**: 0 (belum ada klien)
- **Target 6 bulan**: 10 klien (asumsi: ±6 Indonesia + ±4 luar negeri)
- **Kenapa metrik ini**: hanya naik kalau klien benar-benar merasa uangnya kembali (job utama: channel tumbuh → layak disponsori). Tidak bisa digelembungkan dengan penjualan agresif seperti pendapatan, dan tidak dipengaruhi faktor luar seperti views mentah. Sekaligus mewakili ketiga visi: retensi, pendapatan stabil, dan (karena butuh banyak klien) produksi efisien.

## Metrik kesehatan (guard rail)

| Metrik | Menjaga dari | Target | Ambang waspada |
|---|---|---|---|
| Batch terkirim ≤ 3 hari sejak video diterima | Klien harus menagih (titik sakit fase 4) | ≥ 95% batch | < 85% dalam sebulan |
| Revisi per klip | Kualitas turun / tidak paham gaya klien | ≤ 0,3 | > 0,6 |
| Klaim hak cipta per 100 klip | Channel klien kena sanksi (fase 5) | 0 | ≥ 1 |
| Klip ditolak klien | Momen salah / salah kutip | ≤ 5% | > 10% |
| Waktu operator per klip (cek + sesuaikan) | Produksi tidak efisien, margin tergerus | ≤ 8 menit | > 15 menit |
| Render gagal | Pengiriman molor | ≤ 2% | > 5% |
| Kegagalan karena kuota Gemini | Produksi berhenti mendadak | 0 per minggu | ≥ 1 per minggu |
| Margin per klien (pendapatan − biaya API & waktu) | Tumbuh tapi rugi | ≥ 60% | < 40% |

## Metrik pendorong (leading indicator)

| Metrik | Memprediksi | Cara mengukur |
|---|---|---|
| **Pertumbuhan views klip klien 30 hari** | Klien memperpanjang (job utama) | Snapshot views tiap klip yang diunggah (48 jam & 7 hari) |
| % klip yang link unggahannya tercatat | Laporan bisa dibuat → retensi | Klip dengan `publish_url` / klip terkirim |
| % klien membuka laporan bulanan | Klien melihat nilai → perpanjang | Event `report_viewed` |
| % prospek membalas setelah menerima 3 klip contoh | Akuisisi klien | `prospect_sample_viewed` → balasan (dicatat manual) |
| % trial → bayar | Pendapatan & kualitas contoh | Status klien di catatan klien |
| Waktu klien dari notifikasi ke approve | Klien tidak repot (emosional: tenang) | `batch_delivered` → `clip_approved` |
| Tingkat edit otomatis dipertahankan | Efisiensi produksi | Bagian resep yang tidak diubah operator sebelum render |
| Perpanjangan bulan ke-1 → ke-2 | North Star 3 bulan | Catatan klien |

## Rencana event

Disimpan di backend SlimerClip sebagai log event append-only (mis. `cache/telemetry/events.jsonl` atau tabel Supabase `events`), tanpa pelacak pihak ketiga. `client_id` = ID preset klien.

### Akuisisi
**`prospect_sample_created`**
- Pemicu: operator membuat link contoh 3 klip untuk calon klien
- Properti: `client_id`: string (preset/prospek) · `clip_count`: int · `source`: "dm" | "email" | "marketplace"
- Menjawab: kanal mana yang paling banyak menghasilkan klien?
- Privasi: PII tidak (nama channel = data bisnis) · Persetujuan: tidak

**`prospect_sample_viewed`**
- Pemicu: link contoh dibuka pertama kali (dan setiap kali setelahnya)
- Properti: `client_id` · `clips_played`: int · `seconds_watched`: int · `device`: "mobile" | "desktop"
- Menjawab: apakah prospek benar-benar menonton contohnya, atau DM diabaikan?
- Privasi: PII tidak (tanpa IP/cookie pelacak) · Persetujuan: tidak (fungsional, diberitahu di link)

### Produksi (operator)
**`analysis_completed`**
- Pemicu: analisis video selesai
- Properti: `client_id` · `video_type`: string · `language`: string · `segments`: int · `duration_s`: int · `gemini_ms`: int
- Menjawab: berapa momen per episode, dan seberapa lama analisis?

**`clip_auto_edited` / `clip_operator_changed`**
- Pemicu: editor dibuka dengan edit otomatis / klip dirender
- Properti: `client_id` · `changed_parts`: string[] (hook, musik, sfx, voice, enhance, caption, trim) · `editor_seconds`: int
- Menjawab: bagian edit otomatis mana yang paling sering diganti operator? (target perbaikan otomatisasi)

**`clip_rendered`**
- Pemicu: render final selesai/gagal
- Properti: `client_id` · `status`: "ok" | "error" · `render_s`: int · `resolution`: string · `error_kind`: string?
- Menjawab: apakah render jadi penghambat pengiriman?

**`batch_delivered`**
- Pemicu: operator mengirim batch klip ke klien (link review/Drive)
- Properti: `client_id` · `clip_count`: int · `hours_since_source`: float
- Menjawab: apakah janji 1–3 hari terpenuhi?

### Klien (link review & laporan)
**`review_link_opened`**
- Properti: `client_id` · `batch_id` · `device`
- Menjawab: seberapa cepat klien melihat klip barunya?

**`clip_approved` / `revision_requested`**
- Properti: `client_id` · `clip_key` · `reason`: "momen" | "kutipan" | "gaya" | "musik" | "lainnya" · `note_length`: int
- Menjawab: jenis kesalahan apa yang paling sering? (prioritas perbaikan)

**`clip_published`**
- Pemicu: link Shorts/TikTok/Reels klip ditempel (oleh klien atau operator)
- Properti: `client_id` · `clip_key` · `platform`: "youtube" | "tiktok" | "instagram"
- Menjawab: berapa banyak klip yang benar-benar diunggah?

**`clip_performance_snapshot`**
- Pemicu: terjadwal, 48 jam & 7 hari setelah `clip_published`
- Properti: `client_id` · `clip_key` · `platform` · `views`: int · `likes`: int · `age_hours`: int · `viral_score`: int (skor analisis)
- Menjawab: klip mana yang bekerja? Apakah skor analisis memprediksi views? (kalibrasi pemilihan momen)
- Privasi: data publik video · Persetujuan: izin klien saat onboarding

**`report_viewed`**
- Properti: `client_id` · `period`: "YYYY-MM" · `seconds_on_page`: int · `downloaded_pdf`: bool
- Menjawab: apakah laporan dipakai (dan dibawa ke sponsor)?

### Bisnis (dicatat manual dulu)
**`client_status_changed`**
- Properti: `client_id` · `status`: "prospect" | "trial" | "paying" | "churned" · `plan`: string · `currency`: "IDR" | "USD" · `mrr`: number · `churn_reason`: string?
- Menjawab: North Star, MRR, % trial → bayar, alasan berhenti.

**`copyright_claim_reported`**
- Properti: `client_id` · `clip_key` · `platform` · `asset_kind`: "musik" | "sfx" | "video"
- Menjawab: guard rail hak cipta.

## Umpan balik kualitatif

| Sinyal | Cara mengumpulkan | Frekuensi | Pemilik |
|---|---|---|---|
| Kepuasan klien | 1 pertanyaan di WA/email bersama laporan: "Skala 1–10, seberapa puas bulan ini? Satu hal yang perlu diperbaiki?" | Bulanan | Operator |
| Alasan revisi | Kategori + catatan di `revision_requested` | Terus-menerus | Operator, ditinjau mingguan |
| Alasan berhenti | Wawancara singkat 10 menit saat klien berhenti/tidak memperpanjang | Setiap churn | Pemilik |
| Alasan prospek tidak membalas | Tanya 1 kali setelah 7 hari tanpa balasan | Per prospek | Operator |
| Validasi persona & JTBD | Wawancara 3–5 klien pertama (pemicu, job, cara menilai hasil) | Sekali, bulan pertama | Pemilik |

## Rencana respons

| Metrik | Jika membaik | Jika datar | Jika menurun |
|---|---|---|---|
| Klien aktif ≥ 3 bulan (North Star) | Naikkan harga paket baru, rekrut editor/operator kedua | Cek laporan: apakah klien melihat pertumbuhan? Wawancara 2 klien | Wawancara semua yang berhenti; perbaiki laporan & kualitas sebelum akuisisi baru |
| Pertumbuhan views klip klien | Jadikan studi kasus di `/jasa` | Uji hook/durasi/jadwal unggah berbeda per klien | Tinjau kalibrasi pemilihan momen (skor vs views), ubah profil klien |
| Batch ≤ 3 hari | Tawarkan paket lebih besar | Cari tahap lambat (analisis/render/review) | Batasi klien baru; tambah kapasitas render/operator |
| Revisi per klip | Kurangi waktu cek per klip | Lihat kategori revisi terbanyak | Perbaiki preset/prompt untuk kategori itu; brief ulang dengan klien |
| % trial → bayar | Perbanyak penawaran (DM/marketplace) | Uji contoh yang berbeda (3 vs 5 klip, momen berbeda) | Contoh kurang meyakinkan → perbaiki kualitas & personalisasi contoh |
| Waktu operator per klip | Tambah klien per operator | Lihat `changed_parts` terbanyak | Perbaiki edit otomatis di bagian yang paling sering diganti |
| Klaim hak cipta | — | — | Hentikan musik/SFX terkait di semua klien, audit pustaka musik |

## Implementasi bertahap

1. **Sekarang (tanpa membangun)**: catat klien di spreadsheet (status, paket, mata uang, tanggal mulai, perpanjangan) → North Star, MRR, % trial → bayar.
2. **Bersama link review**: event `batch_delivered`, `review_link_opened`, `clip_approved`, `revision_requested`.
3. **Bersama laporan**: `clip_published`, `clip_performance_snapshot`, `report_viewed`.
4. **Efisiensi**: `clip_operator_changed`, `clip_rendered`, waktu operator per klip.
