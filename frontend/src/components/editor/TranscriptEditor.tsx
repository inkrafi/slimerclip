'use client'

import { formatClock } from '@/lib/clip-meta'
import type { TranscriptSegment } from '@/lib/types'

interface Props {
  segments: TranscriptSegment[]
  /** Rentang klip saat ini (detik video sumber): hanya kalimat di dalamnya yang ditampilkan */
  range: [number, number]
  /** Posisi pemutar (detik video sumber) untuk menandai kalimat yang sedang diucapkan */
  playhead: number | null
  disabled?: boolean
  onSeek: (sourceTime: number) => void
  onChange: (segments: TranscriptSegment[]) => void
}

/**
 * Ganti teks satu kalimat. Jumlah kata sama → waktu per kata tetap; jika berbeda,
 * waktu kalimat dibagi rata ke kata-kata baru (cukup untuk sorotan kata di caption).
 */
function retext(seg: TranscriptSegment, text: string): TranscriptSegment {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return { ...seg, text: '', words: [] }
  if (tokens.length === seg.words.length) {
    return { ...seg, text, words: seg.words.map((w, i) => ({ ...w, word: tokens[i] })) }
  }
  const slot = (seg.end - seg.start) / tokens.length
  return {
    ...seg,
    text,
    words: tokens.map((word, i) => ({ word, start: seg.start + slot * i, end: seg.start + slot * (i + 1) })),
  }
}

/** Edit teks caption per kalimat (mis. membetulkan kata yang salah dengar). */
export default function TranscriptEditor({ segments, range, playhead, disabled, onSeek, onChange }: Props) {
  const visible = segments
    .map((seg, index) => ({ seg, index }))
    .filter(({ seg }) => seg.end > range[0] && seg.start < range[1])

  if (!visible.length) {
    return <p className="text-sm text-ink-muted">Tidak ada ucapan di rentang klip ini.</p>
  }

  return (
    <ol className="space-y-1.5">
      {visible.map(({ seg, index }) => {
        const active = playhead !== null && playhead >= seg.start && playhead < seg.end
        return (
          <li key={index} className={`flex items-start gap-2 rounded-md px-1.5 py-1 ${active ? 'bg-raised' : ''}`}>
            <button
              type="button"
              onClick={() => onSeek(seg.start)}
              className="timecode mt-1.5 w-11 shrink-0 text-left text-xs text-ink-faint hover:text-ink"
              aria-label={`Putar dari ${formatClock(seg.start)}`}
            >
              {formatClock(seg.start)}
            </button>
            <textarea
              id={`caption-seg-${index}`}
              rows={1}
              value={seg.text}
              disabled={disabled}
              aria-label={`Teks caption ${formatClock(seg.start)}`}
              onChange={e => onChange(segments.map((s, i) => (i === index ? retext(s, e.target.value) : s)))}
              className="field-sizing-content min-h-8 w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-ink hover:border-rule focus:border-signal focus:outline-none"
            />
          </li>
        )
      })}
    </ol>
  )
}
