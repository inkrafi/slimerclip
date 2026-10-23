'use client'

import { useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { saveClipTitle } from '@/lib/api'

interface Props {
  videoId: string
  clipKey: string
  initial: string
}

/**
 * Judul klip: dipakai sebagai nama file unduhan dan siap disalin jadi judul Shorts.
 * Tersimpan saat kolom ditinggalkan, tanpa render ulang.
 */
export default function ClipTitleField({ videoId, clipKey, initial }: Props) {
  const [title, setTitle] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [copied, setCopied] = useState(false)

  const save = async () => {
    if (title.trim() === saved) return
    setState('saving')
    try {
      const next = await saveClipTitle(videoId, clipKey, title)
      setTitle(next)
      setSaved(next)
      setState('saved')
    } catch (e) {
      setState('idle')
      toast.error(e instanceof Error ? e.message : 'Judul gagal disimpan.')
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(title.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Gagal menyalin judul.')
    }
  }

  return (
    <div className="mt-3 max-w-[40rem]">
      <label htmlFor="clip-title" className="text-sm text-ink-muted">Judul video</label>
      <div className="mt-1 flex gap-2">
        <input
          id="clip-title"
          value={title}
          maxLength={100}
          placeholder="Mis. Cerita Hesti bisnis bareng suami"
          onChange={e => { setTitle(e.target.value); setState('idle') }}
          onBlur={save}
          onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
          className="h-10 min-w-0 flex-1 rounded-md border border-rule bg-bay px-3 text-ink focus:border-signal focus:outline-none"
        />
        <button type="button" onClick={copy} disabled={!title.trim()} className="btn btn-sm btn-quiet h-10" aria-label="Salin judul">
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        </button>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
        {state === 'saving' && <Loader2 className="size-3 animate-spin" aria-hidden />}
        {state === 'saved' ? 'Tersimpan. ' : ''}Jadi nama file saat diunduh, dan bisa disalin untuk judul Shorts. {title.length}/100
      </p>
    </div>
  )
}
