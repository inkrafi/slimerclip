'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Plus, Search, X } from 'lucide-react'
import { getMotionProjects } from '@/lib/api'
import { formatDeadline, isOpen, MOTION_STATUSES, packageLabel, statusInfo, todayIso } from '@/lib/motion'
import type { MotionProject, MotionStatus } from '@/lib/types'

const PAGE_SIZE = 20

/** Urutan bawaan: tenggat terdekat dulu, proyek tanpa tenggat dan yang sudah selesai di belakang */
function byDeadline(a: MotionProject, b: MotionProject) {
  const open = Number(isOpen(b.status)) - Number(isOpen(a.status))
  if (open) return open
  if (!a.deadline !== !b.deadline) return a.deadline ? -1 : 1
  return a.deadline.localeCompare(b.deadline) || b.updated_at - a.updated_at
}

/** Pattern 1, List / Index: pencatatan proyek jasa motion video. */
export default function MotionProjectList() {
  const [projects, setProjects] = useState<MotionProject[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<MotionStatus | ''>('')
  const [page, setPage] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const fetchProjects = useCallback(() => getMotionProjects().then(setProjects)
    .catch(e => setError(e instanceof Error ? e.message : 'Daftar proyek gagal dimuat.')), [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const retry = () => {
    setError(null)
    setProjects(null)
    fetchProjects()
  }

  // "/" memfokuskan pencarian
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (projects ?? [])
      .filter(p => !status || p.status === status)
      .filter(p => !q || `${p.client} ${p.product}`.toLowerCase().includes(q))
      .sort(byDeadline)
  }, [projects, query, status])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const today = todayIso()
  const filtering = Boolean(query.trim() || status)

  return (
    <div className="pt-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="type-heading text-3xl text-ink">Proyek motion</h1>
          <p className="mt-1 text-ink-muted">Catat klien, paket, status, dan tenggat tiap proyek motion video.</p>
        </div>
        <Link href="/proyek-motion/baru" className="btn btn-primary h-11"><Plus className="size-4" aria-hidden /> Tambah proyek</Link>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-60">
          <span className="text-sm text-ink">Cari</span>
          <span className="field mt-1.5 h-11">
            <Search className="size-4 shrink-0 text-ink-muted" aria-hidden />
            <input ref={searchRef} type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }}
              placeholder="Nama klien atau produk" className="w-full bg-transparent text-ink placeholder:text-ink-faint outline-none" />
          </span>
        </label>
        <label className="basis-48">
          <span className="text-sm text-ink">Status</span>
          <span className="field mt-1.5 h-11">
            <select value={status} onChange={e => { setStatus(e.target.value as MotionStatus | ''); setPage(0) }} className="w-full bg-transparent text-ink outline-none">
              <option value="">Semua status</option>
              {MOTION_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </span>
        </label>
      </div>

      {status && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={() => setStatus('')} className="btn btn-sm btn-quiet">
            Status: {statusInfo(status).label} <X className="size-3.5" aria-hidden />
            <span className="sr-only">Hapus filter</span>
          </button>
        </div>
      )}

      <div className="mt-4 overflow-x-auto thin-scroll rounded-lg border border-rule glass">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr className="border-b border-rule text-ink-muted">
              <th scope="col" className="px-4 py-3 font-medium">Klien</th>
              <th scope="col" className="px-4 py-3 font-medium">Paket</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium" aria-sort="ascending">Tenggat</th>
              <th scope="col" className="px-4 py-3 font-medium">Harga</th>
              <th scope="col" className="w-10 px-2 py-3"><span className="sr-only">Buka</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {projects === null && !error && Array.from({ length: 3 }, (_, i) => (
              <tr key={i} aria-hidden>
                <td colSpan={6} className="px-4 py-3"><div className="skeleton h-5 rounded" /></td>
              </tr>
            ))}
            {error && (
              <tr>
                <td colSpan={6} className="px-4 py-10">
                  {/* Tetap terlihat saat tabel digeser menyamping di layar sempit */}
                  <div className="sticky left-4 w-fit max-w-[17rem] md:max-w-none">
                    <p role="alert" className="text-tally">{error}</p>
                    <button type="button" onClick={retry} className="btn btn-quiet mt-3">Coba lagi</button>
                  </div>
                </td>
              </tr>
            )}
            {projects !== null && !rows.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-ink-muted">
                  <p className="sticky left-4 w-fit max-w-[17rem] md:max-w-none">
                    {filtering ? 'Tidak ada proyek yang cocok. Coba kata kunci atau status lain.' : 'Belum ada proyek. Tambahkan setelah konsultasi pertama.'}
                  </p>
                </td>
              </tr>
            )}
            {rows.map(p => {
              const info = statusInfo(p.status)
              const overdue = isOpen(p.status) && p.deadline && p.deadline < today
              return (
                <tr key={p.id} className="relative hover:bg-raised focus-within:bg-raised">
                  <td className="px-4 py-3">
                    <Link href={`/proyek-motion/${p.id}`} className="font-semibold text-ink underline decoration-rule underline-offset-4 after:absolute after:inset-0 hover:decoration-ink-muted">{p.client}</Link>
                    {p.product && <span className="block text-xs text-ink-muted">{p.product}</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{packageLabel(p.package)}</td>
                  <td className={`px-4 py-3 font-medium ${info.tone}`}>{info.label}</td>
                  <td className={`px-4 py-3 tabular-nums ${overdue ? 'font-semibold text-tally' : 'text-ink-muted'}`}>
                    {formatDeadline(p.deadline)}{overdue && <span className="block text-xs">Lewat tenggat</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-muted">{p.price || '—'}</td>
                  <td className="px-2 py-3 text-ink-muted"><ChevronRight className="size-4" aria-hidden /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
        <p aria-live="polite">{projects === null ? 'Memuat proyek…' : `${filtered.length} proyek · Halaman ${current + 1} dari ${pages}`}</p>
        <div className="flex gap-2">
          <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="btn btn-sm btn-quiet">Sebelumnya</button>
          <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="btn btn-sm btn-quiet">Berikutnya</button>
        </div>
      </div>
    </div>
  )
}
