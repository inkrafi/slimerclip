# Pipeline klip SlimerClip

Dari link YouTube (atau file upload) sampai file klip 9:16 keluar. Path relatif terhadap root repo.

```
link/upload ─▶ 1 metadata ─▶ 2 transkrip ─▶ 3 pilih momen (Gemini) ─▶ 4 skor & rapikan batas
            ─▶ 5 unduh video ─▶ 6 tata letak 9:16 ┐
                                7 subtitle (Whisper)┴▶ 8 render FFmpeg (efek, audio) ─▶ .mp4
```

| # | Tahap | File utama | Model / library |
|---|-------|-----------|-----------------|
| 1 | **Metadata video**: judul, channel, durasi, deskripsi, grafik "Most replayed" (heatmap) | `backend/gemini_service.py` (`_extract_info`, `get_video_metadata`) | yt-dlp |
| 2 | **Transkrip seluruh video**: cache → youtube-transcript-api → subtitle/auto-caption lewat yt-dlp → Whisper lokal (file upload / admin). Bahasa mengikuti profil (atau id/en → caption bahasa asli), tanpa terjemahan otomatis YouTube. Hasilnya baris `(mulai, selesai, teks)` per potongan caption (±3–4 dtk), di-cache beserta bahasanya di `backend/cache/transcripts/` | `backend/transcript_service.py` | youtube-transcript-api, yt-dlp, faster-whisper `small` int8 (cadangan) |
| 3 | **Pemilihan momen**: transkrip diformat `[MM:SS - MM:SS] teks` dan dikirim bersama metadata. Prompt disusun dari **profil analisis** (admin): 4 kriteria wajib + daftar tolak, panduan per tipe video (podcast/solo/presentasi/streamer/game/lainnya, atau dideteksi otomatis), durasi & jumlah maksimal (minimal 3, "lebih baik sedikit yang bagus"), bahasa teks untuk penonton. Output: segmen + `hook_line`/`hook_start`, `detected_type`, `detected_language` | `backend/clip_profile.py`, `backend/prompt_templates.py`, `backend/gemini_service.py` (`_call_gemini`, `analyze_youtube_video`) | Gemini (`GEMINI_MODEL`, default `gemini-3.5-flash-lite`), mode JSON + skema |
| 4 | **Skor & batas waktu**: tempel awal/akhir ke batas *baris* transkrip terdekat (≤3 dtk), perpanjang/pangkas ke batas durasi profil (default 30–65 dtk), `floor`/`ceil` ke detik, buang/pangkas tumpang tindih. Skor akhir = 50% AI + 35% heatmap + 15% struktur (durasi & kata/detik); tanpa heatmap 80/20. Lalu filter niche dan kategori | `backend/scoring.py`, `backend/niche.py` | — |
| 5 | **Video sumber**: unduh sekali per video (atau file upload pengguna) | `backend/download_service.py` | yt-dlp |
| 6 | **Tata letak 9:16** (split atas-bawah hanya untuk tipe podcast/lainnya; tipe game: gameplay atas 60% + facecam bawah 40%, posisi facecam = sel grid yang paling sering berisi wajah, `plan_gaming`): sampel 10 fps, deteksi wajah, deteksi pergantian shot, aktivitas mulut sebagai penanda pembicara. Per run dipilih full / zoom ke pembicara / split atas-bawah / crop tengah; posisi crop = median posisi wajah per run, minimal bertahan 1,5 dtk | `backend/speaker_layout.py` | OpenCV YuNet (`models/face_detection_yunet_2023mar.onnx`), NumPy |
| 7 | **Titik potong & subtitle**: rentang dari analisis digeser ke lembah energi audio terdekat (jeda bicara, ±2,5 dtk ke luar / 1 dtk ke dalam; `refine_cut`), rentang hasil edit dipakai apa adanya. Lalu audio rentang klip (mono 16 kHz) → Whisper dengan timestamp per kata (bahasa dari profil/deteksi analisis, VAD 500 ms). Kata dikelompokkan jadi halaman caption (pisah di jeda >0,7 dtk atau akhir kalimat) → file ASS; teks non-Latin memakai font Noto sesuai aksara (`backend/script_fonts.py`, diunduh sekali). Render final juga menulis `<klip>.srt` (ikut ZIP & tombol SRT). Hasil disimpan `*.words.json` agar teks bisa diedit dan dirender ulang tanpa Whisper | `backend/render_pipeline.py` (`_transcript_for`), `backend/caption_service.py`, `backend/caption_styles.py` | faster-whisper `small` int8 (CPU), libass |
| 8 | **Render**: satu kali encode dari video sumber (`-ss` sebelum `-i`): crop/scale tata letak → unsharp bila upscale → vignette → caption ASS → hook → watermark/logo. Audio: suara asli selalu `dynaudnorm` (meratakan level antar pembicara) + `loudnorm` −14 LUFS, lalu dicampur musik/SFX bila ada (ducking musik) | `backend/render_pipeline.py` (`process_clip`), `backend/clip_effects.py` (`audio_graph`, hook, marks) | FFmpeg (libx264, AAC 192k) |
| — | **Thumbnail klip** (opsional): frame dengan wajah paling jelas + teks hook | `backend/thumbnail.py` | OpenCV YuNet |

**Edit otomatis** (`backend/auto_edit.py`): klip yang belum pernah diedit dibuka di editor (dan dirender lewat "render semua") dengan hook dari analisis, musik sesuai suasana momen (musik bawaan `backend/music/bgm_*.m4a` hasil `tools/make_music.py`, atau upload pengguna yang namanya mengandung kata suasana), efek suara (whoosh saat hook, boom sebelum `hook_line`, ding di angka; maks 4), penjernih suara (`highpass` + `afftdn` + EQ vokal), dan filter video HD (`hqdn3d` + `eq` + `unsharp`). Thumbnail dibuat otomatis saat editor pertama dibuka.

**Subtitle terjemahan** (`backend/subtitle_translate.py`): profil `subtitle_language` ≠ bahasa ucapan → kalimat Whisper diterjemahkan Gemini (1 panggilan per klip), waktu kata dipetakan ke urutan kata asli, lalu disimpan di `*.words.json` (bisa diedit di editor).

**Preset klien** (admin): `templates/<admin>/client_presets.json` = profil analisis + format edit; endpoint `/client-presets`.

**Orkestrasi & UI**
- `backend/app.py`: endpoint analisis, render (job di thread, `_render_lock` = satu render sekaligus), dan penyajian file bertanda tangan. `backend/jobs.py` menyimpan status job.
- Frontend (Next.js) hanya mengatur parameter, tidak memproses media:
  - `frontend/src/components/VideoWorkspace.tsx`: daftar momen dan filter niche.
  - Halaman klip/editor: pratinjau 540×960 tanpa efek, edit rentang/caption/hook, lalu render final.
- Supabase (`supabase/migrations/`) tidak memengaruhi kualitas output:
  - `profiles`, `user_videos`, `usage_events` dan kuota analisis gratis.
  - `0002`: pemakaian pratinjau.
  - `0003`: kolom `profiles.niche`.

**Catatan ukuran** (alasan `refine_cut`): baris transkrip YouTube itu potongan caption, bukan kalimat. Di 4 transkrip yang ada di cache, median panjang barisnya 3,1–4,3 detik, dan hanya **8–35%** baris yang berakhir dengan `.`, `?`, atau `!`.
