'use client'

import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { searchStock } from '@/lib/api'
import { sameVisual, STOCK_NAMES } from '@/lib/longform'
import type { StockProvider, StockVisual } from '@/lib/types'

interface Props {
  provider: StockProvider
  initialQuery: string
  selected?: StockVisual | null
  onPick: (visual: StockVisual, query: string) => void
}

/** Cari & pilih video stok (Pixabay/Pexels) untuk satu adegan. */
export default function StockPicker({ provider, initialQuery, selected, onPick }: Props) {
  const source = STOCK_NAMES[provider]
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<StockVisual[] | null>(null)
  // Langsung mencari dengan kata kunci adegan saat dibuka
  const [busy, setBusy] = useState(() => initialQuery.trim() !== '')
  const [error, setError] = useState<string | null>(null)

  const fetchResults = (q: string) =>
    searchStock(q)
      .then(setResults)
      .catch(e => setError(e instanceof Error ? e.message : 'Pencarian gagal.'))
      .finally(() => setBusy(false))

  const search = (q: string) => {
    if (!q.trim()) return
    setBusy(true)
    setError(null)
    fetchResults(q.trim())
  }

  useEffect(() => {
    if (initialQuery.trim()) fetchResults(initialQuery.trim())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-md border border-rule bg-bay/60 p-3">
      <form onSubmit={e => { e.preventDefault(); search(query) }} className="flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Kata kunci bahasa Inggris, mis. stock market"
          aria-label="Cari video stok"
          className="h-8 min-w-0 flex-1 rounded-md border border-rule bg-bay px-2 text-sm text-ink focus:border-signal focus:outline-none"
        />
        <button type="submit" disabled={busy || !query.trim()} className="btn btn-sm btn-quiet">
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Search className="size-3.5" aria-hidden />} Cari
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-xs text-tally">{error}</p>}
      {results && results.length === 0 && <p className="mt-2 text-xs text-ink-muted">Tidak ada hasil. Coba kata kunci lain.</p>}
      {results && results.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {results.map(r => (
            <li key={`${r.provider}-${r.id}`}>
              <button
                type="button"
                onClick={() => onPick(r, query.trim())}
                aria-pressed={sameVisual(selected, r)}
                title={`Oleh ${r.credit} di ${source.name}`}
                className={`relative block w-full overflow-hidden rounded border-2 ${sameVisual(selected, r) ? 'border-signal' : 'border-transparent hover:border-rule'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau dari CDN penyedia video stok */}
                <img src={r.thumb} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                <span className="absolute bottom-0.5 right-1 timecode text-[10px] text-white drop-shadow">{Math.round(r.duration)}d</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-ink-faint">
        Video stok dari <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{source.name}</a>,
        {' '}gratis dipakai. Kredit kreator otomatis masuk ke deskripsi video.
      </p>
    </div>
  )
}
