import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getJobs, isJobActive, RENDER_STARTED_EVENT, startRender } from '@/lib/api'
import { ClipGenerateOptions, ClipProgress, RenderJob, Segment } from '@/lib/types'

const POLL_MS = 1500

interface UseRenderJobOptions {
  videoId: string
  youtubeUrl: string
  /** Dipanggil saat ada klip baru selesai, agar daftar klip tersimpan dimuat ulang */
  onClipsChanged?: () => void
}

/**
 * Render berjalan sebagai job di backend. Hook ini memuat job video ini saat halaman
 * dibuka (termasuk yang dimulai sebelum pindah halaman) dan memantaunya selama masih aktif.
 * Progres dikembalikan per rentang momen ("MM:SS-MM:SS") agar tetap cocok walau nomor momen berubah.
 */
export function useRenderJob({ videoId, youtubeUrl, onClipsChanged }: UseRenderJobOptions) {
  const [jobs, setJobs] = useState<RenderJob[]>([])
  const [starting, setStarting] = useState(false)
  const seenDone = useRef<Set<string>>(new Set())
  const onClipsChangedRef = useRef(onClipsChanged)
  useEffect(() => { onClipsChangedRef.current = onClipsChanged })

  const applyJobs = useCallback((list: RenderJob[]) => {
    setJobs(list)
    let newClip = false
    for (const job of list) {
      for (const seg of Object.values(job.segments)) {
        const id = `${job.id}:${seg.key}`
        if (seg.status === 'done' && !seenDone.current.has(id)) {
          seenDone.current.add(id)
          newClip = true
        }
      }
    }
    if (newClip) onClipsChangedRef.current?.()
  }, [])

  // Backend tidak bisa dihubungi sementara → abaikan, coba lagi di putaran berikutnya
  const refresh = useCallback(() => {
    getJobs(videoId).then(applyJobs).catch(() => {})
  }, [videoId, applyJobs])

  useEffect(() => {
    getJobs(videoId).then(applyJobs).catch(() => {})
  }, [videoId, applyJobs])

  const hasActive = jobs.some(isJobActive)
  useEffect(() => {
    if (!hasActive) return
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [hasActive, refresh])

  const start = async (segments: Segment[], options: ClipGenerateOptions) => {
    setStarting(true)
    try {
      const job = await startRender(youtubeUrl, segments, options)
      setJobs(prev => [job, ...prev])
      window.dispatchEvent(new Event(RENDER_STARTED_EVENT))
      toast('Render berjalan di belakang layar. Kamu boleh pindah halaman.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Render tidak bisa dimulai.')
    } finally {
      setStarting(false)
    }
  }

  // Job terbaru menimpa status job lama untuk momen yang sama
  const progressByKey = useMemo(() => {
    const map: Record<string, ClipProgress> = {}
    for (const job of [...jobs].sort((a, b) => a.created_at - b.created_at)) {
      for (const seg of Object.values(job.segments)) {
        const waitingDownload = job.status === 'downloading' && seg.status === 'queued'
        map[seg.key] = {
          segment_number: seg.segment_number,
          status: waitingDownload ? 'downloading' : seg.status,
          progress: waitingDownload ? job.download.progress : seg.progress,
          url: seg.url ?? undefined,
          error_message: seg.message ?? (job.status === 'error' ? job.message ?? undefined : undefined),
        }
      }
    }
    return map
  }, [jobs])

  return { progressByKey, isGenerating: starting || hasActive, start }
}
