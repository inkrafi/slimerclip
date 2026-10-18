import { Segment } from '@/lib/types'

/** "MM:SS" atau "HH:MM:SS" → detik (menit boleh > 59, mis. "75:30"). */
export function toSeconds(time: string): number {
  const parts = (time || '').split(':').map(Number)
  if (parts.some(Number.isNaN)) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] || 0
}

/** Detik → "1:07:05" atau "7:05". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

/** Durasi singkat untuk dibaca: "45 dtk", "1 mnt 20 dtk", "1 jam 47 mnt". */
export function formatSpan(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return m > 0 ? `${h} jam ${m} mnt` : `${h} jam`
  if (m > 0) return sec > 0 ? `${m} mnt ${sec} dtk` : `${m} mnt`
  return `${sec} dtk`
}

/** Panjang video untuk peta potongan: dari metadata, atau akhir segmen terakhir. */
export function videoLength(segments: Segment[], metadataDuration?: number): number {
  const lastEnd = Math.max(0, ...segments.map(s => toSeconds(s.end_time)))
  return Math.max(metadataDuration || 0, lastEnd, 1)
}

/** Warna label klip per sudut konten (seperti label klip di timeline editor). */
const ANGLES: Record<string, { label: string; color: string }> = {
  EDUKASI:     { label: 'Edukasi',     color: 'var(--color-label-cerulean)' },
  HIBURAN:     { label: 'Hiburan',     color: 'var(--color-label-rose)' },
  INSPIRASI:   { label: 'Inspirasi',   color: 'var(--color-label-caribbean)' },
  KONTROVERSI: { label: 'Kontroversi', color: 'var(--color-label-iris)' },
  TUTORIAL:    { label: 'Tutorial',    color: 'var(--color-label-olive)' },
}

export function angleOf(angle?: string) {
  const key = (angle || '').trim().toUpperCase()
  return ANGLES[key] ?? { label: angle ? angle.charAt(0) + angle.slice(1).toLowerCase() : 'Lainnya', color: 'var(--color-ink-muted)' }
}

const EMOTIONS: Record<string, string> = {
  INSPIRASI: 'bikin terinspirasi',
  TAWA: 'bikin ketawa',
  KAGET: 'bikin kaget',
  RELATE: 'relate',
  KONTROVERSI: 'memancing debat',
}

export function emotionOf(emotion?: string): string {
  const key = (emotion || '').replace(/\s/g, '').toUpperCase()
  return EMOTIONS[key] ?? (emotion || '').toLowerCase()
}

/** Tingkat skor viral — dipakai sebagai keterangan meter. */
export function scoreTier(score: number): string {
  if (score >= 90) return 'Panas'
  if (score >= 80) return 'Kuat'
  if (score >= 70) return 'Cukup'
  return 'Biasa'
}
