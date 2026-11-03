'use client'

import { useState } from 'react'

const BARS = [18, 26, 22, 34, 30, 44, 38, 52, 100, 92, 60, 40, 34, 46, 30, 24, 36, 28, 20, 26]
const PEAK = 80

interface Props {
  label: string
  /** Keterangan saat geser ke bagian biasa */
  normal: string
  /** Keterangan saat geser ke puncak */
  peak: string
  note: string
}

/** Momen interaktif: pengunjung menggeser sendiri dan melihat bagian mana yang akan jadi klip. Datanya ilustrasi. */
export default function ReplayScrubber({ label, normal, peak, note }: Props) {
  const [position, setPosition] = useState(3)
  const atPeak = BARS[position] > PEAK
  return (
    <div className="mt-8">
      <div className="flex h-28 items-end gap-1" aria-hidden>
        {BARS.map((height, i) => (
          <span key={i} className={`replay-bar flex-1 origin-bottom rounded-t-sm ${height > PEAK ? 'bg-signal' : i === position ? 'bg-white/70' : 'bg-white/15'}`} style={{ height: `${height}%` }} />
        ))}
      </div>
      <label className="mt-2 block">
        <span className="sr-only">{label}</span>
        <input type="range" min={0} max={BARS.length - 1} value={position} onChange={e => setPosition(Number(e.target.value))}
          aria-valuetext={atPeak ? peak : normal} className="replay-range h-11 w-full cursor-grab" />
      </label>
      <p aria-live="polite" className={`min-h-6 font-semibold ${atPeak ? 'text-signal' : 'text-ink'}`}>{atPeak ? peak : normal}</p>
      <p className="mt-1 text-xs text-ink-muted">{note}</p>
    </div>
  )
}
