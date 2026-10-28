import React, { useState } from 'react'
import Link from 'next/link'
import { Loader2, Pencil, X } from 'lucide-react'
import { ClipGenerateOptions, ClipProgress, Me, Segment, UploadedFileInfo } from '@/lib/types'
import { useVideoUpload } from '@/hooks/useVideoUpload'
import { angleOf } from '@/lib/clip-meta'
import { loadCaptionStyle } from '@/lib/caption-presets'
import { AUTH_ENABLED } from '@/lib/supabase'

interface ClipGeneratorPanelProps {
  videoId: string
  youtubeUrl: string
  segments: Segment[]
  onGenerate: (selectedSegments: Segment[], options: ClipGenerateOptions) => void
  progressMap: Record<number, ClipProgress>
  isGenerating: boolean
  uploadedFile: UploadedFileInfo | null
  setUploadedFile: React.Dispatch<React.SetStateAction<UploadedFileInfo | null>>
  /** Link ke halaman klip tersimpan, jika sudah ada klip */
  clipsHref?: string
  /** Akun yang login: menentukan sumber video yang boleh dipakai dan jatah render */
  me: Me | null
}

type VideoSourceMode = 'url' | 'local'

const STATUS_TEXT: Record<string, string> = {
  queued: 'Menunggu giliran',
  downloading: 'Mengunduh video sumber',
  cutting: 'Mempersiapkan',
  tracking: 'Mencari wajah',
  transcribing: 'Membuat caption',
  rendering: 'Merender',
  done: 'Pratinjau siap',
  error: 'Gagal',
}

export default function ClipGeneratorPanel({
  videoId,
  youtubeUrl,
  segments,
  onGenerate,
  progressMap,
  isGenerating,
  uploadedFile,
  setUploadedFile,
  clipsHref,
  me,
}: ClipGeneratorPanelProps) {
  // Unduh langsung dari YouTube hanya untuk admin (mode lokal selalu admin)
  const canUseYoutube = !AUTH_ENABLED || !!me?.is_admin

  // Sisa jatah pratinjau hari ini, dikurangi momen yang sedang antre/dirender (null = tanpa batas)
  const activeCount = Object.values(progressMap).filter(p => p.status !== 'done' && p.status !== 'error').length
  const renderLeft = me && me.preview_daily_limit != null
    ? Math.max(0, me.preview_daily_limit - (me.previews_today ?? 0) - activeCount)
    : null

  // Momen yang sudah tersimpan atau sedang dirender tidak dicentang otomatis, agar tidak dirender dua kali;
  // jika ada jatah harian, hanya momen teratas sebanyak sisa jatah
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<number[]>(() =>
    segments
      .filter(s => !progressMap[s.segment_number] || progressMap[s.segment_number].status === 'error')
      .map(s => s.segment_number)
      .slice(0, renderLeft ?? undefined)
  )

  // Pratinjau memakai pengaturan bawaan; caption, resolusi & tata letak diatur di editor sebelum render final.
  // Gaya caption awal = gaya terakhir yang dirender di browser ini.
  const [options] = useState<ClipGenerateOptions>(() => ({
    resolution: '1080',
    caption_enabled: true,
    smart_tracking: true,
    split_screen: true,
    format: 'mp4',
    caption_style: loadCaptionStyle(),
  }))

  // File yang pernah diupload untuk video ini otomatis dipakai; tanpa itu, unduh dari YouTube
  const [chosenSourceMode, setVideoSourceMode] = useState<VideoSourceMode>(uploadedFile ? 'local' : 'url')
  const videoSourceMode: VideoSourceMode = canUseYoutube ? chosenSourceMode : 'local'
  const {
    isUploading, uploadProgress, uploadError, isDragging, fileInputRef,
    handleFileUpload, handleDrop, handleDragOver, handleDragLeave, resetUpload,
  } = useVideoUpload({ youtubeUrl, onUploaded: setUploadedFile })

  const toggleSelection = (num: number) => {
    setSelectedSegmentIds(prev =>
      prev.includes(num) ? prev.filter(id => id !== num) : [...prev, num]
    )
  }

  const allSelected = selectedSegmentIds.length === segments.length
  const toggleAll = () => setSelectedSegmentIds(allSelected ? [] : segments.map(s => s.segment_number))

  const handleGenerate = () => {
    const selected = segments.filter(s => selectedSegmentIds.includes(s.segment_number))
    if (selected.length === 0) return

    const finalOptions = { ...options }

    if (videoSourceMode === 'local' && uploadedFile) {
      finalOptions.local_video_path = uploadedFile.local_video_path
      finalOptions.video_id = uploadedFile.video_id
    }

    onGenerate(selected, finalOptions)
  }

  const canGenerate = () => {
    if (isGenerating || selectedSegmentIds.length === 0) return false
    if (videoSourceMode === 'local' && !uploadedFile) return false
    if (videoSourceMode === 'url' && !youtubeUrl) return false
    if (renderLeft !== null && selectedSegmentIds.length > renderLeft) return false
    return true
  }

  const blockedReason =
    selectedSegmentIds.length === 0 ? 'Pilih minimal satu momen. Momen yang sudah tersimpan tidak perlu dirender lagi.' :
    videoSourceMode === 'local' && !uploadedFile
      ? (canUseYoutube ? 'Upload file videonya dulu, atau pilih unduh dari YouTube.' : 'Upload file videonya dulu.') :
    renderLeft === 0 ? 'Jatah pratinjau hari ini sudah habis. Coba lagi besok.' :
    renderLeft !== null && selectedSegmentIds.length > renderLeft ? `Sisa jatah pratinjau hari ini ${renderLeft} klip. Kurangi pilihan momen.` :
    null


  return (
    <section aria-labelledby="render-title" className="rounded-lg border border-rule glass">
      <div className="p-5 border-b border-rule">
        <h2 id="render-title" className="type-heading text-xl text-ink">Buat klip</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Momen dipotong jadi pratinjau 9:16 yang mengikuti pembicara. Caption, hook, efek, dan resolusi diatur di editor, lalu render final untuk mengunduh.
        </p>
        {clipsHref && (
          <Link href={clipsHref} className="mt-2 inline-block text-sm text-ink underline underline-offset-4 decoration-rule hover:decoration-ink-muted">
            Lihat klip tersimpan
          </Link>
        )}
      </div>

      {/* Sumber video */}
      <div className="p-5 border-b border-rule space-y-3">
        <h3 className="text-sm font-semibold text-ink">Video sumber</h3>
        {!canUseYoutube && (
          <p className="text-sm text-ink-muted">
            Upload file dari video YouTube yang sama
            {me?.upload_max_mb ? ` (maks ${me.upload_max_mb} MB, ${me.upload_max_minutes} menit)` : ''}.
          </p>
        )}
        {canUseYoutube && <div role="radiogroup" aria-label="Video sumber" className="grid grid-cols-2 rounded-md border border-rule p-0.5 text-sm">
          {([
            { id: 'local', label: 'File sendiri' },
            { id: 'url', label: 'Unduh dari YouTube' },
          ] as const).map(opt => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={videoSourceMode === opt.id}
              onClick={() => setVideoSourceMode(opt.id)}
              disabled={isGenerating}
              className={`h-8 rounded-[5px] font-semibold ${videoSourceMode === opt.id ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>}

        {videoSourceMode === 'local' ? (
          uploadedFile ? (
            <div className="flex items-center gap-3 rounded-md bg-raised px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{uploadedFile.filename}</p>
                <p className="text-xs text-ink-muted">{uploadedFile.file_size_mb} MB, siap dipakai</p>
              </div>
              <button
                type="button"
                onClick={() => { setUploadedFile(null); resetUpload() }}
                disabled={isGenerating}
                className="btn btn-sm text-ink-muted hover:text-ink px-2"
                aria-label="Ganti file video"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <>
              <div
                role="button"
                tabIndex={0}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && !isUploading && fileInputRef.current?.click()}
                className={`rounded-md border border-dashed px-4 py-5 text-center text-sm ${
                  isDragging ? 'border-signal bg-signal/5' : 'border-rule hover:border-ink-faint'
                }`}
              >
                {isUploading ? (
                  <div className="space-y-2">
                    <p className="text-ink">Mengupload… <span className="timecode">{uploadProgress}%</span></p>
                    <div className="h-1 rounded-full bg-rule overflow-hidden">
                      <div className="h-full bg-signal transition-[width] duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="text-ink-muted">
                    Seret file video ke sini, atau <span className="text-ink underline underline-offset-4">pilih file</span>
                  </p>
                )}
              </div>
              {uploadError && <p className="text-sm text-tally">{uploadError}</p>}
            </>
          )
        ) : (
          <p className="text-sm text-ink-muted break-all">
            {youtubeUrl ? <>Video diunduh otomatis dari <span className="text-ink">{youtubeUrl}</span></> : 'Belum ada link YouTube.'}
          </p>
        )}

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

      {/* Daftar momen */}
      <div className="p-5 border-b border-rule">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-ink">
            Momen <span className="timecode text-ink-muted font-normal">{selectedSegmentIds.length} dari {segments.length}</span>
          </h3>
          <button type="button" onClick={toggleAll} disabled={isGenerating} className="text-xs text-ink-muted hover:text-ink underline underline-offset-4 decoration-rule">
            {allSelected ? 'Kosongkan' : 'Pilih semua'}
          </button>
        </div>

        <ul className="thin-scroll mt-3 max-h-80 overflow-y-auto -mx-2 pr-1">
          {segments.map(seg => {
            const progress = progressMap[seg.segment_number]
            const checked = selectedSegmentIds.includes(seg.segment_number)
            const color = angleOf(seg.content_angle).color
            return (
              <li key={seg.segment_number} className="px-2 py-2 rounded-md hover:bg-raised/50">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelection(seg.segment_number)}
                    disabled={isGenerating}
                    className="mt-1 size-4 shrink-0 accent-signal"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2 text-sm">
                      <span className="timecode font-bold" style={{ color }}>{seg.segment_number}</span>
                      <span className="timecode text-ink-muted text-xs">{seg.start_time}–{seg.end_time}</span>
                    </span>
                    <span className="block truncate text-sm text-ink">{seg.topic}</span>
                  </span>
                </label>

                {progress && (
                  <div className="mt-2 pl-7">
                    <div className="flex justify-between text-xs">
                      <span className={progress.status === 'error' ? 'text-tally' : progress.status === 'done' ? 'text-sage' : 'text-ink-muted'}>
                        {STATUS_TEXT[progress.status] || progress.status}
                      </span>
                      {progress.status !== 'done' && progress.status !== 'error' && (
                        <span className="timecode text-ink-muted">{Math.round(progress.progress)}%</span>
                      )}
                    </div>
                    {progress.status !== 'done' && progress.status !== 'error' && (
                      <div className="mt-1 h-1 rounded-full bg-rule overflow-hidden">
                        <div className="h-full bg-signal transition-[width] duration-300" style={{ width: `${progress.progress}%` }} />
                      </div>
                    )}
                    {progress.status === 'done' && (
                      <div className="mt-2 flex gap-2">
                        <Link href={`/video/${videoId}/klip/edit?key=${encodeURIComponent(`${seg.start_time}-${seg.end_time}`)}`} className="btn btn-sm btn-primary">
                          <Pencil className="size-3.5" aria-hidden /> Edit &amp; unduh
                        </Link>
                      </div>
                    )}
                    {progress.status === 'error' && progress.error_message && (
                      <p className="mt-1 text-xs text-ink-muted break-words">{progress.error_message}</p>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="p-5">
        <button type="button" onClick={handleGenerate} disabled={!canGenerate()} className="btn btn-primary w-full h-11">
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Membuat pratinjau…
            </>
          ) : (
            `Buat pratinjau ${selectedSegmentIds.length} klip`
          )}
        </button>
        {!isGenerating && blockedReason && <p className="mt-2 text-xs text-ink-muted">{blockedReason}</p>}
        {renderLeft !== null && renderLeft > 0 && (
          <p className="mt-2 text-xs text-ink-muted">Sisa jatah pratinjau hari ini: {renderLeft} dari {me?.preview_daily_limit} klip.</p>
        )}
      </div>
    </section>
  )
}
