'use client'

import { useState } from 'react'
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { searchStock } from '@/lib/api'
import MotionFields from '@/components/longform/MotionFields'
import type { CinematicScene, EditRecipe, LongformMotion, LongformMotionTemplate, SceneLook, SceneSfx, SceneTransition } from '@/lib/types'

const LOOKS: { id: SceneLook; label: string }[] = [
  { id: 'broll', label: 'B-roll' },
  { id: 'zoom', label: 'Zoom ke pembicara' },
  { id: 'motion', label: 'Animasi' },
]
const TRANSITIONS: { id: SceneTransition; label: string }[] = [
  { id: '', label: 'Tanpa' }, { id: 'glitch', label: 'Glitch' }, { id: 'flash', label: 'Flash' },
]
const SOUNDS: { id: SceneSfx; label: string }[] = [
  { id: '', label: 'Tanpa' }, { id: 'glitch', label: 'Glitch' }, { id: 'whoosh', label: 'Woosh' }, { id: 'flash', label: 'Flash kamera' },
]
const MOTION_OPTIONS: LongformMotionTemplate[] = ['number', 'ledger', 'compare', 'flow', 'verdict']
const FIRST_MOTION: LongformMotion = { template: 'number', label: '', value: 0, prefix: '', suffix: '', note: '', tone: 'plain' }

const fieldClass = 'field h-10 bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none'
const DEFAULT_LENGTH = 3

interface Props {
  edit: EditRecipe
  playhead: number | null
  onChange: (scenes: CinematicScene[]) => void
}

/** Daftar adegan: B-roll, zoom, atau animasi, masing-masing dengan transisi dan efek suara. Di luar adegan klip memakai bingkai utamanya. */
export default function ScenesEditor({ edit, playhead, onChange }: Props) {
  const scenes = edit.cinematic.scenes
  const [searching, setSearching] = useState<number | null>(null)
  const relative = (seconds: number) => Math.max(0, seconds - edit.start)

  const patch = (index: number, change: Partial<CinematicScene>) =>
    onChange(scenes.map((scene, i) => (i === index ? { ...scene, ...change } : scene)))

  const setTime = (index: number, field: 'start' | 'end', value: string) => {
    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds >= 0) patch(index, { [field]: Math.round((edit.start + seconds) * 10) / 10 })
  }

  const add = () => {
    const start = Math.round(Math.max(edit.start, playhead ?? edit.start) * 10) / 10
    const clash = scenes.some(scene => start < scene.end && start + DEFAULT_LENGTH > scene.start)
    if (clash || start + DEFAULT_LENGTH > edit.end) {
      toast.error('Bagian ini sudah terisi. Geser pemutar ke bagian yang masih kosong.')
      return
    }
    const added: CinematicScene = { start, end: start + DEFAULT_LENGTH, look: 'zoom', transition: '', sfx: '' }
    onChange([...scenes, added].sort((a, b) => a.start - b.start))
  }

  const findStock = async (index: number) => {
    const scene = scenes[index]
    const query = scene.query?.trim()
    if (!query) {
      toast.error('Isi kata pencarian B-roll dulu.')
      return
    }
    setSearching(index)
    try {
      const results = await searchStock(query)
      if (!results.length) {
        toast.error(`Tidak ada video untuk "${query}". Coba kata lain.`)
        return
      }
      // Berganti ke hasil berikutnya setiap kali diklik
      const current = results.findIndex(result => result.link === scene.visual?.link)
      patch(index, { visual: results[(current + 1) % results.length] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Pencarian B-roll gagal. Coba lagi.')
    } finally {
      setSearching(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">Adegan ({scenes.length})</p>
        <button type="button" onClick={add} className="btn btn-sm btn-quiet"><Plus className="size-3.5" aria-hidden /> Tambah di posisi pemutar</button>
      </div>
      {!scenes.length && <p className="text-ink-muted">Belum ada adegan. Klip menampilkan pembicara dari awal sampai akhir.</p>}
      <ul className="space-y-3">
        {scenes.map((scene, index) => (
          <li key={`${scene.start}-${index}`} className="rounded-md border border-rule p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="block w-20">
                <span className="text-xs text-ink-muted">Mulai (dtk)</span>
                <input type="number" min={0} step={0.1} defaultValue={relative(scene.start).toFixed(1)} onBlur={e => setTime(index, 'start', e.target.value)} className={`${fieldClass} mt-1 w-full`} />
              </label>
              <label className="block w-20">
                <span className="text-xs text-ink-muted">Selesai (dtk)</span>
                <input type="number" min={0} step={0.1} defaultValue={relative(scene.end).toFixed(1)} onBlur={e => setTime(index, 'end', e.target.value)} className={`${fieldClass} mt-1 w-full`} />
              </label>
              <label className="block min-w-36 flex-1">
                <span className="text-xs text-ink-muted">Bentuk</span>
                <span className="field mt-1 h-10">
                  <select value={scene.look} onChange={e => {
                    const look = e.target.value as SceneLook
                    patch(index, look === 'motion' && !scene.motion ? { look, motion: FIRST_MOTION } : { look })
                  }} className="w-full bg-transparent text-sm text-ink outline-none">
                    {LOOKS.map(look => <option key={look.id} value={look.id}>{look.label}</option>)}
                  </select>
                </span>
              </label>
              <label className="block min-w-28 flex-1">
                <span className="text-xs text-ink-muted">Transisi</span>
                <span className="field mt-1 h-10">
                  <select value={scene.transition ?? ''} onChange={e => patch(index, { transition: e.target.value as SceneTransition })} className="w-full bg-transparent text-sm text-ink outline-none">
                    {TRANSITIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </span>
              </label>
              <label className="block min-w-28 flex-1">
                <span className="text-xs text-ink-muted">Efek suara</span>
                <span className="field mt-1 h-10">
                  <select value={scene.sfx ?? ''} onChange={e => patch(index, { sfx: e.target.value as SceneSfx })} className="w-full bg-transparent text-sm text-ink outline-none">
                    {SOUNDS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </span>
              </label>
              <button type="button" aria-label={`Hapus adegan pada detik ${relative(scene.start).toFixed(1)}`} onClick={() => onChange(scenes.filter((_, i) => i !== index))} className="icon-btn tap">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            {scene.look === 'motion' && scene.motion && (
              <MotionFields motion={scene.motion} disabled={false} only={MOTION_OPTIONS} onChange={motion => patch(index, { motion: motion ?? FIRST_MOTION })} />
            )}
            {scene.look === 'broll' && scene.file && !scene.visual && (
              <p className="mt-3 text-xs text-ink-muted">Dari pustaka: {scene.file}</p>
            )}
            {scene.look === 'broll' && (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                {scene.visual?.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={scene.visual.thumb} alt="" className="h-14 w-24 rounded object-cover" />
                )}
                <label className="block min-w-40 flex-1">
                  <span className="text-xs text-ink-muted">Kata pencarian (bahasa Inggris)</span>
                  <input value={scene.query ?? ''} maxLength={60} onChange={e => patch(index, { query: e.target.value })} placeholder="man walking alone city night" className={`${fieldClass} mt-1 w-full`} />
                </label>
                <button type="button" disabled={searching === index} onClick={() => findStock(index)} className="btn btn-quiet h-10">
                  {searching === index ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
                  {scene.visual ? 'Ganti video' : 'Cari video'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
