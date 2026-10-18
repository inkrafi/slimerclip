'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { extractVideoId } from '@/lib/api'
import { toSeconds } from '@/lib/clip-meta'

interface Props {
  isOpen: boolean
  onClose: () => void
  youtubeUrl: string
  startTime: string
  endTime: string
}

export default function VideoPreviewModal({ isOpen, onClose, youtubeUrl, startTime, endTime }: Props) {
  const [isIframeLoaded, setIsIframeLoaded] = useState(false)
  const onCloseRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  // Reset status loading saat ditutup, agar klip berikutnya menampilkan spinner lagi
  const handleClose = () => {
    setIsIframeLoaded(false)
    onClose()
  }
  useEffect(() => { onCloseRef.current = handleClose })

  if (!isOpen) return null

  const videoId = extractVideoId(youtubeUrl) ?? ''
  const startSec = toSeconds(startTime)
  const endSec = toSeconds(endTime)
  const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${startSec}&end=${endSec}&autoplay=1&rel=0`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bay/90 animate-in fade-in duration-150"
    >
      {/* Klik di luar untuk menutup */}
      <div className="absolute inset-0" onClick={handleClose} aria-hidden />

      <div className="relative w-full max-w-4xl rounded-lg border border-rule glass overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 h-12 border-b border-rule">
          <h2 id="preview-title" className="text-sm text-ink">
            Momen <span className="timecode">{startTime}–{endTime}</span>
          </h2>
          <button type="button" onClick={handleClose} className="btn btn-sm text-ink-muted hover:text-ink px-2" aria-label="Tutup pratinjau">
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="relative w-full aspect-video bg-black">
          {!isIframeLoaded && videoId && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-ink-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Memuat video…
            </div>
          )}
          {videoId ? (
            <iframe
              src={embedUrl}
              title={`Pratinjau momen ${startTime} sampai ${endTime}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => setIsIframeLoaded(true)}
              className={`relative w-full h-full ${isIframeLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          ) : (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-tally">
              Pratinjau hanya tersedia untuk video YouTube.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
