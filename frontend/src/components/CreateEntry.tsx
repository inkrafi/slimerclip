'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Film, Scissors, Sparkles } from 'lucide-react'
import AnalyzeForm from '@/components/AnalyzeForm'
import { useAuth } from '@/components/AuthProvider'

interface Props {
  /** Mode klip: link YouTube → kembalikan pesan error, atau kosong jika valid */
  onSubmit: (url: string) => string | void
}

type Mode = 'clips' | 'longform'

const MODES: { id: Mode; label: string; icon: typeof Scissors }[] = [
  { id: 'clips', label: 'Klip dari podcast', icon: Scissors },
  { id: 'longform', label: 'Video panjang dari topik', icon: Film },
]

/**
 * Pintu masuk Ruang kerja. Pengguna biasa: kolom link YouTube (klip 9:16).
 * Admin: pilih mode — klip dari podcast, atau video panjang tanpa wajah dari topik/isu yang sedang ramai.
 */
export default function CreateEntry({ onSubmit }: Props) {
  const { me } = useAuth()
  const [mode, setMode] = useState<Mode>('clips')
  if (!me?.is_admin) return <AnalyzeForm onSubmit={onSubmit} isLoading={false} size="lg" />

  return (
    <div>
      <div role="tablist" aria-label="Yang ingin dibuat" className="mb-3 inline-flex rounded-lg border border-rule bg-bay/60 p-1 text-sm">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} aria-controls={`create-${id}`} onClick={() => setMode(id)}
            className={`flex h-9 items-center gap-2 rounded-md px-3.5 ${mode === id ? 'bg-raised text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      <div id={`create-${mode}`} role="tabpanel">
        {mode === 'clips' ? <AnalyzeForm onSubmit={onSubmit} isLoading={false} size="lg" /> : <TopicForm />}
      </div>
    </div>
  )
}

function TopicForm() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/longform?q=${encodeURIComponent(q)}` : '/longform')
  }
  return (
    <form onSubmit={go}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="field h-14 flex-1">
          <span className="sr-only">Topik atau kata kunci</span>
          <input value={query} maxLength={100} onChange={e => setQuery(e.target.value)}
            placeholder="Kata kunci (opsional), mis. saham, AI, PHK"
            className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-faint" />
        </label>
        <button type="submit" className="btn btn-primary h-14 px-6">
          <Sparkles className="size-4" aria-hidden /> {query.trim() ? 'Cari topik' : 'Lihat rekomendasi topik'}
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-muted">Rekomendasi topik terbaru sesuai niche channelmu sudah disiapkan, tinggal pilih.</p>
    </form>
  )
}
