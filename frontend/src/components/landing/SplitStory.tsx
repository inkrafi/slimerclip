'use client'

import { useCopy } from '@/components/LocaleProvider'

import { useScrollProgress } from '@/hooks/useScrollProgress'
import StudioImage from './StudioImage'

/** Opasitas yang naik di `from` dan turun di `to` (berdasarkan progres scroll --p). */
const windowed = (from: number, to: number) => ({
  opacity: `calc(clamp(0, (var(--p, 0) - ${from}) * 8, 1) * clamp(0, (${to} - var(--p, 0)) * 8, 1))`,
})

const STAGE_WINDOWS = [{ from: -1, to: 0.36 }, { from: 0.34, to: 0.64 }, { from: 0.62, to: 2 }]
const COPY = {
  id: {
    heading: 'Tata letak yang mengikuti pembicara',
    stages: [
      { title: 'Kamera lebar, dua orang ngobrol.', body: 'Crop tengah biasa akan memotong keduanya, atau malah menampilkan meja di antara mereka.' },
      { title: 'Wajah dicari, gerak mulut dibaca.', body: 'Sepuluh kali per detik SlimerClip melacak tiap orang dan mengukur siapa yang sedang bicara.' },
      { title: 'Bergantian bicara? Layar dibagi.', body: 'Orang kiri di atas, orang kanan di bawah. Saat satu orang bicara panjang, kamera zoom ke dia.' },
    ],
  },
  en: {
    heading: 'A layout that follows the speaker',
    stages: [
      { title: 'Wide shot, two people talking.', body: 'A plain center crop cuts both of them off, or shows the table between them.' },
      { title: 'Faces found, lips read.', body: 'Ten times per second SlimerClip tracks each person and measures who is speaking.' },
      { title: 'Taking turns? Split the screen.', body: 'Left person on top, right person below. When one person talks for a while, the camera zooms in on them.' },
    ],
  },
}

export default function SplitStory({ videoId }: { videoId?: string }) {
  // Reduced motion: langsung tampilkan keadaan akhir (layar terbagi)
  const ref = useScrollProgress<HTMLElement>('sticky', 1)
  const illustrated = !videoId
  const t = useCopy(COPY)
  const STAGES = t.stages.map((s, i) => ({ ...s, ...STAGE_WINDOWS[i] }))

  return (
    <section ref={ref} aria-labelledby="split-title" className="relative h-[260vh] border-t border-rule">
      <div className="sticky top-14 h-[calc(100vh-3.5rem)] grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center py-10">
        <div className="relative">
          <h2 id="split-title" className="sr-only">{t.heading}</h2>
          <div className="relative min-h-[15rem]">
            {STAGES.map((s, i) => (
              <div key={i} className="absolute inset-0" style={windowed(s.from, s.to)}>
                <p className="type-display text-ink text-[clamp(1.9rem,3.6vw,3rem)] max-w-[16ch]">{s.title}</p>
                <p className="mt-4 max-w-[44ch] text-lg leading-relaxed text-ink-muted">{s.body}</p>
              </div>
            ))}
          </div>
          {/* Indikator tahap */}
          <div className="mt-8 flex gap-2" aria-hidden>
            {STAGES.map((s, i) => (
              <span key={i} className="h-1 w-10 rounded-full bg-rule overflow-hidden">
                <span className="block h-full bg-signal" style={{ opacity: windowed(s.from, s.to).opacity }} />
              </span>
            ))}
          </div>
        </div>

        <div className="relative h-[min(520px,62vh)]" aria-hidden>
          {/* Shot lebar 16:9 */}
          <div
            className="absolute left-1/2 top-1/2 w-[min(560px,88vw)] aspect-video overflow-hidden rounded-xl border border-rule"
            style={{
              opacity: 'clamp(0, (0.62 - var(--p, 0)) * 6, 1)',
              transform: 'translate(-50%, -50%) scale(calc(1 - var(--p, 0) * 0.12))',
            }}
          >
            <StudioImage videoId={videoId} variant={0} hd className="size-full" />
            {/* Garis pindai: sedang menganalisis frame */}
            <span
              className="absolute inset-y-0 w-0.5 bg-teal shadow-[0_0_16px_var(--color-teal)]"
              style={{ left: 'calc(clamp(0, (var(--p, 0) - 0.3) * 3.4, 1) * 100%)', opacity: 'clamp(0, (var(--p, 0) - 0.28) * 10, 1)' }}
            />
            {illustrated && (
              <>
                <span className="absolute rounded-md border-2 border-teal" style={{ left: '21%', top: '27%', width: '16%', height: '28%', opacity: 'clamp(0, (var(--p, 0) - 0.36) * 8, 1)' }} />
                <span className="absolute rounded-md border-2 border-signal" style={{ left: '64%', top: '25%', width: '16%', height: '29%', opacity: 'clamp(0, (var(--p, 0) - 0.42) * 8, 1)' }} />
              </>
            )}
          </div>

          {/* Hasil: 9:16 terbagi dua */}
          <div
            className="absolute left-1/2 top-1/2 h-full aspect-[9/16] flex flex-col gap-1 overflow-hidden rounded-[1.6rem] border-[6px] border-[#0d0a24] bg-[#0d0a24] shadow-[0_30px_80px_-20px_rgb(61_214_198/0.4)]"
            style={{
              opacity: 'clamp(0, (var(--p, 0) - 0.55) * 6, 1)',
              transform: 'translate(-50%, -50%) scale(calc(0.9 + clamp(0, (var(--p, 0) - 0.55) * 2.5, 1) * 0.1))',
            }}
          >
            <div className="relative flex-1 overflow-hidden" style={{ transform: 'translateX(calc((1 - clamp(0, (var(--p, 0) - 0.58) * 4, 1)) * -40px))' }}>
              <StudioImage videoId={videoId} variant={0} hd className="absolute inset-0 size-full object-[22%_38%] scale-[1.9] origin-[22%_38%]" />
            </div>
            <div className="relative flex-1 overflow-hidden" style={{ transform: 'translateX(calc((1 - clamp(0, (var(--p, 0) - 0.62) * 4, 1)) * 40px))' }}>
              <StudioImage videoId={videoId} variant={0} hd className="absolute inset-0 size-full object-[76%_38%] scale-[1.9] origin-[76%_38%]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
