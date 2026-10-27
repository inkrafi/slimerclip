'use client'

import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ImageIcon, Loader2, Mic, Plus, Sparkles, Square, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import StockPicker from '@/components/longform/StockPicker'
import { recordingFilename, useRecorder } from '@/hooks/useRecorder'
import { formatClock } from '@/lib/clip-meta'
import { narrationSeconds, STOCK_NAMES } from '@/lib/longform'
import type { LongformScene, StockProvider } from '@/lib/types'

interface Props {
  scene: LongformScene
  index: number
  total: number
  /** Ada proses lain (simpan, suara massal, render) → kontrol dikunci */
  locked: boolean
  working: boolean
  stockProvider: StockProvider | null
  onChange: (patch: Partial<LongformScene>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onAddAfter: () => void
  onTts: () => void
  onAudio: (audio: Blob, filename: string) => void
  onDeleteAudio: () => void
}

const STATE_LABEL = {
  ready: { text: 'Suara siap', cls: 'text-teal' },
  stale: { text: 'Teks berubah, buat ulang suaranya', cls: 'text-signal' },
  missing: { text: 'Belum ada suara', cls: 'text-ink-faint' },
} as const

export default function SceneCard(props: Props) {
  const { scene, index, total, locked, working, stockProvider } = props
  const [picking, setPicking] = useState(false)
  const recorder = useRecorder()
  const fileRef = useRef<HTMLInputElement>(null)
  const quote = scene.kind === 'quote'
  const words = scene.text.split(/\s+/).filter(Boolean).length
  const state = STATE_LABEL[scene.audio_state ?? 'missing']
  const busy = locked || working

  const toggleRecord = async () => {
    if (recorder.recording) {
      const blob = await recorder.stop()
      if (blob) props.onAudio(blob, recordingFilename(blob))
      return
    }
    try {
      await recorder.start()
    } catch {
      toast.error('Mikrofon tidak bisa dipakai. Izinkan akses mikrofon di browser.')
    }
  }

  return (
    <li className="relative rounded-lg border border-rule glass">
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-2">
        <span className="timecode text-sm text-ink-muted w-6">{index + 1}</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${quote ? 'bg-label-iris/15 text-label-iris' : 'bg-raised text-ink-muted'}`}>
          {quote ? 'Kutipan' : 'Narasi'}
        </span>
        <input
          value={scene.chapter}
          maxLength={70}
          disabled={locked}
          onChange={e => props.onChange({ chapter: e.target.value })}
          placeholder="Judul bab (isi jika adegan ini membuka bab baru)"
          aria-label={`Judul bab adegan ${index + 1}`}
          className={`h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm focus:border-signal focus:outline-none ${scene.chapter ? 'border-rule font-semibold text-ink' : 'border-transparent text-ink-muted hover:border-rule'}`}
        />
        <span className="flex">
          <button type="button" onClick={() => props.onMove(-1)} disabled={locked || index === 0} aria-label="Naikkan adegan" className="btn btn-sm btn-quiet px-1.5"><ArrowUp className="size-3.5" aria-hidden /></button>
          <button type="button" onClick={() => props.onMove(1)} disabled={locked || index === total - 1} aria-label="Turunkan adegan" className="btn btn-sm btn-quiet px-1.5"><ArrowDown className="size-3.5" aria-hidden /></button>
          <button type="button" onClick={props.onRemove} disabled={locked || total <= 1} aria-label="Hapus adegan" className="btn btn-sm btn-quiet px-1.5 hover:text-tally"><Trash2 className="size-3.5" aria-hidden /></button>
        </span>
      </div>

      {quote ? (
        <div className="px-4 py-3 text-sm">
          <p className="text-ink-muted">
            Potongan asli podcast <span className="timecode text-ink">{formatClock(scene.start ?? 0)}–{formatClock(scene.end ?? 0)}</span>
            {' '}({Math.round((scene.end ?? 0) - (scene.start ?? 0))} dtk), lengkap dengan suara narasumber.
          </p>
          {scene.text && <p className="mt-1.5 border-l-2 border-label-iris pl-3 italic text-ink/90">{scene.text}</p>}
        </div>
      ) : (
        <div className="grid gap-4 px-4 py-3 md:grid-cols-[minmax(0,1fr)_13rem]">
          <div className="min-w-0">
            <textarea
              value={scene.text}
              maxLength={600}
              disabled={locked}
              onChange={e => props.onChange({ text: e.target.value })}
              aria-label={`Narasi adegan ${index + 1}`}
              className="field-sizing-content min-h-16 w-full resize-none rounded-md border border-rule bg-bay px-3 py-2 text-[15px] leading-relaxed text-ink focus:border-signal focus:outline-none"
            />
            <p className="mt-1 text-xs text-ink-faint">
              {words} kata, ±{Math.round(scene.audio?.duration ?? narrationSeconds(scene.text))} dtk
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`text-xs ${state.cls}`}>{working ? 'Memproses suara…' : state.text}</span>
              {scene.audio && (
                <audio controls preload="none" src={scene.audio.url} className="h-8 max-w-[15rem]" aria-label={`Suara adegan ${index + 1}`} />
              )}
              <span className="ml-auto flex flex-wrap gap-1.5">
                <button type="button" onClick={props.onTts} disabled={busy || recorder.recording || !scene.text.trim()}
                  title="Buat suara dengan Gemini TTS" className="btn btn-sm btn-quiet">
                  {working ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />} Suara AI
                </button>
                <button type="button" onClick={toggleRecord} disabled={busy && !recorder.recording}
                  className={`btn btn-sm ${recorder.recording ? 'bg-tally/15 text-tally' : 'btn-quiet'}`}>
                  {recorder.recording
                    ? <><Square className="size-3.5" aria-hidden /> Stop <span className="timecode">{formatClock(recorder.seconds)}</span></>
                    : <><Mic className="size-3.5" aria-hidden /> Rekam</>}
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || recorder.recording}
                  title="Unggah file audio (mp3, wav, m4a)" aria-label="Unggah file audio" className="btn btn-sm btn-quiet px-2">
                  <Upload className="size-3.5" aria-hidden />
                </button>
                {scene.audio && (
                  <button type="button" onClick={props.onDeleteAudio} disabled={busy} aria-label="Hapus suara" className="btn btn-sm btn-quiet px-2 hover:text-tally">
                    <X className="size-3.5" aria-hidden />
                  </button>
                )}
              </span>
              <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0]
                if (file) props.onAudio(file, file.name)
                e.target.value = ''
              }} />
            </div>
          </div>

          <div>
            <button type="button" onClick={() => setPicking(v => !v)} disabled={locked || !stockProvider}
              title={stockProvider ? 'Pilih video stok' : 'Isi PIXABAY_API_KEY di backend/.env untuk memilih video stok'}
              className="group relative block w-full overflow-hidden rounded-md border border-rule bg-bay text-left disabled:cursor-not-allowed">
              {scene.visual ? (
                // eslint-disable-next-line @next/next/no-img-element -- pratinjau dari CDN penyedia video stok
                <img src={scene.visual.thumb} alt="" className="aspect-video w-full object-cover" />
              ) : (
                <span className="grid aspect-video w-full place-items-center text-center text-xs text-ink-faint">
                  <span><ImageIcon className="mx-auto mb-1 size-4" aria-hidden />Belum ada visual<br />(latar polos)</span>
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {scene.visual ? 'Ganti visual' : 'Pilih visual'}
              </span>
            </button>
            {scene.visual?.credit && (
              <p className="mt-1 truncate text-[11px] text-ink-faint">Oleh {scene.visual.credit} · {STOCK_NAMES[scene.visual.provider].name}</p>
            )}
          </div>

          {picking && stockProvider && (
            <div className="md:col-span-2">
              <StockPicker
                provider={stockProvider}
                initialQuery={scene.query || ''}
                selected={scene.visual}
                onPick={(visual, query) => { props.onChange({ visual, query }); setPicking(false) }}
              />
            </div>
          )}
        </div>
      )}

      <button type="button" onClick={props.onAddAfter} disabled={locked}
        className="absolute -bottom-3 left-1/2 z-10 grid size-6 -translate-x-1/2 place-items-center rounded-full border border-rule bg-raised text-ink-muted hover:text-ink disabled:hidden"
        aria-label={`Tambah adegan narasi setelah adegan ${index + 1}`} title="Tambah adegan narasi">
        <Plus className="size-3.5" aria-hidden />
      </button>
    </li>
  )
}
