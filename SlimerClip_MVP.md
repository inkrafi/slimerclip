# SlimerClip — MVP Build Prompt
### Mode: Local Development | Phase 1 Only

---

## KONTEKS & TUJUAN

Kamu adalah developer yang bertugas membangun MVP sebuah web app bernama **SlimerClip**.

SlimerClip adalah tools untuk content clipper Indonesia. Cara kerjanya:
- User masukkan URL video YouTube (podcast Indonesia)
- App analisis video pakai Gemini AI
- App tampilkan rekomendasi segmen terbaik: timestamp, skor viral, hook, dan caption siap pakai
- User tinggal buka CapCut, potong di timestamp yang disarankan, pakai hook yang sudah disiapkan

**Ini Phase 1. Jangan bangun fitur di luar yang disebutkan di sini.**

---

## ATURAN UMUM SEBELUM MULAI CODING

1. Baca seluruh dokumen ini sampai selesai sebelum menulis satu baris kode pun
2. Jangan ubah tech stack — pakai persis yang disebutkan di bawah
3. Jangan tambah fitur ekstra yang tidak diminta (tidak perlu login, tidak perlu database, tidak perlu deploy)
4. Jika ada dua cara untuk melakukan sesuatu, pilih yang lebih sederhana
5. Semua komentar di kode dan teks UI harus dalam Bahasa Indonesia
6. Kedua service (Next.js dan Python) harus bisa dijalankan bersamaan di local

---

## ARSITEKTUR SISTEM

```
┌─────────────────────────────────────────────────┐
│  Browser                                        │
│  http://localhost:3000                          │
│                                                 │
│  Next.js + Tailwind + shadcn/ui                 │
│  - Tampilan UI                                  │
│  - Kirim request ke /api/analyze (proxy)        │
└─────────────┬───────────────────────────────────┘
              │ fetch POST /api/analyze
              ▼
┌─────────────────────────────────────────────────┐
│  Next.js API Route (/api/analyze/route.ts)      │
│  - Proxy request dari browser ke Python         │
│  - Sembunyikan URL backend dari browser         │
└─────────────┬───────────────────────────────────┘
              │ HTTP POST /analyze
              ▼
┌─────────────────────────────────────────────────┐
│  Python Backend (Flask)                         │
│  http://localhost:5000                          │
│  - Terima request dari Next.js                  │
│  - Kirim YouTube URL ke Gemini API              │
│  - Kembalikan hasil analisis sebagai JSON       │
└─────────────┬───────────────────────────────────┘
              │ Gemini API call
              ▼
┌─────────────────────────────────────────────────┐
│  Google Gemini 2.5 Flash API                    │
│  - Baca video YouTube langsung dari URL         │
│  - Temukan segmen terbaik                       │
│  - Kembalikan JSON terstruktur                  │
└─────────────────────────────────────────────────┘
```

**Penting:** Next.js TIDAK memanggil Gemini langsung. Semua panggilan ke Gemini dilakukan dari Python backend.

---

## TECH STACK

| Bagian | Teknologi | Port |
|--------|-----------|------|
| Frontend | Next.js 14 (App Router) + TypeScript | 3000 |
| Styling | Tailwind CSS | - |
| UI Components | shadcn/ui | - |
| Backend | Python 3.10+ dengan Flask | 5000 |
| AI | Google Gemini 2.5 Flash API | - |

---

## STRUKTUR FOLDER

```
slimerclip/
│
├── backend/
│   ├── app.py
│   ├── gemini_service.py
│   ├── prompt_templates.py
│   ├── requirements.txt
│   ├── .env
│   └── .gitignore
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.js
    ├── tailwind.config.ts
    ├── components.json          ← config shadcn
    ├── .env.local
    └── src/
        ├── app/
        │   ├── globals.css
        │   ├── layout.tsx
        │   ├── page.tsx
        │   └── api/
        │       └── analyze/
        │           └── route.ts
        ├── components/
        │   ├── ui/               ← komponen shadcn (auto-generated, jangan edit manual)
        │   ├── AnalyzeForm.tsx
        │   ├── SummaryBar.tsx
        │   └── SegmentCard.tsx
        └── lib/
            ├── utils.ts          ← file wajib shadcn (berisi fungsi cn())
            └── types.ts          ← semua TypeScript types
```

---

## SETUP PERINTAH (jalankan sekali di awal)

### Backend

```bash
cd slimerclip/backend
pip install -r requirements.txt
```

### Frontend

```bash
cd slimerclip/frontend

# 1. Buat project Next.js dengan Tailwind
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-git

# 2. Init shadcn — pilih tema "zinc" saat ditanya, style "default", pilih YES semua
npx shadcn@latest init

# 3. Install komponen shadcn yang dibutuhkan
npx shadcn@latest add card badge accordion toast button input select separator

# 4. Install dependency tambahan
npm install
```

---

## BAGIAN 1: BACKEND PYTHON

### FILE: `backend/requirements.txt`

```
flask==3.0.0
flask-cors==4.0.0
google-generativeai==0.8.0
python-dotenv==1.0.0
```

---

### FILE: `backend/.gitignore`

```
.env
__pycache__/
*.pyc
.DS_Store
```

---

### FILE: `backend/.env`

Nilai `your_api_key_here` akan diisi manual oleh user, jangan diganti apapun:

```
GEMINI_API_KEY=your_api_key_here
```

---

### FILE: `backend/prompt_templates.py`

Berisi satu fungsi yang mengembalikan prompt untuk Gemini. Salin persis, jangan ubah isi prompt.

```python
def get_clip_analysis_prompt(niche: str) -> str:
    return f"""
Kamu adalah seorang ahli content clipping untuk platform TikTok, YouTube Shorts, dan Instagram Reels yang fokus pada audiens Indonesia.

Tugasmu adalah menganalisis video podcast Indonesia dan menemukan segmen-segmen terbaik yang berpotensi viral sebagai short-form video (15 hingga 90 detik).

NICHE TARGET: {niche}

TUGAS UTAMA:
Tonton seluruh video, lalu identifikasi 5 sampai 8 segmen terbaik untuk dijadikan clip.

KRITERIA SEGMEN YANG BAGUS:
- Durasi ideal antara 20 hingga 90 detik
- Mengandung insight kuat, pernyataan mengejutkan, momen lucu, atau quote yang quotable
- Bisa berdiri sendiri tanpa konteks tambahan — penonton yang tidak kenal podcast ini tetap bisa paham
- Mengandung emosi: tawa, kaget, inspirasi, atau setuju yang kuat
- Relevan dengan niche {niche}

UNTUK SETIAP SEGMEN, BERIKAN OUTPUT DALAM FORMAT JSON BERIKUT:
{{
  "segments": [
    {{
      "segment_number": 1,
      "start_time": "MM:SS",
      "end_time": "MM:SS",
      "duration_seconds": 45,
      "topic": "Topik singkat segmen ini dalam 1 kalimat",
      "why_viral": "Penjelasan 2 hingga 3 kalimat kenapa segmen ini berpotensi viral",
      "emotion_trigger": "pilih salah satu: INSPIRASI / TAWA / KAGET / RELATE / KONTROVERSI",
      "viral_score": 85,
      "hooks": {{
        "hook_pertanyaan": "Contoh: Kenapa 90% orang Indonesia gagal nabung? Jawabannya bikin kaget...",
        "hook_pernyataan": "Contoh: Ini kesalahan finansial terbesar yang dilakukan orang bergaji UMR",
        "hook_teaser": "Contoh: Dia bilang sesuatu yang bikin gue nggak bisa tidur malam itu..."
      }},
      "caption_suggestion": "Teks caption pendek untuk TikTok/Reels, maksimal 100 karakter, dalam Bahasa Indonesia, sertakan 3 hashtag relevan",
      "subtitles_key_lines": [
        "Kalimat paling penting dari segmen ini yang bisa jadi teks overlay di video",
        "Kalimat kedua yang paling impactful dari segmen ini"
      ]
    }}
  ],
  "overall_video_summary": "Ringkasan video dalam 2 hingga 3 kalimat",
  "best_segment_number": 1,
  "total_clip_recommendations": 6
}}

ATURAN YANG HARUS DIIKUTI:
- Semua teks output harus dalam Bahasa Indonesia
- viral_score adalah angka bulat antara 1 sampai 100
- start_time dan end_time harus format MM:SS — benar: 12:30 — salah: 12.5
- Jangan rekomendasikan segmen lebih pendek dari 20 detik atau lebih panjang dari 90 detik
- hook_pertanyaan harus memancing rasa ingin tahu
- hook_pernyataan harus berani dan langsung ke inti
- hook_teaser harus membangun penasaran tanpa membocorkan isinya
- Setiap segmen harus bisa berdiri sendiri tanpa konteks tambahan

PENTING: Kembalikan HANYA JSON murni. Jangan tambahkan penjelasan, kalimat pembuka, markdown, atau backtick apapun di luar JSON.
"""
```

---

### FILE: `backend/gemini_service.py`

Mengurus semua komunikasi dengan Gemini API.

**Yang harus dilakukan:**
1. Load API key dari `.env`
2. Setup koneksi Gemini model `gemini-2.5-flash`
3. Fungsi `analyze_youtube_video` — kirim URL + niche ke Gemini, kembalikan dict Python
4. Bersihkan response Gemini yang kadang dibungkus markdown sebelum di-parse
5. Tangani semua error dengan pesan Bahasa Indonesia yang jelas

**Perhatikan:**
- Gemini 2.5 Flash bisa membaca YouTube URL langsung — tidak perlu download video
- Response kadang terbungkus ` ```json ... ``` ` meskipun sudah diminta tidak — bersihkan dengan `re.sub()` sebelum `json.loads()`

```python
import google.generativeai as genai
import json
import os
import re
from dotenv import load_dotenv
from prompt_templates import get_clip_analysis_prompt

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash")


def analyze_youtube_video(youtube_url: str, niche: str) -> dict:
    """
    Kirim YouTube URL ke Gemini untuk dianalisis.

    Parameter:
    - youtube_url: URL video YouTube public yang akan dianalisis
    - niche: nama niche konten, contoh "Podcast Bisnis & Finansial"

    Return:
    - dict berisi hasil analisis jika berhasil
    - dict dengan key "error" jika gagal
    """

    if "youtube.com" not in youtube_url and "youtu.be" not in youtube_url:
        return {"error": "URL tidak valid. Masukkan link YouTube yang benar."}

    prompt_text = get_clip_analysis_prompt(niche)

    try:
        response = model.generate_content([
            {
                "role": "user",
                "parts": [
                    {"text": f"Analisis video YouTube berikut ini: {youtube_url}"},
                    {"text": prompt_text}
                ]
            }
        ])

        raw_text = response.text.strip()

        # Bersihkan markdown wrapper jika ada
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```[a-z]*\n?", "", raw_text)
            raw_text = re.sub(r"\n?```$", "", raw_text)
            raw_text = raw_text.strip()

        return json.loads(raw_text)

    except json.JSONDecodeError:
        return {
            "error": "AI tidak mengembalikan format yang benar. Coba jalankan ulang.",
            "raw_response": raw_text if "raw_text" in locals() else "Tidak ada respons"
        }

    except Exception as e:
        msg = str(e)
        if "API_KEY" in msg or "credentials" in msg.lower():
            return {"error": "API Key tidak valid. Cek file backend/.env dan pastikan GEMINI_API_KEY sudah diisi."}
        if "quota" in msg.lower():
            return {"error": "Kuota Gemini API habis hari ini. Coba lagi besok."}
        if "not found" in msg.lower() or "unable to access" in msg.lower():
            return {"error": "Video tidak bisa diakses. Pastikan video YouTube berstatus Public."}
        return {"error": f"Terjadi kesalahan: {msg}"}
```

---

### FILE: `backend/app.py`

File utama Flask.

**Yang harus dilakukan:**
1. Setup Flask dengan CORS diaktifkan untuk `http://localhost:3000`
2. Route `GET /` sebagai health check
3. Route `POST /analyze` — validasi input, panggil service, kembalikan JSON

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
from gemini_service import analyze_youtube_video

app = Flask(__name__)

# Wajib aktifkan CORS — Next.js di port 3000 memanggil Flask di port 5000
# Tanpa ini browser akan memblokir request karena beda origin
CORS(app, origins=["http://localhost:3000"])


@app.route("/")
def health_check():
    return jsonify({"status": "ok", "service": "SlimerClip Backend"})


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Terima YouTube URL dan niche, kembalikan hasil analisis Gemini.

    Request body (JSON):
    {
        "youtube_url": "https://www.youtube.com/watch?v=...",
        "niche": "Podcast Bisnis & Finansial"
    }

    Response sukses (200): JSON hasil analisis
    Response error (400/422): { "error": "pesan error" }
    """

    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body kosong."}), 400

    youtube_url = data.get("youtube_url", "").strip()
    niche = data.get("niche", "Podcast Bisnis & Finansial").strip()

    if not youtube_url:
        return jsonify({"error": "youtube_url tidak boleh kosong."}), 400

    result = analyze_youtube_video(youtube_url, niche)

    if "error" in result:
        return jsonify(result), 422

    return jsonify(result), 200


if __name__ == "__main__":
    print("")
    print("  ╔══════════════════════════════════╗")
    print("  ║   SlimerClip Backend v0.1        ║")
    print("  ║   Berjalan di: localhost:5000    ║")
    print("  ╚══════════════════════════════════╝")
    print("")
    app.run(debug=True, port=5000)
```

---

## BAGIAN 2: FRONTEND NEXT.JS

### FILE: `frontend/.env.local`

```
PYTHON_BACKEND_URL=http://localhost:5000
```

---

### FILE: `frontend/src/lib/types.ts`

Semua TypeScript types yang dipakai di seluruh frontend. Buat file ini dulu sebelum komponen apapun.

```typescript
export interface Hooks {
  hook_pertanyaan: string
  hook_pernyataan: string
  hook_teaser: string
}

export interface Segment {
  segment_number: number
  start_time: string
  end_time: string
  duration_seconds: number
  topic: string
  why_viral: string
  emotion_trigger: string
  viral_score: number
  hooks: Hooks
  caption_suggestion: string
  subtitles_key_lines: string[]
}

export interface AnalysisResult {
  segments: Segment[]
  overall_video_summary: string
  best_segment_number: number
  total_clip_recommendations: number
  error?: string
}

export const NICHE_OPTIONS = [
  'Podcast Bisnis & Finansial',
  'Podcast Self-Development & Mental Health',
  'Podcast Humor & Obrolan Santai',
  'Podcast Motivasi & Inspirasi',
  'Podcast Teknologi & Startup',
] as const
```

---

### FILE: `frontend/src/app/globals.css`

Tambahkan CSS variables warna SlimerClip di bawah `@tailwind` directives yang sudah ada.
Jangan hapus baris `@tailwind` yang sudah di-generate oleh setup.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --accent: #c8f135;
  --accent-dim: #a0c020;
}

/* Override warna dark mode default shadcn agar sesuai tema SlimerClip */
.dark {
  --background: 0 0% 4%;        /* #0a0a0a */
  --foreground: 0 0% 94%;       /* #f0f0f0 */
  --card: 0 0% 7%;              /* #111111 */
  --card-foreground: 0 0% 94%;
  --border: 0 0% 12%;           /* #1e1e1e */
  --muted: 0 0% 15%;
  --muted-foreground: 0 0% 45%;
  --primary: 75 88% 57%;        /* #c8f135 accent hijau-kuning */
  --primary-foreground: 0 0% 0%;
}
```

---

### FILE: `frontend/src/app/layout.tsx`

Root layout. Set dark mode secara permanen dan import Google Fonts.

```tsx
import type { Metadata } from 'next'
import { Syne, Space_Mono } from 'next/font/google'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '700', '800'],
  variable: '--font-syne',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'SlimerClip — Clip Smarter. Go Viral.',
  description: 'Tools analisis konten YouTube untuk content clipper Indonesia',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // class "dark" di sini mengaktifkan dark mode Tailwind secara permanen
    <html lang="id" className={`dark ${syne.variable} ${spaceMono.variable}`}>
      <body className="bg-background text-foreground font-[var(--font-syne)]">
        {children}
      </body>
    </html>
  )
}
```

---

### FILE: `frontend/src/app/api/analyze/route.ts`

API Route Next.js sebagai proxy ke Python backend.

**Kenapa perlu ini:** URL backend tersimpan di `.env.local` yang hanya terbaca di server-side. Browser tidak boleh langsung memanggil Python backend.

```typescript
import { NextRequest, NextResponse } from 'next/server'

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:5000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const response = await fetch(`${PYTHON_BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })

  } catch {
    // Error ini terjadi jika Python backend tidak bisa dihubungi
    return NextResponse.json(
      { error: 'Backend Python tidak bisa dihubungi. Pastikan app.py sudah dijalankan di terminal terpisah.' },
      { status: 503 }
    )
  }
}
```

---

### FILE: `frontend/src/components/AnalyzeForm.tsx`

Komponen form input. Berisi field URL, dropdown niche, dan tombol submit.

**Komponen shadcn yang dipakai:** `Button`, `Input`, `Select` (beserta sub-komponennya: `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`), `Card`, `CardContent`, `CardHeader`, `CardTitle`.

**Yang harus dilakukan komponen ini:**
- Terima props: `onSubmit(url, niche)`, `isLoading: boolean`
- Manage state `url` dan `niche` secara internal
- Validasi: jika URL kosong saat submit, tampilkan pesan error inline (jangan pakai alert)
- Tombol disabled dan text berubah jadi "Menganalisis..." saat `isLoading = true`
- User bisa tekan Enter di field URL untuk submit

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NICHE_OPTIONS } from '@/lib/types'

interface Props {
  onSubmit: (url: string, niche: string) => void
  isLoading: boolean
}

export default function AnalyzeForm({ onSubmit, isLoading }: Props) {
  const [url, setUrl] = useState('')
  const [niche, setNiche] = useState(NICHE_OPTIONS[0])
  const [urlError, setUrlError] = useState('')

  const handleSubmit = () => {
    if (!url.trim()) {
      setUrlError('YouTube URL tidak boleh kosong.')
      return
    }
    setUrlError('')
    onSubmit(url.trim(), niche)
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
          Input Video
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Field YouTube URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            YouTube URL
          </label>
          <Input
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (urlError) setUrlError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="font-mono text-sm"
          />
          {/* Pesan error inline jika URL kosong */}
          {urlError && (
            <p className="text-xs text-destructive font-mono">{urlError}</p>
          )}
        </div>

        {/* Dropdown niche */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Niche Konten
          </label>
          <Select value={niche} onValueChange={setNiche}>
            <SelectTrigger className="font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NICHE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt} className="font-mono text-sm">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tombol submit */}
        <Button
          className="w-full font-bold text-black"
          style={{ backgroundColor: 'var(--accent)' }}
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? 'Menganalisis...' : '⚡ Analisis Video'}
        </Button>

      </CardContent>
    </Card>
  )
}
```

---

### FILE: `frontend/src/components/SummaryBar.tsx`

Komponen ringkasan video. Tampil di atas daftar segment setelah analisis selesai.

**Komponen shadcn yang dipakai:** `Card`, `CardContent`, `Badge`.

```tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AnalysisResult } from '@/lib/types'

interface Props {
  result: AnalysisResult
}

export default function SummaryBar({ result }: Props) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-5 space-y-3">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Ringkasan Video
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {result.overall_video_summary}
        </p>
        <Badge
          className="text-black font-mono text-xs font-bold"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          ⭐ Best clip: Segmen #{result.best_segment_number} dari {result.total_clip_recommendations} rekomendasi
        </Badge>
      </CardContent>
    </Card>
  )
}
```

---

### FILE: `frontend/src/components/SegmentCard.tsx`

Komponen satu segment card. Bisa dibuka dan ditutup (accordion).

**Komponen shadcn yang dipakai:** `Accordion`, `AccordionContent`, `AccordionItem`, `AccordionTrigger`, `Badge`, `Card`, `Separator`.

**Yang harus dilakukan komponen ini:**
- Terima props: `segment: Segment`, `isBest: boolean`, `onCopy: (text: string) => void`
- Card best langsung terbuka saat pertama render (defaultValue accordion = item terbuka)
- Header card menampilkan: nomor segmen, topik, badge BEST (jika best), viral score pill berwarna, timestamp
- Body card menampilkan: emosi, alasan viral, 3 pilihan hook (klik salin), key lines, caption (klik salin)
- Setiap hook dan caption: klik langsung copy ke clipboard, lalu panggil `onCopy` untuk trigger toast
- Viral score pill: hijau jika ≥80, kuning jika 60–79, merah jika <60
- Emotion tag: warna berbeda per jenis emosi (INSPIRASI=biru, TAWA=kuning, KAGET=oranye, RELATE=ungu, KONTROVERSI=merah)

```tsx
'use client'

import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Segment } from '@/lib/types'

interface Props {
  segment: Segment
  isBest: boolean
  onCopy: (text: string) => void
}

// Warna pill viral score
function getScoreStyle(score: number) {
  if (score >= 80) return 'bg-emerald-950 text-emerald-400 border border-emerald-700'
  if (score >= 60) return 'bg-amber-950 text-amber-400 border border-amber-700'
  return 'bg-red-950 text-red-400 border border-red-700'
}

// Warna emotion tag per jenis emosi
function getEmotionStyle(emotion: string) {
  const map: Record<string, string> = {
    INSPIRASI:    'bg-sky-950 text-sky-400 border-sky-700',
    TAWA:         'bg-yellow-950 text-yellow-400 border-yellow-700',
    KAGET:        'bg-orange-950 text-orange-400 border-orange-700',
    RELATE:       'bg-violet-950 text-violet-400 border-violet-700',
    KONTROVERSI:  'bg-red-950 text-red-400 border-red-700',
  }
  return map[emotion] || map['RELATE']
}

export default function SegmentCard({ segment: seg, isBest, onCopy }: Props) {
  // copiedKey melacak item mana yang baru saja disalin untuk tampilkan feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const emotion = (seg.emotion_trigger || 'RELATE').replace(/\s/g, '').toUpperCase()

  // Salin teks ke clipboard dan tampilkan feedback selama 2 detik
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    onCopy(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Label hook yang lebih mudah dibaca
  const hookLabels: Record<string, string> = {
    hook_pertanyaan: 'Pertanyaan',
    hook_pernyataan: 'Pernyataan',
    hook_teaser: 'Teaser',
  }

  return (
    <Card className={`overflow-hidden ${isBest ? 'border-[var(--accent)]' : ''}`}>
      <Accordion
        type="single"
        collapsible
        // Card best langsung terbuka, card lain tertutup
        defaultValue={isBest ? 'content' : undefined}
      >
        <AccordionItem value="content" className="border-0">

          {/* Header card */}
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 [&>svg]:hidden">
            <div className="flex items-center justify-between w-full gap-3">

              {/* Kiri: nomor, topik, badge best */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-mono text-xs text-muted-foreground shrink-0">
                  #{seg.segment_number}
                </span>
                <span className="font-bold text-sm truncate text-left">
                  {seg.topic}
                </span>
                {isBest && (
                  <Badge
                    className="text-black font-mono text-[10px] shrink-0"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    ⭐ BEST
                  </Badge>
                )}
              </div>

              {/* Kanan: viral score, timestamp, chevron shadcn */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${getScoreStyle(seg.viral_score)}`}>
                  {seg.viral_score}
                </span>
                <span className="font-mono text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded">
                  {seg.start_time} – {seg.end_time}
                </span>
              </div>

            </div>
          </AccordionTrigger>

          {/* Body card */}
          <AccordionContent className="px-4 pb-4">
            <Separator className="mb-4" />
            <div className="space-y-5">

              {/* Emosi utama */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Emosi Utama
                </p>
                <span className={`inline-block font-mono text-xs px-2.5 py-0.5 rounded-full border ${getEmotionStyle(emotion)}`}>
                  {emotion}
                </span>
              </div>

              {/* Kenapa bisa viral */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Kenapa Bisa Viral
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {seg.why_viral}
                </p>
              </div>

              {/* Pilihan hook */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Pilihan Hook — klik untuk salin
                </p>
                <div className="space-y-2">
                  {Object.entries(seg.hooks).map(([key, val]) => {
                    const copyKey = `hook-${seg.segment_number}-${key}`
                    const isCopied = copiedKey === copyKey
                    return (
                      <div
                        key={key}
                        onClick={() => handleCopy(val, copyKey)}
                        className="relative bg-background border border-border rounded-lg p-3 cursor-pointer hover:border-white/20 transition-colors"
                      >
                        <span className="absolute top-2 right-3 font-mono text-[10px] text-muted-foreground">
                          {isCopied ? (
                            <span style={{ color: 'var(--accent)' }}>✓ Tersalin</span>
                          ) : 'klik salin'}
                        </span>
                        <p className="font-mono text-[10px] uppercase tracking-widest mb-1"
                           style={{ color: 'var(--accent)' }}>
                          {hookLabels[key] || key}
                        </p>
                        <p className="text-sm leading-snug pr-16">{val}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Key lines untuk teks overlay */}
              {seg.subtitles_key_lines?.length > 0 && (
                <div className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Key Lines untuk Teks Overlay
                  </p>
                  <div className="space-y-1.5">
                    {seg.subtitles_key_lines.map((line, i) => (
                      <div
                        key={i}
                        className="font-mono text-xs text-muted-foreground bg-background border-l-2 pl-3 py-1.5 rounded-r"
                        style={{ borderLeftColor: 'var(--accent)' }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Caption TikTok */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Caption TikTok — klik untuk salin
                </p>
                <div
                  onClick={() => handleCopy(seg.caption_suggestion, `caption-${seg.segment_number}`)}
                  className="relative bg-background border border-dashed border-border rounded-lg p-3 cursor-pointer hover:border-white/20 transition-colors font-mono text-xs leading-relaxed text-muted-foreground"
                >
                  <span className="absolute top-2 right-3 font-mono text-[10px] text-muted-foreground">
                    {copiedKey === `caption-${seg.segment_number}` ? (
                      <span style={{ color: 'var(--accent)' }}>✓ Tersalin</span>
                    ) : 'klik salin'}
                  </span>
                  <span className="pr-16">{seg.caption_suggestion}</span>
                </div>
              </div>

            </div>
          </AccordionContent>

        </AccordionItem>
      </Accordion>
    </Card>
  )
}
```

---

### FILE: `frontend/src/app/page.tsx`

Halaman utama. Orkestrasi semua komponen dan state global.

**Yang harus dilakukan:**
1. Render `AnalyzeForm` — passing fungsi `handleAnalyze` dan state `isLoading`
2. Saat `handleAnalyze` dipanggil: kirim POST ke `/api/analyze`, simpan hasil ke state `result`
3. Tampilkan status loading dan error menggunakan shadcn `Alert` atau elemen sederhana
4. Render `SummaryBar` dan daftar `SegmentCard` setelah data masuk
5. Toast notifikasi muncul saat ada teks yang disalin — gunakan shadcn `useToast` + `Toaster`

**Perhatikan:**
- `useToast` dari shadcn harus diimport dari `@/components/ui/use-toast`
- Komponen `<Toaster />` harus dirender di dalam halaman ini (atau di layout.tsx)
- Semua fetch ke `/api/analyze` — bukan ke Python langsung

```tsx
'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import AnalyzeForm from '@/components/AnalyzeForm'
import SummaryBar from '@/components/SummaryBar'
import SegmentCard from '@/components/SegmentCard'
import { AnalysisResult } from '@/lib/types'

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const { toast } = useToast()

  // Dipanggil saat user klik tombol di AnalyzeForm
  const handleAnalyze = async (url: string, niche: string) => {
    setResult(null)
    setErrorMsg(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_url: url, niche }),
      })

      const data: AnalysisResult = await response.json()

      if (data.error) {
        setErrorMsg(data.error)
        return
      }

      setResult(data)

    } catch {
      setErrorMsg('Tidak bisa terhubung ke server. Pastikan backend Python sudah dijalankan.')
    } finally {
      setIsLoading(false)
    }
  }

  // Dipanggil setiap kali user salin teks dari hook atau caption
  const handleCopy = () => {
    toast({
      description: '✓ Teks berhasil disalin ke clipboard',
      duration: 1800,
    })
  }

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <header className="text-center mb-10">
          <h1
            className="text-5xl font-extrabold tracking-tighter"
            style={{ color: 'var(--accent)', fontFamily: 'var(--font-syne)' }}
          >
            SlimerClip
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-2 tracking-widest uppercase">
            // Clip Smarter. Go Viral. — Powered by Gemini AI
          </p>
        </header>

        {/* Form input */}
        <AnalyzeForm onSubmit={handleAnalyze} isLoading={isLoading} />

        {/* Status loading */}
        {isLoading && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-900 bg-yellow-950/30 mb-6 font-mono text-sm text-yellow-400">
            {/* Spinner animasi sederhana */}
            <div className="w-4 h-4 border-2 border-yellow-800 border-t-yellow-400 rounded-full animate-spin shrink-0" />
            <span>Gemini sedang membaca video... Proses ini bisa 30–90 detik.</span>
          </div>
        )}

        {/* Status error */}
        {errorMsg && !isLoading && (
          <div className="p-4 rounded-lg border border-red-900 bg-red-950/30 mb-6 font-mono text-sm text-red-400">
            ❌ {errorMsg}
          </div>
        )}

        {/* Ringkasan video */}
        {result && <SummaryBar result={result} />}

        {/* Daftar segment cards */}
        {result?.segments && result.segments.length > 0 && (
          <div className="space-y-3">
            {result.segments.map((seg) => (
              <SegmentCard
                key={seg.segment_number}
                segment={seg}
                isBest={seg.segment_number === result.best_segment_number}
                onCopy={handleCopy}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="text-center mt-16 font-mono text-xs text-muted-foreground/30">
          SlimerClip MVP v0.1 — local build
        </footer>

      </div>

      {/* Toaster harus dirender di sini agar toast bisa muncul */}
      <Toaster />
    </div>
  )
}
```

---

## CARA MENJALANKAN (2 terminal terpisah, bersamaan)

### Terminal 1 — Python Backend
```bash
cd slimerclip/backend
pip install -r requirements.txt
python app.py
```
Backend berjalan di: **http://localhost:5000**

### Terminal 2 — Next.js Frontend
```bash
cd slimerclip/frontend
npm install
npm run dev
```
Frontend berjalan di: **http://localhost:3000**

Buka browser: **http://localhost:3000**

---

## CHECKLIST SEBELUM TESTING

- [ ] Semua file sudah dibuat sesuai struktur folder
- [ ] `backend/.env` sudah diisi dengan Gemini API key yang valid (dari https://aistudio.google.com)
- [ ] `pip install -r requirements.txt` berhasil di folder backend
- [ ] `npm install` berhasil di folder frontend
- [ ] Terminal 1: `python app.py` berjalan di port 5000
- [ ] Terminal 2: `npm run dev` berjalan tanpa TypeScript error
- [ ] Browser bisa buka `http://localhost:3000`
- [ ] Test dengan video YouTube podcast Indonesia berstatus Public, minimal 10 menit

---

## TROUBLESHOOTING

| Error | Solusi |
|---|---|
| `ModuleNotFoundError` di backend | `pip install -r requirements.txt` ulang |
| `API Key not valid` | Cek `backend/.env`, tidak boleh ada spasi di sekitar `=` |
| `Video tidak bisa diakses` | Pastikan video YouTube statusnya Public |
| Cannot connect to backend di browser | Pastikan `python app.py` sudah jalan di terminal lain |
| CORS error di browser console | Pastikan `flask-cors` terinstall dan `CORS(app)` ada di `app.py` |
| shadcn component not found | Jalankan ulang `npx shadcn@latest add [nama-komponen]` |
| TypeScript error | Cek apakah semua import path sudah benar (`@/components/ui/...`) |
| Port 5000 sudah dipakai | Ganti `port=5000` di `app.py` jadi `port=5001`, update `frontend/.env.local` |

---

## CATATAN BIAYA

Gemini API gratis untuk 1.500 request/hari pada model Flash.
Satu kali klik Analisis = satu request.
Untuk penggunaan lokal pribadi, gratis tier lebih dari cukup.

---

*SlimerClip MVP v0.1 — Antigravity Build Prompt*
