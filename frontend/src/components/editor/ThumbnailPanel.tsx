'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createThumbnail, downloadUrl } from '@/lib/api'
import { formatClock } from '@/lib/clip-meta'
import type { ClipThumbnail, HookSettings } from '@/lib/types'

interface Props {
  videoId: string
  clipKey: string
  initial: ClipThumbnail | null
  suggestion: string
  /** Gaya, aksen & font teks mengikuti hook klip */
  hook: HookSettings
  /** Detik video sumber yang sedang diputar; null = belum diputar */
  playhead: number | null
  /** Belum ada thumbnail → buat otomatis sekali saat editor dibuka (frame wajah terbaik + teks saran) */
  autoCreate?: boolean
}

/**
 * Thumbnail (cover Shorts/TikTok/Reels, 1080×1920): frame dengan wajah paling jelas atau frame yang
 * sedang diputar, bayangan bawah, dan teks besar 1–3 kata.
 */
export default function ThumbnailPanel({ videoId, clipKey, initial, suggestion, hook, playhead, autoCreate }: Props) {
  const [thumb, setThumb] = useState(initial)
  const [text, setText] = useState(initial?.text || suggestion || hook.text)
  const [frame, setFrame] = useState<'auto' | 'current'>('auto')
  const startAuto = !!autoCreate && !initial && !!(suggestion || hook.text)
  const [busy, setBusy] = useState(startAuto)

  // Thumbnail otomatis sesuai konteks klip: frame wajah paling jelas + teks thumbnail dari analisis
  const autoRef = useRef(startAuto)
  useEffect(() => {
    if (!autoRef.current) return
    autoRef.current = false
    const { style, accent, font } = hook
    createThumbnail(videoId, clipKey, suggestion || hook.text, null, { style, accent, font })
      .then(setThumb)
      .catch(() => { /* gagal: pengguna tetap bisa membuatnya manual */ })
      .finally(() => setBusy(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const words = text.replaceAll('*', ' ').split(/\s+/).filter(Boolean).length
  const atCurrent = frame === 'current' && playhead !== null

  const make = async () => {
    setBusy(true)
    try {
      const { style, accent, font } = hook
      setThumb(await createThumbnail(videoId, clipKey, text, atCurrent ? playhead : null, { style, accent, font }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Thumbnail gagal dibuat.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-4 text-sm">
      <div className="min-w-0 flex-1 space-y-3">
        <textarea
          rows={2}
          maxLength={40}
          value={text}
          placeholder="Mis. Ditolak *1 MILIAR*"
          aria-label="Teks thumbnail"
          onChange={e => setText(e.target.value)}
          className="field-sizing-content min-h-14 w-full resize-none rounded-md border border-rule bg-bay px-3 py-2 text-ink focus:border-signal focus:outline-none"
        />
        <p className="-mt-1 text-xs text-ink-muted">
          1–3 kata, beda dari judul, bikin penasaran. <span className={words > 4 ? 'text-signal' : ''}>{words} kata.</span>
          {' '}Gaya, aksen & font mengikuti hook.
        </p>
        <div role="radiogroup" aria-label="Frame thumbnail" className="grid grid-cols-2 rounded-md border border-rule p-0.5 text-xs">
          {([['auto', 'Wajah paling jelas'], ['current', playhead === null ? 'Frame yang diputar' : `Frame ${formatClock(playhead)}`]] as const).map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={frame === id} onClick={() => setFrame(id)}
              className={`h-7 px-2 rounded-[5px] whitespace-nowrap ${frame === id ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        {frame === 'current' && playhead === null && (
          <p className="text-xs text-ink-muted">Putar atau geser video ke frame yang kamu mau dulu.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={make} disabled={busy || !text.trim() || (frame === 'current' && playhead === null)} className="btn btn-sm btn-primary">
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ImageIcon className="size-3.5" aria-hidden />}
            {thumb ? 'Buat ulang' : 'Buat thumbnail'}
          </button>
          {thumb && (
            <a href={downloadUrl(thumb.url)} download className="btn btn-sm btn-quiet">
              <Download className="size-3.5" aria-hidden /> Unduh JPG
            </a>
          )}
        </div>
        <p className="text-xs text-ink-faint">Unggah di YouTube Studio (desktop) → Detail Short → Thumbnail.</p>
      </div>
      <div className="w-24 shrink-0">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- gambar dari backend dengan URL bertanda tangan
          <img src={thumb.url} alt="Thumbnail klip" className={`aspect-[9/16] w-full rounded-md border border-rule object-cover ${busy ? 'opacity-50' : ''}`} />
        ) : (
          <div className="grid aspect-[9/16] w-full place-items-center rounded-md border border-dashed border-rule text-center text-xs text-ink-faint">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : '9:16'}
          </div>
        )}
      </div>
    </div>
  )
}
