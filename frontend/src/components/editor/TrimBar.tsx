'use client'

import { formatClock, formatSpan } from '@/lib/clip-meta'

interface Props {
  start: number
  end: number
  /** Batas geser (detik video sumber) */
  min: number
  max: number
  /** Rentang klip yang sudah dirender (bisa dipratinjau) */
  rendered: [number, number]
  /** Momen asli dari analisis */
  moment: { start: number; end: number }
  /** Titik penanda (detik video sumber), mis. efek suara */
  markers?: number[]
  /** Posisi pemutar pratinjau (detik video sumber), null jika di luar rentang render */
  playhead: number | null
  disabled?: boolean
  onChange: (start: number, end: number) => void
}

const MIN_SPAN = 3
const fmt = (s: number) => `${formatClock(Math.floor(s))}.${Math.floor((s % 1) * 10)}`

/** Potong awal & akhir klip pada rentang video sumber. */
export default function TrimBar({ start, end, min, max, rendered, moment, markers = [], playhead, disabled, onChange }: Props) {
  const pct = (t: number) => `${((t - min) / (max - min)) * 100}%`
  const width = (a: number, b: number) => `${((b - a) / (max - min)) * 100}%`

  return (
    <div>
      <div className="relative h-10 rounded-md bg-panel border border-rule overflow-hidden" aria-hidden>
        {/* Bagian yang sudah dirender (bisa diputar di pratinjau) */}
        <div className="absolute inset-y-0 bg-raised" style={{ left: pct(rendered[0]), width: width(rendered[0], rendered[1]) }} />
        {/* Rentang terpilih */}
        <div className="absolute inset-y-1 rounded-sm bg-signal/25 border border-signal" style={{ left: pct(start), width: width(start, end) }} />
        {/* Momen asli dari analisis */}
        <div className="absolute bottom-0 h-1 bg-teal" style={{ left: pct(moment.start), width: width(moment.start, moment.end) }} />
        {markers.filter(m => m >= min && m <= max).map((m, i) => (
          <div key={i} className="absolute top-0 h-2 w-1 -translate-x-1/2 rounded-b-sm bg-label-iris" style={{ left: pct(m) }} />
        ))}
        {playhead !== null && <div className="absolute inset-y-0 w-px bg-ink" style={{ left: pct(playhead) }} />}
      </div>
      <div className="relative -mt-10 h-10">
        <input
          type="range"
          className="trim-handle"
          aria-label="Awal klip"
          min={min}
          max={max}
          step={0.1}
          value={start}
          disabled={disabled}
          onChange={e => onChange(Math.min(Number(e.target.value), end - MIN_SPAN), end)}
        />
        <input
          type="range"
          className="trim-handle"
          aria-label="Akhir klip"
          min={min}
          max={max}
          step={0.1}
          value={end}
          disabled={disabled}
          onChange={e => onChange(start, Math.max(Number(e.target.value), start + MIN_SPAN))}
        />
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        <span className="timecode text-ink">{fmt(start)} – {fmt(end)}</span>
        <span>{formatSpan(end - start)}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1 w-3 bg-teal" aria-hidden /> momen asli</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3 bg-raised border border-rule" aria-hidden /> bisa dipratinjau</span>
        {markers.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-1 bg-label-iris" aria-hidden /> efek suara</span>}
      </p>
    </div>
  )
}
