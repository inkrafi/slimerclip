import { HeatmapPoint, Segment } from '@/lib/types'
import { angleOf, formatClock, toSeconds } from '@/lib/clip-meta'

interface Props {
  segments: Pick<Segment, 'segment_number' | 'start_time' | 'end_time' | 'viral_score' | 'content_angle'>[]
  /** Panjang video dalam detik */
  duration: number
  onSelect?: (segmentNumber: number) => void
  activeNumber?: number | null
  animate?: boolean
  label: string
  /** Grafik "Most replayed" YouTube, digambar samar di belakang penanda */
  heatmap?: HeatmapPoint[]
  /** Untuk tampilan sempit: hanya label awal & akhir di ruler */
  compact?: boolean
}

const TICK_STEPS = [30, 60, 120, 300, 600, 900, 1800, 3600]

/**
 * Peta potongan: seluruh durasi video sebagai satu timeline, dengan tiap momen
 * ditandai di posisi aslinya. Tinggi marker = skor viral, warna = label sudut konten.
 */
export default function CutMap({ segments, duration, onSelect, activeNumber, animate = false, label, heatmap, compact = false }: Props) {
  const step = TICK_STEPS.find(s => duration / s <= 8) ?? 7200
  const ticks: number[] = []
  for (let t = 0; t <= duration; t += step) ticks.push(t)

  const items = segments
    .map(seg => {
      const start = toSeconds(seg.start_time)
      const end = Math.max(toSeconds(seg.end_time), start + 1)
      return {
        seg,
        left: (start / duration) * 100,
        width: Math.max(((end - start) / duration) * 100, 0.6),
        // Skor di bawah 40 jarang muncul; rentang 40–100 dipetakan ke 15–100% agar selisihnya terlihat
        height: 15 + (Math.max(40, Math.min(100, seg.viral_score)) - 40) / 60 * 85,
      }
    })
    .sort((a, b) => a.left - b.left)

  // Nomor momen ditaruh di dua baris bergantian agar tidak saling tumpuk saat berdekatan
  const lastLeftInRow = [-Infinity, -Infinity]
  const labelled = items.map(item => {
    const center = item.left + item.width / 2
    const row = center - lastLeftInRow[0] >= 3 ? 0 : center - lastLeftInRow[1] >= 3 ? 1 : 0
    lastLeftInRow[row] = center
    return { ...item, center, row }
  })

  // Kurva tonton ulang: titik tengah tiap potongan heatmap, dinormalisasi ke tinggi lajur
  const maxHeat = Math.max(0, ...(heatmap ?? []).map(p => p.value))
  const heatPath = heatmap && heatmap.length > 1 && maxHeat > 0
    ? 'M0,100 ' + heatmap
        .map(p => `L${(((p.start_time + p.end_time) / 2) / duration) * 100},${100 - (p.value / maxHeat) * 85}`)
        .join(' ') + ' L100,100 Z'
    : null

  return (
    <figure className="w-full" aria-label={label}>
      {/* Nomor momen */}
      <div className="relative h-9" aria-hidden>
        {labelled.map(({ seg, center, row }) => (
          <span
            key={seg.segment_number}
            className={`timecode absolute -translate-x-1/2 text-[11px] font-bold leading-none ${
              activeNumber === seg.segment_number ? 'text-signal' : 'text-ink-muted'
            }`}
            style={{ left: `${center}%`, top: row === 0 ? 20 : 4 }}
          >
            {seg.segment_number}
          </span>
        ))}
      </div>

      {/* Lajur timeline */}
      <div className="relative h-20 rounded-md border border-rule glass overflow-hidden">
        {heatPath && (
          <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <path d={heatPath} fill="var(--color-ink)" fillOpacity="0.07" stroke="var(--color-ink-muted)" strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
        )}
        {ticks.slice(1).map(t => (
          <span key={t} className="absolute inset-y-0 w-px bg-rule/60" style={{ left: `${(t / duration) * 100}%` }} aria-hidden />
        ))}
        {labelled.map(({ seg, left, width, height }) => {
          const angle = angleOf(seg.content_angle)
          const active = activeNumber === seg.segment_number
          const style = {
            left: `${left}%`,
            width: `${width}%`,
            height: `${height}%`,
            background: angle.color,
            animationDelay: animate ? `${Math.round(left * 7)}ms` : undefined,
            boxShadow: active ? '0 0 0 2px var(--color-ink)' : undefined,
          }
          const a11y = `Momen ${seg.segment_number}, ${seg.start_time} sampai ${seg.end_time}, ${angle.label.toLowerCase()}, skor ${seg.viral_score}`
          return onSelect ? (
            <button
              key={seg.segment_number}
              type="button"
              onClick={() => onSelect(seg.segment_number)}
              title={a11y}
              aria-label={a11y}
              className={`absolute bottom-0 min-w-[6px] rounded-t-[3px] border-x border-bay/70 hover:brightness-110 ${animate ? 'marker-in' : ''}`}
              style={style}
            />
          ) : (
            <span
              key={seg.segment_number}
              className={`absolute bottom-0 min-w-[6px] rounded-t-[3px] border-x border-bay/70 ${animate ? 'marker-in' : ''}`}
              style={style}
              aria-hidden
            />
          )
        })}
      </div>

      {/* Ruler */}
      <div className="relative h-6 mt-1.5" aria-hidden>
        {/* Label tick terakhir dilewati jika terlalu dekat dengan label durasi di kanan */}
        {(compact ? [0] : ticks.filter(t => t / duration < 0.9)).map((t, i) => (
          <span
            key={t}
            className={`timecode absolute top-0 text-[11px] text-ink-faint ${i === 0 ? '' : '-translate-x-1/2'}`}
            style={{ left: `${(t / duration) * 100}%` }}
          >
            {formatClock(t)}
          </span>
        ))}
        <span className="timecode absolute top-0 right-0 text-[11px] text-ink-muted">{formatClock(duration)}</span>
      </div>
    </figure>
  )
}
