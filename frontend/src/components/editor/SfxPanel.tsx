'use client'

import { useRef, useState } from 'react'
import { Loader2, Play, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { uploadAsset } from '@/lib/api'
import type { EditRecipe, EditorAsset } from '@/lib/types'

type Sfx = EditRecipe['sfx'][number]

interface Props {
  sfx: Sfx[]
  /** Efek suara bawaan (backend/sfx), per kategori */
  library: { name: string; label: string; group: string; url: string }[]
  assets: EditorAsset[]
  /** Rentang klip (detik video sumber) */
  range: [number, number]
  /** Posisi pemutar (detik video sumber) */
  playhead: number | null
  disabled?: boolean
  onChange: (sfx: Sfx[]) => void
  onAssetsChange: (assets: EditorAsset[]) => void
  onSeek: (sourceTime: number) => void
}

const MAX_SFX = 30
const UPLOADS = 'Upload kamu'
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`

/** Efek suara (pustaka bawaan atau upload sendiri) yang diputar di detik tertentu dalam klip. */
export default function SfxPanel({ sfx, library, assets, range, playhead, disabled, onChange, onAssetsChange, onSeek }: Props) {
  // Upload kecil tanpa tanda suasana = efek suara (lagu bertanda suasana / file besar ada di panel musik)
  const uploads = assets.filter(a => a.kind === 'audio' && a.mood_source !== 'tag' && a.size_mb < 1.5)
  const sounds = [...library, ...uploads]
  const groups = [...new Set(library.map(a => a.group))]
  const [group, setGroup] = useState(groups[0] ?? '')
  const shown = group === UPLOADS ? uploads : library.filter(a => a.group === group)
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const here = () => Math.round(Math.min(Math.max(playhead ?? range[0], range[0]), range[1] - 0.1) * 10) / 10
  const update = (index: number, patch: Partial<Sfx>) =>
    onChange(sfx.map((s, i) => (i === index ? { ...s, ...patch } : s)))

  const add = (asset: string) => onChange([...sfx, { asset, at: here(), volume: 80 }].sort((a, b) => a.at - b.at))

  // Bisa banyak file sekaligus (mis. satu paket SFX); file disimpan sebagai aset, tidak langsung ditaruh di klip
  const upload = async (files: File[]) => {
    setUploading(true)
    const added: EditorAsset[] = []
    try {
      for (const file of files) {
        try {
          added.push(await uploadAsset(file))
        } catch (e) {
          toast.error(`${file.name}: ${e instanceof Error ? e.message : 'upload gagal'}`)
        }
      }
      if (added.length) {
        onAssetsChange([...added, ...assets])
        setGroup(UPLOADS)
        toast.success(`${added.length} efek suara ditambahkan`)
      }
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  const preview = (name: string) => {
    const url = sounds.find(a => a.name === name)?.url
    if (url) new Audio(url).play().catch(() => {})
  }
  const full = sfx.length >= MAX_SFX

  return (
    <div className="space-y-3 text-sm">
      {sfx.length > 0 && (
        <ol className="space-y-2">
          {sfx.map((item, i) => {
            const outside = item.at < range[0] || item.at >= range[1]
            return (
              <li key={i} className="rounded-md border border-rule p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onSeek(item.at)} title="Putar video dari titik ini"
                    className="timecode w-14 shrink-0 text-left text-xs text-ink hover:text-signal">
                    {fmt(Math.max(0, item.at - range[0]))}
                  </button>
                  <select
                    value={item.asset}
                    disabled={disabled}
                    aria-label="Efek suara"
                    onChange={e => update(i, { asset: e.target.value })}
                    className="min-w-0 flex-1 rounded-md border border-rule bg-bay px-2 h-8 text-ink"
                  >
                    {groups.map(g => (
                      <optgroup key={g} label={g}>
                        {library.filter(a => a.group === g).map(a => <option key={a.name} value={a.name}>{a.label}</option>)}
                      </optgroup>
                    ))}
                    {uploads.length > 0 && (
                      <optgroup label="Upload kamu">
                        {uploads.map(a => <option key={a.name} value={a.name}>{a.label}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <button type="button" onClick={() => preview(item.asset)} aria-label="Dengarkan efek suara"
                    className="grid size-8 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-raised hover:text-ink">
                    <Play className="size-3.5" aria-hidden />
                  </button>
                  <button type="button" onClick={() => onChange(sfx.filter((_, j) => j !== i))} disabled={disabled}
                    aria-label="Hapus efek suara"
                    className="grid size-8 shrink-0 place-items-center rounded-md text-ink-faint hover:bg-raised hover:text-tally">
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-1">
                    <button type="button" className="btn btn-sm btn-quiet px-2" disabled={disabled}
                      onClick={() => update(i, { at: Math.max(range[0], Math.round((item.at - 0.1) * 10) / 10) })} aria-label="Mundurkan 0,1 detik">−0,1</button>
                    <button type="button" className="btn btn-sm btn-quiet px-2" disabled={disabled}
                      onClick={() => update(i, { at: Math.round((item.at + 0.1) * 10) / 10 })} aria-label="Majukan 0,1 detik">+0,1</button>
                    <button type="button" className="btn btn-sm btn-quiet" disabled={disabled || playhead === null}
                      onClick={() => update(i, { at: here() })}>Ke posisi video</button>
                  </div>
                  <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-xs text-ink-muted">
                    Volume
                    <input type="range" min={0} max={100} step={5} value={item.volume} disabled={disabled}
                      onChange={e => update(i, { volume: Number(e.target.value) })} className="flex-1 accent-signal" />
                    <span className="timecode w-8 text-right text-ink">{item.volume}%</span>
                  </label>
                </div>
                {outside && <p className="text-xs text-tally">Di luar rentang klip, tidak akan terdengar.</p>}
              </li>
            )
          })}
        </ol>
      )}

      <div>
        <p className="text-xs text-ink-muted">Tambahkan di posisi video saat ini:</p>
        <div role="tablist" aria-label="Kategori efek suara" className="mt-1.5 flex flex-wrap gap-1">
          {[...groups, ...(uploads.length ? [UPLOADS] : [])].map(g => (
            <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)}
              className={`h-7 rounded-full px-3 text-xs ${group === g ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}>
              {g}{g === UPLOADS ? ` (${uploads.length})` : ''}
            </button>
          ))}
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {shown.map(a => (
            <li key={a.name} className="flex items-center rounded-md border border-rule">
              <button type="button" onClick={() => preview(a.name)} aria-label={`Dengarkan ${a.label}`}
                className="grid size-8 place-items-center rounded-l-md text-ink-muted hover:bg-raised hover:text-ink">
                <Play className="size-3" aria-hidden />
              </button>
              <button type="button" onClick={() => add(a.name)} disabled={disabled || full}
                className="flex h-8 items-center gap-1 rounded-r-md border-l border-rule pl-2 pr-2.5 text-xs text-ink hover:bg-raised">
                <Plus className="size-3" aria-hidden /> {a.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept=".mp3,.m4a,.aac,.wav,.ogg" multiple className="sr-only" tabIndex={-1}
          onChange={e => e.target.files?.length && upload([...e.target.files])} />
        <button type="button" className="btn btn-sm btn-quiet" disabled={disabled || uploading} onClick={() => input.current?.click()}>
          {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}
          Upload efek suara
        </button>
      </div>
      <p className="text-xs text-ink-faint">
        Putar video, berhenti di titik yang diinginkan, lalu klik efeknya. Upload sendiri (bisa banyak sekaligus): MP3, WAV,
        OGG. File kecil yang namanya berisi kata kuncinya, mis. <span className="font-mono text-ink">vine_boom.mp3</span>,
        <span className="font-mono text-ink"> whoosh.wav</span>, <span className="font-mono text-ink">kaching.mp3</span>, dipakai
        otomatis oleh edit otomatis menggantikan bunyi bawaan sejenis.
      </p>
    </div>
  )
}
