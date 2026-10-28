'use client'

import { useEffect, useState } from 'react'
import { getClipProfileOptions } from '@/lib/api'
import type { ClipProfile, ClipProfileOptions } from '@/lib/types'

/** Pilihan profil analisis (dimuat sekali per sesi), untuk form & ringkasan */
export function useClipProfileOptions(enabled = true): ClipProfileOptions | null {
  const [options, setOptions] = useState<ClipProfileOptions | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    getClipProfileOptions().then(o => { if (alive) setOptions(o) }).catch(() => {})
    return () => { alive = false }
  }, [enabled])
  return options
}

interface Props {
  value: ClipProfile
  onChange: (next: ClipProfile) => void
  options: ClipProfileOptions | null
  disabled?: boolean
}

const SELECT = 'mt-1 block h-9 w-full rounded-md border border-rule bg-bay px-2 text-sm text-ink focus:border-signal focus:outline-none'

/** Form profil analisis klip (khusus admin): bahasa, tipe video, durasi & jumlah klip. */
export default function ClipProfileFields({ value, onChange, options, disabled }: Props) {
  if (!options) return <p className="text-sm text-ink-muted">Memuat pilihan…</p>
  const set = <K extends keyof ClipProfile>(key: K, v: ClipProfile[K]) => onChange({ ...value, [key]: v })

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block text-sm">
        <span className="text-ink-muted">Tipe video</span>
        <select value={value.video_type} disabled={disabled} onChange={e => set('video_type', e.target.value)} className={SELECT}>
          {options.video_types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-ink-muted">Bahasa di video</span>
        <select value={value.source_language} disabled={disabled} onChange={e => set('source_language', e.target.value)} className={SELECT}>
          <option value="auto">Deteksi otomatis</option>
          {options.languages.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-ink-muted">Bahasa judul, hook & deskripsi</span>
        <select value={value.output_language} disabled={disabled} onChange={e => set('output_language', e.target.value)} className={SELECT}>
          <option value="same">Sama dengan video</option>
          {options.languages.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-ink-muted">Bahasa subtitle</span>
        <select value={value.subtitle_language} disabled={disabled} onChange={e => set('subtitle_language', e.target.value)} className={SELECT}>
          <option value="same">Sama dengan video</option>
          {options.languages.filter(l => l.id === 'id').map(l => <option key={l.id} value={l.id}>{l.label} (diterjemahkan)</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-ink-muted">Durasi klip</span>
        <select value={value.duration} disabled={disabled} onChange={e => set('duration', e.target.value)} className={SELECT}>
          {options.durations.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-ink-muted">Jumlah klip</span>
        <select value={String(value.clip_count)} disabled={disabled}
          onChange={e => set('clip_count', e.target.value === 'auto' ? 'auto' : Number(e.target.value))} className={SELECT}>
          {options.clip_counts.map(n => (
            <option key={String(n)} value={String(n)}>{n === 'auto' ? 'Otomatis (yang layak saja)' : `${n} klip`}</option>
          ))}
        </select>
      </label>
      <p className="self-end text-xs text-ink-faint sm:col-span-2 lg:col-span-1">
        Subtitle terjemahan bisa diedit di editor sebelum dirender. Tipe video menentukan kriteria momen dan tata letak 9:16.
      </p>
    </div>
  )
}
