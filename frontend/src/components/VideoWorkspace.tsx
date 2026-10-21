'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import SummaryBar from '@/components/SummaryBar'
import CutMap from '@/components/CutMap'
import SegmentCard from '@/components/SegmentCard'
import ClipGeneratorPanel from '@/components/ClipGeneratorPanel'
import VideoPreviewModal from '@/components/VideoPreviewModal'
import { useAuth } from '@/components/AuthProvider'
import { useRenderJob } from '@/hooks/useRenderJob'
import { useVideoUpload } from '@/hooks/useVideoUpload'
import { analyzeVideo, ApiError, getClips, getVideo, youtubeUrlFor } from '@/lib/api'
import { formatSpan, videoLength } from '@/lib/clip-meta'
import { ClipProgress, Me, RenderedClip, UploadedFileInfo, VideoDetail } from '@/lib/types'

type Phase = 'loading' | 'analyzing' | 'ready' | 'error'

const clipKey = (start: string, end: string) => `${start}-${end}`

/** Keterangan biaya sebelum analisis ulang, sesuai siapa yang membayar panggilan Gemini. */
function reanalyzeCost(me: Me | null) {
  if (!me || me.is_admin) return 'Ini memakai kuota Gemini.'
  if (me.has_gemini_key) return 'Ini memakai kuota API key Gemini milikmu.'
  return `Ini memakai 1 dari ${me.free_analyses_left ?? 0} analisis gratismu.`
}

export default function VideoWorkspace({ videoId }: { videoId: string }) {
  const youtubeUrl = youtubeUrlFor(videoId)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | undefined>()
  const { me, refreshMe } = useAuth()
  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null)
  const [openMoments, setOpenMoments] = useState<Set<number>>(new Set())
  const [activeMoment, setActiveMoment] = useState<number | null>(null)
  const [activeClip, setActiveClip] = useState<{ start: string; end: string } | null>(null)
  const startedRef = useRef(false)

  const refreshClips = useCallback(() => {
    getClips(videoId)
      .then(clips => setDetail(prev => (prev ? { ...prev, clips } : prev)))
      .catch(() => {})
  }, [videoId])

  // Klip baru selesai → muat ulang daftar klip dan jatah render
  const onClipsChanged = useCallback(() => {
    refreshClips()
    refreshMe()
  }, [refreshClips, refreshMe])

  const { progressByKey, isGenerating, start } = useRenderJob({ videoId, youtubeUrl, onClipsChanged })

  const hadAnalysisRef = useRef(false)
  const runAnalysis = useCallback(async (force: boolean) => {
    setPhase('analyzing')
    setError(null)
    setErrorCode(undefined)
    try {
      const analysis = await analyzeVideo(youtubeUrl, force)
      const fresh = await getVideo(videoId)
      setDetail({ ...fresh, analysis: fresh.analysis ?? analysis })
      setUploadedFile(prev => prev ?? fresh.upload)
      setOpenMoments(new Set([analysis.best_segment_number || 1]))
      setPhase('ready')
      refreshMe()
      toast.success(force ? 'Analisis diperbarui' : `${analysis.segments.length} momen ditemukan`)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Analisis gagal.'
      // Analisis ulang gagal (mis. jatah habis) → hasil lama tetap ditampilkan
      if (force && hadAnalysisRef.current) {
        toast.error(message)
        setPhase('ready')
        return
      }
      setError(message)
      setErrorCode(e instanceof ApiError ? e.code : undefined)
      setPhase('error')
    }
  }, [videoId, youtubeUrl, refreshMe])

  // Muat data tersimpan; jika video belum pernah dianalisis, mulai analisis otomatis.
  // Jika analisis sedang berjalan (mis. halaman di-refresh), backend menunggu hasil yang sama.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    getVideo(videoId)
      .then(data => {
        setDetail(data)
        setUploadedFile(data.upload)
        if (data.analysis) {
          setOpenMoments(new Set([data.analysis.best_segment_number || 1]))
          setPhase('ready')
        } else {
          runAnalysis(false)
        }
      })
      .catch(e => {
        setError(e.message)
        setPhase('error')
      })
  }, [videoId, runAnalysis])

  const analysis = detail?.analysis ?? null
  useEffect(() => { hadAnalysisRef.current = !!analysis }, [analysis])
  const clipsByKey = useMemo(() => {
    const map = new Map<string, RenderedClip>()
    for (const c of detail?.clips ?? []) map.set(c.key, c)
    return map
  }, [detail?.clips])

  // Progres job render (termasuk yang dimulai sebelum pindah halaman) menimpa status "sudah dirender"
  const mergedProgress = useMemo(() => {
    const map: Record<number, ClipProgress> = {}
    for (const seg of analysis?.segments ?? []) {
      const key = clipKey(seg.start_time, seg.end_time)
      const saved = clipsByKey.get(key)
      const savedUrl = saved ? (saved.url ?? saved.preview_url ?? undefined) : undefined
      if (saved) map[seg.segment_number] = { segment_number: seg.segment_number, status: 'done', progress: 100, url: savedUrl }
      const live = progressByKey[key]
      if (live) map[seg.segment_number] = { ...live, segment_number: seg.segment_number, url: live.url ?? savedUrl }
    }
    return map
  }, [analysis?.segments, clipsByKey, progressByKey])

  const toggleMoment = (n: number) =>
    setOpenMoments(prev => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  // Klik penanda di peta potongan → buka momennya dan gulir ke sana
  const focusMoment = (n: number) => {
    setActiveMoment(n)
    setOpenMoments(prev => new Set(prev).add(n))
    requestAnimationFrame(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      document.getElementById(`moment-${n}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    })
  }

  const reanalyze = () => {
    if (!confirm(`Analisis ulang video ini? ${reanalyzeCost(me)} Klip yang sudah dirender tetap tersimpan.`)) return
    runAnalysis(true)
  }

  if (phase === 'loading') {
    return <p className="pt-16 flex items-center gap-2 text-ink-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Memuat…</p>
  }

  if (phase === 'analyzing') {
    return (
      <div className="pt-12" role="status" aria-live="polite">
        <h1 className="type-heading text-2xl text-ink">Menganalisis video</h1>
        <p className="mt-1 text-sm text-ink-muted break-all">{youtubeUrl}</p>
        <div className="mt-8 relative h-20 rounded-md border border-rule glass overflow-hidden">
          <span className="playhead absolute inset-y-0 w-0.5 bg-signal" style={{ animation: 'playhead-sweep 2.4s linear infinite' }} aria-hidden />
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-ink">
          <Loader2 className="size-4 animate-spin text-signal" aria-hidden />
          Membaca transkrip, data tonton ulang, dan menandai momen…
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {uploadedFile
            ? 'Jika YouTube tidak memberi transkrip, transkrip dibuat dari file videomu. Untuk video panjang ini bisa beberapa menit.'
            : 'Biasanya 20 sampai 60 detik.'}{' '}
          Halaman ini boleh di-refresh; analisis tetap berjalan.
        </p>
      </div>
    )
  }

  if (phase === 'error' || !analysis) {
    return (
      <AnalysisError
        message={error}
        code={errorCode}
        videoId={videoId}
        youtubeUrl={youtubeUrl}
        me={me}
        onRetry={() => runAnalysis(false)}
        onUploaded={info => { setUploadedFile(info); runAnalysis(false) }}
      />
    )
  }

  const duration = videoLength(analysis.segments, analysis.video_metadata?.duration)
  const clipCount = detail?.clips.length ?? 0
  const legacyScore = analysis.scoring_version !== 2

  return (
    <div className="pt-10">
      <SummaryBar summary={analysis.overall_video_summary} metadata={analysis.video_metadata} youtubeUrl={youtubeUrl} />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {clipCount > 0 && (
          <Link href={`/video/${videoId}/klip`} className="btn btn-quiet">Klip tersimpan ({clipCount})</Link>
        )}
        <button type="button" onClick={reanalyze} disabled={isGenerating} className="btn btn-quiet">Analisis ulang</button>
      </div>

      {legacyScore && (
        <p className="mt-4 max-w-2xl border-l-2 border-signal pl-4 text-sm text-ink-muted">
          Skor di bawah dibuat dengan cara lama (hanya penilaian AI). Analisis ulang untuk skor yang juga memakai data
          tonton ulang YouTube dan rincian per komponen.
        </p>
      )}

      <div className="mt-12">
        <CutMap
          segments={analysis.segments}
          duration={duration}
          heatmap={analysis.video_metadata?.heatmap}
          onSelect={focusMoment}
          activeNumber={activeMoment}
          animate
          label={`Peta potongan: ${analysis.segments.length} momen dari video ${formatSpan(duration)}`}
        />
        <p className="mt-1 text-sm text-ink-muted">
          {analysis.segments.length} momen dari video {formatSpan(duration)}. Klik penanda untuk membuka momennya.
          {analysis.video_metadata?.heatmap?.length ? ' Kurva samar adalah grafik bagian yang paling sering diputar ulang di YouTube.' : ''}
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
        <section aria-labelledby="moments-title">
          <h2 id="moments-title" className="type-heading text-2xl text-ink">Momen, dari skor tertinggi</h2>
          <div className="mt-4 rounded-lg border border-rule glass overflow-hidden">
            {analysis.segments.map(seg => (
              <SegmentCard
                key={`${seg.segment_number}-${seg.start_time}`}
                segment={seg}
                isBest={analysis.best_segment_number === seg.segment_number}
                isOpen={openMoments.has(seg.segment_number)}
                onToggle={() => toggleMoment(seg.segment_number)}
                onPlayClip={(s, e) => setActiveClip({ start: s, end: e })}
                editHref={clipsByKey.has(clipKey(seg.start_time, seg.end_time))
                  ? `/video/${videoId}/klip/edit?key=${encodeURIComponent(clipKey(seg.start_time, seg.end_time))}` : undefined}
              />
            ))}
          </div>
        </section>

        <aside className="lg:sticky lg:top-20">
          <ClipGeneratorPanel
            key={analysis.segments.map(s => s.start_time).join()}
            videoId={videoId}
            youtubeUrl={youtubeUrl}
            segments={analysis.segments}
            onGenerate={start}
            progressMap={mergedProgress}
            isGenerating={isGenerating}
            uploadedFile={uploadedFile}
            setUploadedFile={setUploadedFile}
            clipsHref={clipCount > 0 ? `/video/${videoId}/klip` : undefined}
            me={me}
          />
        </aside>
      </div>

      <VideoPreviewModal
        isOpen={!!activeClip}
        onClose={() => setActiveClip(null)}
        youtubeUrl={youtubeUrl}
        startTime={activeClip?.start || '00:00'}
        endTime={activeClip?.end || '00:00'}
      />
    </div>
  )
}

interface AnalysisErrorProps {
  message: string | null
  code?: string
  videoId: string
  youtubeUrl: string
  me: Me | null
  onRetry: () => void
  onUploaded: (info: UploadedFileInfo) => void
}

/** Analisis gagal: tiap jenis kegagalan diberi jalan keluarnya sendiri. */
function AnalysisError({ message, code, videoId, youtubeUrl, me, onRetry, onUploaded }: AnalysisErrorProps) {
  const quota = code === 'quota_exhausted' || code === 'server_quota'
  const needsFile = code === 'transcript_unavailable'
  const {
    isUploading, uploadProgress, uploadError, isDragging, fileInputRef,
    handleFileUpload, handleDrop, handleDragOver, handleDragLeave,
  } = useVideoUpload({ youtubeUrl, onUploaded })

  return (
    <div className="pt-12 max-w-2xl">
      <div role="alert" className={`border-l-2 pl-4 ${quota ? 'border-signal' : 'border-tally'}`}>
        <p className="font-semibold text-ink">
          {code === 'quota_exhausted' ? 'Analisis gratismu sudah terpakai semua'
            : code === 'server_quota' ? 'Jatah analisis gratis hari ini sudah habis'
            : needsFile ? 'Transkrip video ini tidak bisa diambil dari YouTube'
            : 'Analisis tidak bisa diselesaikan'}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{message}</p>
      </div>

      {quota && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/pengaturan?next=${encodeURIComponent(`/video/${videoId}`)}`} className="btn btn-primary">Tambahkan API key Gemini</Link>
          <Link href="/riwayat" className="btn btn-quiet">Buka riwayat</Link>
        </div>
      )}

      {needsFile && (
        <div className="mt-6">
          <div
            role="button"
            tabIndex={0}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && !isUploading && fileInputRef.current?.click()}
            className={`rounded-lg border border-dashed px-5 py-8 text-center glass ${isDragging ? 'border-signal' : 'border-rule hover:border-ink-faint'}`}
          >
            {isUploading ? (
              <div className="max-w-xs mx-auto space-y-2">
                <p className="text-ink">Mengupload… <span className="timecode">{uploadProgress}%</span></p>
                <div className="h-1 rounded-full bg-rule overflow-hidden">
                  <div className="h-full bg-signal transition-[width] duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <>
                <p className="text-ink">Upload file video ini, transkripnya dibuat langsung dari file.</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Seret file ke sini, atau <span className="text-ink underline underline-offset-4">pilih file</span>.
                  {me?.upload_max_mb ? ` Maks ${me.upload_max_mb} MB, ${me.upload_max_minutes} menit.` : ''}
                  {' '}File yang sama juga dipakai saat render.
                </p>
              </>
            )}
          </div>
          {uploadError && <p className="mt-2 text-sm text-tally">{uploadError}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/x-matroska,video/quicktime,video/x-msvideo,video/webm,.mp4,.mkv,.mov,.avi,.webm,.m4v,.flv"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
              e.target.value = ''
            }}
          />
        </div>
      )}

      {!quota && (
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onRetry} className="btn btn-primary">Coba lagi</button>
          <Link href="/" className="btn btn-quiet">Video lain</Link>
        </div>
      )}
    </div>
  )
}
