'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, ChevronRight, Copy, ExternalLink, Mail, MessageCircle, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/AuthProvider'
import IconButton from '@/components/common/IconButton'
import RequireAuth from '@/components/RequireAuth'
import ReportView, { ReportSkeleton } from '@/components/report/ReportView'
import { getPerformanceClients, getPerformanceReport, refreshPerformance, reportPageUrl } from '@/lib/api'
import type { PerformanceClient, PerformanceReport } from '@/lib/types'

const PAGE_SIZE = 20
const num = (n: number) => new Intl.NumberFormat('id-ID', { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n)
const monthLabel = (p: string) => new Date(`${p}-01T00:00:00Z`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const fmtDate = (epoch: number | null) => (epoch ? new Date(epoch * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–')

/** Bulan ini & 5 bulan sebelumnya (YYYY-MM, UTC) */
function recentPeriods(): string[] {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

export default function ReportsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <Reports />
      </Suspense>
    </RequireAuth>
  )
}

/** Pola List / Index: klien jasa clipping beserta performa klipnya per bulan; baris → laporan (Analytics). */
function Reports() {
  const { me } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const selected = params.get('client')
  const [period, setPeriod] = useState(recentPeriods()[0])
  const [data, setData] = useState<{ clients: PerformanceClient[]; youtube_api: boolean } | null>(null)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    getPerformanceClients(period).then(setData).catch(e => toast.error(e instanceof Error ? e.message : 'Daftar klien belum bisa dimuat. Coba lagi.'))
  }, [period])
  useEffect(load, [load])

  // "/" memfokuskan pencarian
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (me && !me.is_admin) return <p role="alert" className="pt-16 text-ink-muted">Laporan khusus admin.</p>
  if (selected) return <AdminReport client={selected} onBack={() => router.push('/laporan')} />

  const refresh = async (client?: string) => {
    setRefreshing(client ?? 'all')
    try {
      const res = await refreshPerformance(client)
      toast.success(`${res.updated} link diperbarui${res.failed ? `, ${res.failed} belum bisa dibaca` : ''}${res.skipped ? `, ${res.skipped} masih baru` : ''}`)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Angka belum bisa diperbarui. Coba lagi.')
    } finally {
      setRefreshing(null)
    }
  }

  const clients = data?.clients ?? []
  const filtered = clients.filter(c => c.client_name.toLowerCase().includes(query.trim().toLowerCase()))
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <div className="pt-10 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="type-display text-4xl text-ink">Laporan klien</h1>
          <p className="mt-2 max-w-[68ch] text-ink-muted">
            Views klip yang sudah diunggah klien, dirangkum per bulan. Kirim link laporannya beberapa hari sebelum tagihan.
          </p>
        </div>
        <button type="button" onClick={() => refresh()} disabled={refreshing !== null} className="btn btn-quiet">
          <RefreshCw className={`size-4 ${refreshing === 'all' ? 'animate-spin' : ''}`} aria-hidden /> Perbarui semua angka
        </button>
      </div>

      {/* Toolbar: pencarian berlabel + satu filter (periode) */}
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="client-search" className="text-sm text-ink-muted">Cari klien</label>
          <div className="field mt-1 h-10 w-72 max-w-full">
            <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
            <input id="client-search" ref={searchRef} value={query} onChange={e => { setQuery(e.target.value); setPage(0) }}
              placeholder="Podcast Budi" className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint" />
            <kbd className="timecode rounded border border-rule px-1 text-xs text-ink-faint">/</kbd>
          </div>
        </div>
        <div>
          <label htmlFor="report-month" className="text-sm text-ink-muted">Periode</label>
          <select id="report-month" value={period} onChange={e => { setPeriod(e.target.value); setPage(0) }}
            className="mt-1 block h-10 rounded-md border border-rule bg-bay px-2 text-sm text-ink">
            {recentPeriods().map(p => <option key={p} value={p}>{monthLabel(p)}</option>)}
          </select>
        </div>
      </div>
      {data && !data.youtube_api && (
        <p className="mt-2 max-w-[68ch] text-xs text-ink-faint">
          Angka diambil lewat yt-dlp. Isi <code className="timecode text-ink">YOUTUBE_API_KEY</code> di backend/.env agar angka YouTube lebih andal.
        </p>
      )}

      {/* Tabel dalam bingkai L1 (border + garis pemisah); bergulir di dalam bingkai pada layar sempit */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-rule bg-panel">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="border-b border-rule text-left text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Klien</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold" aria-sort="descending">Views <span aria-hidden>↓</span></th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Diunggah</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Dikirim</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Revisi</th>
              <th scope="col" className="px-4 py-3 font-semibold">Diperbarui</th>
              <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {!data ? (
              [0, 1, 2].map(i => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="skeleton h-6" /></td></tr>
              ))
            ) : clients.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10">
                <p className="font-semibold text-ink">Belum ada klien di laporan</p>
                <p className="mt-1 max-w-[60ch] text-ink-muted">
                  Klien muncul setelah kamu mengirim link review. Begitu klien menempelkan link klip yang sudah diunggah,
                  views-nya terhitung otomatis untuk laporan bulanan.
                </p>
                <Link href="/riwayat" className="btn btn-primary mt-4">Buka video & kirim link review</Link>
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10">
                <p className="text-ink">Tidak ada klien bernama “{query}”.</p>
                <button type="button" onClick={() => setQuery('')} className="btn btn-sm btn-quiet mt-3">Hapus pencarian</button>
              </td></tr>
            ) : rows.map(c => (
              <ClientRow key={c.key} client={c} busy={refreshing === c.key} onRefresh={() => refresh(c.key)} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginasi selalu tampil */}
      <nav aria-label="Halaman" className="mt-4 flex items-center justify-between gap-4 text-sm">
        <p className="text-ink-muted">Halaman {current + 1} dari {pages} · {filtered.length} klien</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPage(current - 1)} disabled={current === 0} className="btn btn-sm btn-quiet">Halaman sebelumnya</button>
          <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} className="btn btn-sm btn-quiet">Halaman berikutnya</button>
        </div>
      </nav>
    </div>
  )
}

function ClientRow({ client, busy, onRefresh }: { client: PerformanceClient; busy: boolean; onRefresh: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = reportPageUrl(client.token)
  const msg = `Halo ${client.client_name}, ini laporan performa klip bulan ini: ${url}`
  const t = client.totals
  return (
    <tr className="hover:bg-raised/50">
      <td className="px-4 py-3">
        {/* Baris yang bisa diklik: nama klien berwarna tautan + panah */}
        <Link href={`/laporan?client=${encodeURIComponent(client.key)}`} className="inline-flex items-center gap-1 font-semibold text-signal hover:underline underline-offset-4">
          {client.client_name} <ChevronRight className="size-4" aria-hidden />
        </Link>
        <p className="text-xs text-ink-muted">
          {client.links ? `${client.links} link unggahan` : 'Belum ada link unggahan'}
          {client.top_clip && ` · teratas: ${client.top_clip.title}`}
        </p>
      </td>
      <td className="px-4 py-3 text-right timecode text-ink">
        {num(t.views)}
        {client.views_change_pct !== null && (
          <span className={`block text-xs ${client.views_change_pct >= 0 ? 'text-teal' : 'text-tally'}`}>
            {client.views_change_pct >= 0 ? '+' : ''}{client.views_change_pct}%
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right timecode text-ink">{t.published}</td>
      <td className="px-4 py-3 text-right timecode text-ink">{t.delivered}</td>
      <td className="px-4 py-3 text-right timecode text-ink">{t.revision}</td>
      <td className="px-4 py-3 text-ink-muted">{fmtDate(client.updated_at)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <button type="button" className="btn btn-sm btn-quiet" onClick={() => {
            navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
          }}>
            {copied ? <Check className="size-4 text-teal" aria-hidden /> : <Copy className="size-4" aria-hidden />} Salin link
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-quiet">
            <MessageCircle className="size-4" aria-hidden /> Kirim WA
          </a>
          <IconButton label="Kirim lewat email" icon={Mail}
            href={`mailto:?subject=${encodeURIComponent(`Laporan klip ${client.client_name}`)}&body=${encodeURIComponent(msg)}`} />
          <IconButton label="Buka seperti klien" icon={ExternalLink} href={url} external />
          <IconButton label="Perbarui angka klien ini" icon={RefreshCw} onClick={onRefresh} disabled={busy} spin={busy} />
        </div>
      </td>
    </tr>
  )
}

/** Laporan versi operator (pola Analytics): sama dengan yang dilihat klien + skor analisis per klip untuk kalibrasi. */
function AdminReport({ client, onBack }: { client: string; onBack: () => void }) {
  const [report, setReport] = useState<PerformanceReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback((period?: string) => {
    getPerformanceReport(client, period).then(r => setReport(r.report)).catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [client])
  useEffect(() => { load() }, [load])

  return (
    <div className="pt-6">
      <button type="button" onClick={onBack} className="btn btn-sm btn-quiet print:hidden">
        <ArrowLeft className="size-4" aria-hidden /> Kembali ke semua klien
      </button>
      {error ? <p role="alert" className="pt-10 text-ink-muted">{error} <Link href="/laporan" className="underline">Kembali ke semua klien</Link></p>
        : !report ? <ReportSkeleton />
        : <ReportView report={report} onPeriod={load} showScores />}
    </div>
  )
}
