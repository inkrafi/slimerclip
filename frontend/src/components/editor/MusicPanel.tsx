'use client'

import { useRef, useState } from 'react'
import { Check, Loader2, Pause, Play, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { deleteAsset, setAssetMood, uploadAsset } from '@/lib/api'
import type { EditorAsset, EditorData, EditRecipe } from '@/lib/types'

interface Props {
  music: EditRecipe['music']
  library: EditorData['music_library']
  assets: EditorAsset[]
  onChange: (patch: Partial<EditRecipe['music']>) => void
  onAssetsChange: (assets: EditorAsset[]) => void
}

const MOODS = [
  { id: 'santai', label: 'Santai' },
  { id: 'semangat', label: 'Semangat' },
  { id: 'tegang', label: 'Tegang' },
  { id: 'lucu', label: 'Lucu' },
  { id: 'dramatis', label: 'Dramatis' },
  { id: 'umum', label: 'Semua suasana' },
]
/** Audio upload sebesar ini atau bertanda suasana = musik (yang lebih kecil dianggap efek suara) */
const MUSIC_MIN_MB = 1.5

/** Musik latar: lagu milikmu (bertanda suasana, dipilih otomatis per klip) atau musik bawaan. */
export default function MusicPanel({ music, library, assets, onChange, onAssetsChange }: Props) {
  const [playing, setPlaying] = useState<string | null>(null)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const player = useRef<HTMLAudioElement | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const tracks = assets.filter(a => a.kind === 'audio' && (a.mood_source === 'tag' || a.size_mb >= MUSIC_MIN_MB))

  const toggle = (name: string, url: string) => {
    player.current?.pause()
    if (playing === name) {
      setPlaying(null)
      return
    }
    const audio = new Audio(url)
    audio.volume = 0.6
    audio.onended = () => setPlaying(null)
    audio.play().then(() => setPlaying(name)).catch(() => setPlaying(null))
    player.current = audio
  }

  const upload = async (files: File[]) => {
    const added: EditorAsset[] = []
    setUploading({ done: 0, total: files.length })
    for (const file of files) {
      try {
        added.push(await uploadAsset(file))
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : 'upload gagal'}`)
      }
      setUploading({ done: added.length, total: files.length })
    }
    setUploading(null)
    if (input.current) input.current.value = ''
    if (added.length) {
      onAssetsChange([...added, ...assets])
      toast.success(`${added.length} lagu ditambahkan. Tandai suasananya agar dipilih otomatis.`)
    }
  }

  const tag = async (name: string, mood: string) => {
    try {
      const updated = await setAssetMood(name, mood)
      onAssetsChange(assets.map(a => (a.name === name ? updated : a)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Suasana gagal disimpan.')
    }
  }

  const remove = async (track: EditorAsset) => {
    if (!confirm(`Hapus "${track.label}" dari pustaka musikmu?`)) return
    try {
      await deleteAsset(track.name)
      onAssetsChange(assets.filter(a => a.name !== track.name))
      if (music.asset === track.name) onChange({ asset: '' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lagu gagal dihapus.')
    }
  }

  const row = (name: string, label: string, url: string, extra?: React.ReactNode) => {
    const selected = music.asset === name
    return (
      <li key={name} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${selected ? 'border-signal bg-raised' : 'border-rule'}`}>
        <button type="button" onClick={() => toggle(name, url)} aria-label={`${playing === name ? 'Hentikan' : 'Dengarkan'} ${label}`}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-bay text-ink hover:bg-panel">
          {playing === name ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        </button>
        <button type="button" onClick={() => onChange({ asset: selected ? '' : name })} aria-pressed={selected}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left" title={selected ? 'Klik untuk tanpa musik' : 'Pakai lagu ini'}>
          <span className="truncate text-ink">{label}</span>
          {selected && <Check className="size-4 shrink-0 text-signal" aria-hidden />}
        </button>
        {extra}
      </li>
    )
  }

  return (
    <div className="space-y-5 text-sm">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink-muted">Musik milikmu {tracks.length > 0 && <span className="text-ink-faint">({tracks.length})</span>}</p>
          <input ref={input} type="file" accept=".mp3,.m4a,.aac,.wav,.ogg" multiple className="sr-only" tabIndex={-1}
            onChange={e => e.target.files?.length && upload([...e.target.files])} />
          <button type="button" className="btn btn-sm btn-quiet" disabled={!!uploading} onClick={() => input.current?.click()}>
            {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}
            {uploading ? `Mengupload ${uploading.done}/${uploading.total}…` : 'Upload lagu (bisa banyak)'}
          </button>
        </div>
        {tracks.length > 0 ? (
          <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
            {tracks.map(t => row(t.name, t.label, t.url, (
              <>
                <select value={t.mood_source === 'tag' ? t.mood ?? '' : ''} onChange={e => tag(t.name, e.target.value)}
                  aria-label={`Suasana ${t.label}`} title="Dipakai edit otomatis untuk klip bersuasana sama"
                  className="h-8 max-w-[9.5rem] shrink-0 rounded-md border border-rule bg-bay px-1.5 text-xs text-ink">
                  <option value="">{t.mood_source === 'name' && t.mood ? `Tebakan: ${MOODS.find(m => m.id === t.mood)?.label}` : 'Suasana?'}</option>
                  {MOODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <button type="button" onClick={() => remove(t)} aria-label={`Hapus ${t.label}`}
                  className="grid size-8 shrink-0 place-items-center rounded-md text-ink-faint hover:bg-raised hover:text-tally">
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </>
            )))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">Belum ada. Upload lagu backsound yang biasa kamu pakai, lalu tandai suasananya.</p>
        )}
        <p className="mt-1.5 text-xs text-ink-faint">
          Edit otomatis memilih lagumu yang suasananya cocok dengan momen (bergantian antar klip), lalu yang bertanda
          &ldquo;Semua suasana&rdquo;, baru musik bawaan. Lagu berhak cipta bisa membuat video di-mute atau diklaim platform.
        </p>
      </div>

      <div>
        <p className="text-ink-muted">Musik bawaan</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {library.map(track => row(track.name, track.label, track.url))}
        </ul>
        <p className="mt-1.5 text-xs text-ink-faint">Dibuat sendiri, bebas hak cipta.</p>
      </div>
    </div>
  )
}
