'use client'

import ScoreMeter from '@/components/ScoreMeter'
import { useInView } from '@/hooks/useInView'

// Contoh grafik "Most replayed" (bentuk tipikal: puncak di beberapa momen)
const CURVE = [18, 22, 20, 26, 35, 31, 28, 52, 88, 61, 40, 33, 30, 36, 44, 39, 33, 70, 96, 72, 45, 38, 34, 41, 37, 30, 28, 32, 26, 22]
const PEAK = 18

const ROWS = [
  { label: 'Isi momen menurut AI', value: 84, note: 'hook, emosi, daya tarik, penutup', weight: '50%' },
  { label: 'Data tonton ulang YouTube', value: 96, note: 'diputar ulang lebih sering dari 96% bagian lain', weight: '35%' },
  { label: 'Struktur', value: 100, note: '46 detik, 2,6 kata per detik', weight: '15%' },
]

export default function ScoreStory() {
  const { ref, inView } = useInView<HTMLElement>(0.3)
  const points = CURVE.map((v, i) => `${(i / (CURVE.length - 1)) * 100},${100 - v}`).join(' L')

  return (
    <section ref={ref} aria-labelledby="score-title" className="py-24 border-t border-rule grid gap-12 lg:grid-cols-2 items-center">
      <div>
        <h2 id="score-title" className="type-display text-ink text-[clamp(2rem,4vw,3.25rem)] max-w-[16ch]">
          Skornya dari data penonton, bukan tebakan.
        </h2>
        <p className="mt-5 max-w-[50ch] text-lg leading-relaxed text-ink-muted">
          AI menilai isi tiap momen. Lalu skor itu diuji dengan grafik bagian yang paling sering diputar ulang
          di YouTube, dan dengan durasi serta kepadatan bicaranya. Rinciannya selalu bisa kamu lihat.
        </p>
      </div>

      <div className={`reveal ${inView ? 'is-in' : ''} rounded-xl border border-rule glass p-6`}>
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-ink-muted">Contoh: podcast 54 menit</p>
          <ScoreMeter score={91} />
        </div>

        {/* Kurva tonton ulang dengan momen terpilih di puncaknya */}
        <div className="relative mt-5 h-32 rounded-md border border-rule bg-bay/40 overflow-hidden" aria-hidden>
          <svg className={`draw ${inView ? 'is-in' : ''} absolute inset-0 size-full`} viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d={`M${points}`} pathLength={1} fill="none" stroke="var(--color-teal)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <span
            className="absolute bottom-0 w-[6%] rounded-t-sm bg-signal/80 transition-[height] duration-1000 delay-700"
            style={{ left: `${(PEAK / (CURVE.length - 1)) * 100 - 3}%`, height: inView ? '92%' : '0%' }}
          />
          <span className="absolute left-2 top-2 text-xs text-ink-muted">Paling sering diputar ulang</span>
        </div>

        <dl className="mt-6 space-y-4">
          {ROWS.map((r, i) => (
            <div key={r.label}>
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <dt className="text-ink">{r.label} <span className="text-ink-faint">{r.weight}</span></dt>
                <dd className="timecode text-ink">{r.value}</dd>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-rule overflow-hidden">
                <div className="fill-bar h-full bg-ink-muted" style={{ width: `${r.value}%`, transitionDelay: `${500 + i * 200}ms` }} />
              </div>
              <p className="mt-1 text-xs text-ink-muted">{r.note}</p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
