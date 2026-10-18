'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getJobs, isJobActive, RENDER_STARTED_EVENT } from '@/lib/api'
import { RenderJob } from '@/lib/types'

const POLL_MS = 2000

/**
 * Penanda render di header: terlihat dari halaman mana pun selama ada job render aktif,
 * dan memberi notifikasi saat job selesai walau pengguna sedang di halaman lain.
 */
export default function RenderIndicator() {
  const pathname = usePathname()
  const router = useRouter()
  const [active, setActive] = useState<RenderJob[]>([])
  const watched = useRef<Map<string, RenderJob>>(new Map())

  const applyJobs = useCallback((jobs: RenderJob[]) => {
    const byId = new Map(jobs.map(j => [j.id, j]))

    // Job yang tadinya aktif dan sekarang selesai → beri tahu
    for (const [id, before] of watched.current) {
      const now = byId.get(id)
      if (now && isJobActive(now)) continue
      watched.current.delete(id)
      if (!now) continue
      const segs = Object.values(now.segments)
      const ok = segs.filter(s => s.status === 'done').length
      const title = before.title || 'video'
      const open = () => router.push(`/video/${now.video_id}/klip`)
      if (ok === segs.length) toast.success(`${ok} klip selesai dirender: ${title}`, { action: { label: 'Lihat klip', onClick: open } })
      else toast.warning(`${ok} dari ${segs.length} klip berhasil dirender: ${title}`, { action: { label: 'Lihat klip', onClick: open } })
    }

    const nowActive = jobs.filter(isJobActive)
    for (const job of nowActive) watched.current.set(job.id, job)
    setActive(nowActive)
  }, [router])

  const check = useCallback(() => {
    getJobs().then(applyJobs).catch(() => {})
  }, [applyJobs])

  // Periksa saat berpindah halaman dan saat render baru dimulai
  useEffect(() => {
    getJobs().then(applyJobs).catch(() => {})
  }, [pathname, applyJobs])
  useEffect(() => {
    const onStart = () => { check() }
    window.addEventListener(RENDER_STARTED_EVENT, onStart)
    return () => window.removeEventListener(RENDER_STARTED_EVENT, onStart)
  }, [check])

  // Pantau terus selama masih ada job aktif
  useEffect(() => {
    if (active.length === 0) return
    const timer = setInterval(check, POLL_MS)
    return () => clearInterval(timer)
  }, [active.length, check])

  if (active.length === 0) return null

  const segments = active.flatMap(j => Object.values(j.segments))
  const done = segments.filter(s => s.status === 'done' || s.status === 'error').length
  const first = active[0]

  return (
    <Link
      href={`/video/${first.video_id}`}
      className="flex items-center gap-2 rounded-full border border-rule bg-raised px-3 h-8 text-xs text-ink hover:border-signal"
      title={first.title ? `Merender klip: ${first.title}` : 'Merender klip'}
    >
      <Loader2 className="size-3.5 animate-spin text-signal" aria-hidden />
      <span>
        Merender <span className="timecode">{done}/{segments.length}</span> klip
      </span>
    </Link>
  )
}
