import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Loader2, Play, X } from 'lucide-react'
import { ClipGenerateOptions, ClipProgress, Me, Segment, UploadedFileInfo } from '@/lib/types'
import { useVideoUpload } from '@/hooks/useVideoUpload'
import { angleOf } from '@/lib/clip-meta'
import CaptionStyleEditor from '@/components/CaptionStyleEditor'
import { downloadUrl, extractVideoId } from '@/lib/api'
import { loadCaptionStyle, saveCaptionStyle } from '@/lib/caption-presets'
import { AUTH_ENABLED } from '@/lib/supabase'

interface ClipGeneratorPanelProps {
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
  done: 'Tersimpan',
  error: 'Gagal',
}

export default function ClipGeneratorPanel({
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

  // Sisa jatah render hari ini, dikurangi momen yang sedang antre/dirender (null = tanpa batas)
  const activeCount = Object.values(progressMap).filter(p => p.status !== 'done' && p.status !== 'error').length
  const renderLeft = me && me.render_daily_limit != null
    ? Math.max(0, me.render_daily_limit - (me.renders_today ?? 0) - activeCount)
    : null

  // Momen yang sudah tersimpan atau sedang dirender tidak dicentang otomatis, agar tidak dirender dua kali;
  // jika ada jatah harian, hanya momen teratas sebanyak sisa jatah
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<number[]>(() =>
    segments
      .filter(s => !progressMap[s.segment_number] || progressMap[s.segment_number].status === 'error')
      .map(s => s.segment_number)
      .slice(0, renderLeft ?? undefined)
  )

  const [options, setOptions] = useState<ClipGenerateOptions>({
    resolution: '1080',
    caption_enabled: true,
    smart_tracking: true,
    split_screen: true,
    format: 'mp4',
    // Gaya caption terakhir yang dipakai di browser ini
    caption_style: loadCaptionStyle(),
  })
  useEffect(() => { saveCaptionStyle(options.caption_style) }, [options.caption_style])

  // Pratinjau caption memakai kutipan momen terkuat di atas thumbnail video
  const sampleWords = (segments.find(s => s.speaker_quote)?.speaker_quote || segments[0]?.topic || 'Momen terbaik dari podcast ini')
    .replace(/["“”]/g, '').split(/\s+/).filter(Boolean).slice(0, 12)
  const ytId = extractVideoId(youtubeUrl)
  const previewBackground = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined

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
    renderLeft === 0 ? 'Jatah render hari ini sudah habis. Coba lagi besok.' :
    renderLeft !== null && selectedSegmentIds.length > renderLeft ? `Sisa jatah render hari ini ${renderLeft} klip. Kurangi pilihan momen.` :
    null


  return (
    <section aria-labelledby="render-title" className="rounded-lg border border-rule glass">
      <div className="p-5 border-b border-rule">
        <h2 id="render-title" className="type-heading text-xl text-ink">Render klip</h2>
        <p className="mt-1 text-sm text-ink-muted">Video 9:16 dengan caption otomatis. Hasilnya tersimpan, tidak perlu render ulang.</p>
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
              className={`h-8 rounded-[5px] font-medium ${videoSourceMode === opt.id ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>}

        {videoSourceMode === 'local' ? (
          uploadedFile ? (
            <div className="flex items-center gap-3 rounded-md bg-raised px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{uploadedFile.filename}</p>
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
                    {progress.status === 'done' && progress.url && (
                      <div className="mt-2 flex gap-2">
                        <a href={progress.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-quiet">
                          <Play className="size-3.5" aria-hidden /> Putar
                        </a>
                        <a href={downloadUrl(progress.url)} download className="btn btn-sm btn-primary">
                          <Download className="size-3.5" aria-hidden /> Unduh
                        </a>
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

      {/* Caption */}
      <div className="p-5 border-b border-rule space-y-3">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink">Caption otomatis</span>
          <input
            type="checkbox"
            checked={options.caption_enabled}
            onChange={e => setOptions({ ...options, caption_enabled: e.target.checked })}
            disabled={isGenerating}
            className="size-4 accent-signal"
          />
        </label>
        {options.caption_enabled && (
          <CaptionStyleEditor
            value={options.caption_style}
            onChange={caption_style => setOptions(o => ({ ...o, caption_style }))}
            disabled={isGenerating}
            sampleWords={sampleWords}
            backgroundUrl={previewBackground}
          />
        )}
      </div>

      {/* Pengaturan */}
      <details className="group border-b border-rule">
        <summary className="flex items-center justify-between px-5 py-4 text-sm font-semibold text-ink cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          Pengaturan render
          <span className="text-xs font-normal text-ink-muted group-open:hidden">
            {options.resolution}p, {options.smart_tracking ? 'ikuti pembicara' : 'potong tengah'}
          </span>
        </summary>
        <div className="px-5 pb-5 space-y-4 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Resolusi</span>
            <select
              className="rounded-md border border-rule bg-bay px-2 h-8 text-ink"
              value={options.resolution}
              onChange={e => setOptions({ ...options, resolution: e.target.value as '1080' | '720' })}
              disabled={isGenerating}
            >
              <option value="1080">1080 × 1920</option>
              <option value="720">720 × 1280</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Ikuti pembicara</span>
            <input
              type="checkbox"
              checked={options.smart_tracking}
              onChange={e => setOptions({ ...options, smart_tracking: e.target.checked })}
              disabled={isGenerating}
              className="size-4 accent-signal"
            />
          </label>
          {options.smart_tracking && (
            <label className="flex items-center justify-between gap-3">
              <span className="text-ink-muted">Layar terbagi saat dua orang bicara</span>
              <input
                type="checkbox"
                checked={options.split_screen}
                onChange={e => setOptions({ ...options, split_screen: e.target.checked })}
                disabled={isGenerating}
                className="size-4 accent-signal"
              />
            </label>
          )}
        </div>
      </details>

      <div className="p-5">
        <button type="button" onClick={handleGenerate} disabled={!canGenerate()} className="btn btn-primary w-full h-11">
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Merender…
            </>
          ) : (
            `Render ${selectedSegmentIds.length} klip`
          )}
        </button>
        {!isGenerating && blockedReason && <p className="mt-2 text-xs text-ink-muted">{blockedReason}</p>}
        {renderLeft !== null && renderLeft > 0 && (
          <p className="mt-2 text-xs text-ink-muted">Sisa jatah render hari ini: {renderLeft} dari {me?.render_daily_limit} klip.</p>
        )}
      </div>
    </section>
  )
}
