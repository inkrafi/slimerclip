'use client'

import { useState } from 'react'
import { thumbUrl } from '@/hooks/useLandingMedia'

const HUES = [
  ['#ff5fa2', '#6c78ff'],
  ['#3dd6c6', '#b49bff'],
  ['#6cc8ff', '#ff9a76'],
  ['#b49bff', '#3dd6c6'],
]

/** Ilustrasi pengganti: dua orang ngobrol di meja podcast, diterangi lampu gel. */
export function StudioIllustration({ variant = 0, className = '' }: { variant?: number; className?: string }) {
  const [a, b] = HUES[variant % HUES.length]
  const id = `studio-${variant}`
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${id}-l`} cx="15%" cy="0%" r="80%">
          <stop offset="0" stopColor={a} stopOpacity="0.85" />
          <stop offset="1" stopColor={a} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-r`} cx="90%" cy="10%" r="80%">
          <stop offset="0" stopColor={b} stopOpacity="0.8" />
          <stop offset="1" stopColor={b} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="#231f55" />
      <rect width="320" height="180" fill={`url(#${id}-l)`} />
      <rect width="320" height="180" fill={`url(#${id}-r)`} />
      {/* Dua orang: kepala + bahu */}
      <g fill="#140f33" opacity="0.92">
        <circle cx="92" cy="78" r="20" />
        <path d="M52 150c4-30 20-46 40-46s36 16 40 46z" />
        <circle cx="230" cy="74" r="21" />
        <path d="M188 150c4-31 21-48 42-48s38 17 42 48z" />
      </g>
      {/* Mikrofon & meja */}
      <g stroke="#140f33" strokeWidth="5" strokeLinecap="round">
        <path d="M128 112l18-14" />
        <path d="M194 110l-18-14" />
      </g>
      <rect x="0" y="146" width="320" height="34" fill="#100c2a" />
    </svg>
  )
}

/** Thumbnail video YouTube (resolusi tinggi bila tersedia), atau ilustrasi jika tidak ada video. */
export default function StudioImage({ videoId, variant = 0, hd = false, className = '' }: {
  videoId?: string
  variant?: number
  hd?: boolean
  className?: string
}) {
  const [fallback, setFallback] = useState(false)
  if (!videoId) return <StudioIllustration variant={variant} className={className} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbUrl(videoId, hd && !fallback ? 'maxres' : 'mq')}
      alt=""
      loading="lazy"
      onError={() => setFallback(true)}
      onLoad={e => {
        // maxresdefault yang tidak tersedia dikirim YouTube sebagai gambar abu kecil 120x90
        if (hd && !fallback && e.currentTarget.naturalWidth <= 120) setFallback(true)
      }}
      className={`object-cover ${className}`}
    />
  )
}
