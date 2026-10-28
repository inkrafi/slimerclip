'use client'

import { useEffect, useRef, useState } from 'react'
import { Archive, Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'
import { getJob, getJobs, getTemplates, isJobActive, renderAll, RENDER_STARTED_EVENT } from '@/lib/api'
import { useActivePreset } from '@/lib/clipProfile'
import type { EditTemplate, RenderJob } from '@/lib/types'

interface Props {
  videoId: string
  /** Klip yang bisa dirender ulang (bukan klip lama) */
  clipCount: number
  zipUrl: string | null
  /** Dipanggil setelah render selesai, untuk memuat ulang daftar klip */
  onDone: () => void
}

/** Render semua klip satu video dengan satu format edit, dan unduh semua klip final sebagai ZIP. */
export default function BatchRenderBar({ videoId, clipCount, zipUrl, onDone }: Props) {
  const [templates, setTemplates] = useState<EditTemplate[] | null>(null)
  const [templateId, setTemplateId] = useState('')
  const activePreset = useActivePreset()
  const activeTemplateRef = useRef(activePreset?.template_id ?? '')
  useEffect(() => { activeTemplateRef.current = activePreset?.template_id ?? '' }, [activePreset])
  const [job, setJob] = useState<RenderJob | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    getTemplates().then(items => {
      setTemplates(items)
      // Klien yang sedang dikerjakan (preset aktif) → format edit-nya jadi pilihan awal
      const preferred = activeTemplateRef.current
      setTemplateId(items.some(t => t.id === preferred) ? preferred : items[0]?.id ?? '')
    }).catch(() => setTemplates([]))
    // Render semua yang masih berjalan (mis. setelah halaman dimuat ulang)
    getJobs(videoId).then(items => {
      const running = items.find(j => isJobActive(j) && Object.keys(j.segments).length > 1)
      if (running) setJob(running)
    }).catch(() => {})
  }, [videoId])

  const jobId = job?.id
  useEffect(() => {
    if (!jobId) return
    let stopped = false
    const timer = setInterval(async () => {
      try {
        const next = await getJob(jobId)
        if (stopped) return
        setJob(next)
        if (!isJobActive(next)) {
          clearInterval(timer)
          const failed = Object.values(next.segments).filter(s => s.status === 'error').length
          if (failed) toast.error(`${failed} klip gagal dirender. Coba render ulang klip itu dari editor.`)
          else toast.success('Semua klip final siap diunduh')
          setJob(null)
          onDone()
        }
      } catch { /* coba lagi di interval berikutnya */ }
    }, 2000)
    return () => { stopped = true; clearInterval(timer) }
  }, [jobId, onDone])

  const start = async () => {
    setStarting(true)
    try {
      setJob(await renderAll(videoId, templateId))
      window.dispatchEvent(new Event(RENDER_STARTED_EVENT))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Render semua gagal dimulai.')
    } finally {
      setStarting(false)
    }
  }

  const segments = job ? Object.values(job.segments) : []
  const finished = segments.filter(s => s.status === 'done' || s.status === 'error').length

  return (
    <section aria-label="Render & unduh semua klip" className="mt-8 rounded-lg border border-rule p-4">
      <div className="flex flex-wrap items-end gap-3">
        {templates === null ? (
          <p className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Memuat format edit…</p>
        ) : templates.length === 0 ? (
          <p className="max-w-[52ch] text-sm text-ink-muted">
            Untuk merender semua klip sekaligus, simpan dulu format edit di editor klip (bagian <span className="text-ink">Format edit</span>).
          </p>
        ) : (
          <>
            <div>
              <label htmlFor="batch-template" className="text-sm text-ink-muted">Render semua klip dengan format</label>
              <select
                id="batch-template"
                value={templateId}
                disabled={!!job}
                onChange={e => setTemplateId(e.target.value)}
                className="mt-1 block h-9 min-w-[12rem] rounded-md border border-rule bg-bay px-2 text-ink"
              >
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <button type="button" onClick={start} disabled={!!job || starting || !templateId || clipCount === 0} className="btn btn-primary h-9">
              {job || starting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
              Render {clipCount} klip
            </button>
          </>
        )}
        {zipUrl && !job && (
          <a href={zipUrl} download className="btn btn-quiet h-9 sm:ml-auto">
            <Archive className="size-4" aria-hidden /> Unduh semua (ZIP)
          </a>
        )}
      </div>
      {job ? (
        <p role="status" className="mt-3 text-sm text-ink-muted">
          {job.status === 'queued' ? 'Menunggu render lain selesai…' : `Merender ${finished} dari ${segments.length} klip…`}
          {' '}Halaman ini boleh ditinggal; render tetap berjalan.
        </p>
      ) : templates && templates.length > 0 && (
        <p className="mt-3 text-xs text-ink-faint">
          Rentang, teks hook, teks caption, dan efek suara tiap klip tetap. Klip tanpa teks hook memakai ide hook pertama dari analisis.
        </p>
      )}
    </section>
  )
}
