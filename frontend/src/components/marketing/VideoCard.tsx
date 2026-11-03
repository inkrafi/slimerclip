'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, X } from 'lucide-react'

interface Props {
  src: string
  poster?: string
  /** Nama video untuk tombol putar dan pembaca layar */
  label: string
  title?: string
  meta?: string
  /** Label kecil di atas video, mis. "Concept" */
  tag?: string
  aspect: 'portrait' | 'landscape'
  closeLabel: string
}

// Hanya satu pratinjau yang berputar dalam satu waktu
let activePreview: HTMLVideoElement | null = null

function playPreview(video: HTMLVideoElement | null) {
  if (!video) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (activePreview && activePreview !== video) activePreview.pause()
  activePreview = video
  video.play().catch(() => {})
}

/**
 * Kartu video: pratinjau tanpa suara saat hover/fokus (di layar sentuh saat terlihat), klik membuka pemutar dengan suara.
 * File baru dimuat saat kartu mendekati layar.
 */
export default function VideoCard({ src, poster, label, title, meta, tag, aspect, closeLabel }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [near, setNear] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const loader = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        setNear(true)
        loader.disconnect()
      }
    }, { rootMargin: '400px' })
    loader.observe(el)

    // Layar sentuh tidak punya hover: putar saat kartu terlihat jelas
    let inView: IntersectionObserver | undefined
    if (window.matchMedia('(hover: none)').matches) {
      inView = new IntersectionObserver(entries => {
        const video = videoRef.current
        for (const entry of entries) {
          if (entry.isIntersecting) playPreview(video)
          else video?.pause()
        }
      }, { threshold: 0.75 })
      inView.observe(el)
    }
    return () => {
      loader.disconnect()
      inView?.disconnect()
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) dialog.showModal()
  }, [open])

  const expand = () => {
    videoRef.current?.pause()
    setOpen(true)
  }

  return (
    <div ref={rootRef} className="work-card group">
      <button
        type="button"
        onClick={expand}
        onPointerEnter={e => { if (e.pointerType === 'mouse') playPreview(videoRef.current) }}
        onPointerLeave={e => { if (e.pointerType === 'mouse') videoRef.current?.pause() }}
        onFocus={() => playPreview(videoRef.current)}
        onBlur={() => videoRef.current?.pause()}
        aria-label={label}
        className={`work-frame relative block w-full overflow-hidden rounded-xl bg-black ${aspect === 'portrait' ? 'aspect-[9/16]' : 'aspect-video'}`}
      >
        <video
          ref={videoRef}
          src={near ? src : undefined}
          poster={poster}
          muted
          loop
          playsInline
          preload={poster ? 'none' : 'metadata'}
          tabIndex={-1}
          aria-hidden
          className="work-video absolute inset-0 size-full object-cover"
        />
        <span className="work-shade absolute inset-0" aria-hidden />
        {tag && <span className="absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-ink">{tag}</span>}
        <span className="work-play absolute left-1/2 top-1/2 flex size-14 items-center justify-center rounded-full bg-signal text-bay" aria-hidden>
          <Play className="size-5 fill-current" />
        </span>
      </button>
      {(title || meta) && (
        <div className="mt-3">
          {title && <p className="text-sm font-semibold text-ink line-clamp-2">{title}</p>}
          {meta && <p className="mt-0.5 text-xs text-ink-muted">{meta}</p>}
        </div>
      )}

      {open && (
        <dialog
          ref={dialogRef}
          aria-label={label}
          onClose={() => setOpen(false)}
          onClick={e => { if (e.target === dialogRef.current) dialogRef.current?.close() }}
          className="m-auto max-h-none max-w-none overflow-visible bg-transparent p-0 backdrop:bg-black/85"
        >
          <div className="relative">
            <button type="button" onClick={() => dialogRef.current?.close()} aria-label={closeLabel}
              className="absolute right-2 top-2 z-10 flex size-11 items-center justify-center rounded-full bg-black/70 text-ink hover:bg-black">
              <X className="size-5" aria-hidden />
            </button>
            <video
              src={src}
              poster={poster}
              controls
              autoPlay
              playsInline
              className={`block rounded-xl bg-black ${aspect === 'portrait' ? 'h-[min(88vh,calc(92vw*16/9))] w-auto' : 'h-auto w-[min(92vw,70rem)] max-h-[88vh]'}`}
            />
          </div>
        </dialog>
      )}
    </div>
  )
}
