'use client'

import { useState } from 'react'
import { Loader2, RefreshCw, Trash2 } from 'lucide-react'
import ScenesEditor from '@/components/editor/ScenesEditor'
import { toast } from 'sonner'
import { Range, Toggle } from '@/components/CaptionStyleEditor'
import { planCinematic } from '@/lib/api'
import type { CinematicBeat, EditRecipe } from '@/lib/types'

interface Props {
  videoId: string
  clipKey: string
  edit: EditRecipe
  disabled: boolean
  /** Posisi pemutar di video sumber (detik), untuk menambah adegan */
  playhead: number | null
  /** Mengubah pengaturan Cinematic. Saat diaktifkan, hook dimatikan karena teks kata kunci sudah mengisi layar. */
  onChange: (patch: Partial<EditRecipe['cinematic']>, turnHookOff?: boolean) => void
}

const fieldClass = 'field h-10 w-full bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none'

/** Preset Cinematic: warna, zoom, teks kata kunci, angka besar, dan nama pembicara. */
export default function CinematicPanel({ videoId, clipKey, edit, disabled, playhead, onChange }: Props) {
  const cinematic = edit.cinematic
  const [planning, setPlanning] = useState(false)

  const plan = async (turnHookOff = false) => {
    setPlanning(true)
    try {
      const { beats, scenes } = await planCinematic(videoId, clipKey, edit.start, edit.end)
      onChange({ enabled: true, beats, scenes }, turnHookOff)
      if (!beats.length) toast.error('Belum ada transkrip untuk klip ini. Buat pratinjaunya dulu.')
    } catch (e) {
      onChange({ enabled: true }, turnHookOff)
      toast.error(e instanceof Error ? e.message : 'Teks kata kunci gagal dibuat. Coba lagi.')
    } finally {
      setPlanning(false)
    }
  }

  const toggle = (on: boolean) => {
    if (!on) return onChange({ enabled: false })
    if (cinematic.beats.length) return onChange({ enabled: true }, true)
    plan(true)
  }

  const setBeat = (index: number, patch: Partial<CinematicBeat>) =>
    onChange({ beats: cinematic.beats.map((beat, i) => (i === index ? { ...beat, ...patch } : beat)) })

  const visible = cinematic.beats
    .map((beat, index) => ({ beat, index }))
    .filter(({ beat }) => beat.end > edit.start && beat.start < edit.end)

  return (
    <div className="space-y-4 text-sm">
      <Toggle label="Pakai gaya Cinematic" checked={cinematic.enabled} onChange={toggle} />
      {cinematic.enabled && (
        <>
          <p className="text-ink-muted">Teks kata kunci menggantikan caption per kata dan hook. Warna, zoom, dan teks ini baru terlihat di hasil render.</p>
          <Range label="Kekuatan warna" value={cinematic.grade} min={0} max={100} onChange={grade => onChange({ grade })} format={v => `${v}%`} />
          <Toggle label="Zoom ke pembicara" checked={cinematic.zoom} onChange={zoom => onChange({ zoom })} />
          <Toggle label="Transisi glitch antar adegan" checked={cinematic.glitch} onChange={glitch => onChange({ glitch })} />
          <Toggle label="Efek suara di tiap transisi" checked={cinematic.sfx} onChange={sfx => onChange({ sfx })} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-ink">Nama pembicara (opsional)</span>
              <input value={cinematic.name} maxLength={40} onChange={e => onChange({ name: e.target.value })} className={`${fieldClass} mt-1.5`} />
            </label>
            <label className="block">
              <span className="text-ink">Jabatan (opsional)</span>
              <input value={cinematic.role} maxLength={50} onChange={e => onChange({ role: e.target.value })} className={`${fieldClass} mt-1.5`} />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-ink">Teks dan adegan otomatis</p>
            <button type="button" disabled={planning || disabled} onClick={() => plan()} className="btn btn-sm btn-quiet">
              {planning ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
              Buat ulang
            </button>
          </div>

          {planning && <p role="status" className="text-ink-muted">Memilih kata kunci, adegan, dan B-roll dari transkrip…</p>}

          <ScenesEditor edit={edit} playhead={playhead} onChange={scenes => onChange({ scenes })} />

          <p className="font-semibold text-ink">Teks kata kunci ({visible.length})</p>
          {!visible.length && !planning && <p className="text-ink-muted">Belum ada teks. Saat dirender, teks dipilih otomatis dari transkrip.</p>}

          <ul className="space-y-2">
            {visible.map(({ beat, index }) => (
              <li key={`${beat.start}-${index}`} className="grid grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.3fr)_2.75rem] items-center gap-2">
                <span className="timecode text-xs text-ink-muted">{(beat.start - edit.start).toFixed(1)}s</span>
                <input aria-label={`Teks kecil pada detik ${(beat.start - edit.start).toFixed(1)}`} placeholder="Teks kecil" value={beat.lead} maxLength={50}
                  onChange={e => setBeat(index, { lead: e.target.value })} className={fieldClass} />
                <input aria-label={`Teks besar pada detik ${(beat.start - edit.start).toFixed(1)}`} value={beat.main} maxLength={40}
                  onChange={e => setBeat(index, { main: e.target.value })} className={`${fieldClass} font-semibold`} />
                <button type="button" aria-label={`Hapus teks "${beat.main}"`} onClick={() => onChange({ beats: cinematic.beats.filter((_, i) => i !== index) })} className="icon-btn tap">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
