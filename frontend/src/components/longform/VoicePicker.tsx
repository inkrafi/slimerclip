'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Play, Square } from 'lucide-react'
import { toast } from 'sonner'
import { getVoicePreview } from '@/lib/api'
import type { LongformData } from '@/lib/types'

interface Props {
  voices: LongformData['voices']
  value: string
  disabled?: boolean
  onChange: (voice: string) => void
}

/** Pilih suara dan dengarkan contohnya. Contoh disimpan server, jadi tiap suara hanya sekali memakai kredit. */
export default function VoicePicker({ voices, value, disabled, onChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = () => {
    audioRef.current?.pause()
    audioRef.current = null
    setPlaying(false)
  }
  useEffect(() => () => { audioRef.current?.pause() }, [])

  const toggle = async () => {
    if (playing) {
      stop()
      return
    }
    setLoading(true)
    try {
      const audio = new Audio(await getVoicePreview(value))
      audio.onended = () => setPlaying(false)
      audioRef.current = audio
      await audio.play()
      setPlaying(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Contoh suara gagal diputar. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <label className="block text-sm">
        <span className="text-ink-muted">Suara AI</span>
        <select value={value} disabled={disabled || loading} onChange={e => { stop(); onChange(e.target.value) }}
          className="mt-1 h-11 w-full rounded-md border border-rule bg-bay px-2 text-sm text-ink focus:border-signal focus:outline-none">
          {voices.map(v => <option key={v.id} value={v.id}>{v.name ?? v.id} ({v.label})</option>)}
        </select>
      </label>
      <button type="button" onClick={toggle} disabled={loading || !value} className="btn btn-sm btn-quiet mt-2 min-h-11 w-full justify-center">
        {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : playing ? <Square className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        {loading ? 'Membuat contoh…' : playing ? 'Berhenti' : 'Dengar contoh'}
      </button>
      <p className="mt-1 text-xs text-ink-faint">Contoh pertama suara ElevenLabs memakai sekitar 100 kredit, lalu tersimpan.</p>
    </div>
  )
}
