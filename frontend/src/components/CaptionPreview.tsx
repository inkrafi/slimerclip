'use client'

import { useEffect, useState } from 'react'
import { CAPTION_FONT_CSS } from '@/lib/caption-fonts'
import type { CaptionStyle } from '@/lib/caption-presets'

/** Nilai dalam satuan video 1080 px → ukuran relatif terhadap lebar pratinjau. */
const u = (value: number) => `${(value / 10.8).toFixed(3)}cqw`

interface Props {
  style: CaptionStyle
  /** Kata contoh, mis. kutipan dari momen terkuat */
  words: string[]
  /** Gambar latar (thumbnail video) */
  backgroundUrl?: string
  className?: string
}

/** Pratinjau caption 9:16 yang meniru hasil render: halaman kata, sorotan kata aktif, efek pop. */
export default function CaptionPreview({ style, words, backgroundUrl, className = '' }: Props) {
  const [active, setActive] = useState(1)
  const count = words.length

  useEffect(() => {
    if (count < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setActive(i => (i + 1) % count), 450)
    return () => clearInterval(timer)
  }, [count])

  const index = count ? active % count : 0
  const perPage = Math.max(1, style.words_per_line)
  const pageStart = Math.floor(index / perPage) * perPage
  const page = words.slice(pageStart, pageStart + perPage)
  const font = CAPTION_FONT_CSS[style.font]

  const textStyle: React.CSSProperties = {
    ...font,
    fontSize: u(style.size),
    lineHeight: 1.15,
    color: style.color,
    textTransform: style.uppercase ? 'uppercase' : 'none',
    WebkitTextStroke: !style.background && style.outline_width ? `${u(style.outline_width * 2)} ${style.outline_color}` : undefined,
    paintOrder: 'stroke fill',
    textShadow: !style.background && style.shadow ? `0 ${u(style.shadow)} ${u(style.shadow)} rgb(0 0 0 / 0.55)` : undefined,
  }

  return (
    <div
      className={`relative aspect-[9/16] overflow-hidden rounded-lg border border-rule bg-[#0d0a24] ${className}`}
      style={{ containerType: 'inline-size' }}
      aria-hidden
    >
      {backgroundUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- thumbnail YouTube dari domain luar
        <img src={backgroundUrl} alt="" className="absolute inset-0 size-full object-cover opacity-70" />
      )}
      <div
        className="absolute inset-x-[7%] text-center -translate-y-1/2"
        style={{ top: `${style.position_y}%` }}
      >
        <span
          className="inline"
          style={{
            ...textStyle,
            ...(style.background && {
              background: 'rgb(0 0 0 / 0.75)',
              padding: `${u(style.size * 0.12)} ${u(style.size * 0.25)}`,
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone',
            }),
          }}
        >
          {page.map((word, i) => {
            const isActive = pageStart + i === index && style.highlight_style !== 'none'
            const pop = pageStart + i === index && style.animation === 'pop'
            return (
              <span key={`${pageStart}-${i}`}>
                {i > 0 && ' '}
                <span
                  className="inline-block transition-transform duration-100"
                  style={{
                    transform: pop ? 'scale(1.1)' : 'none',
                    ...(isActive && style.highlight_style === 'color' && { color: style.highlight_color }),
                    ...(isActive && style.highlight_style === 'box' && {
                      background: style.highlight_color,
                      borderRadius: u(style.size * 0.18),
                      padding: `0 ${u(style.size * 0.15)}`,
                      margin: `0 ${u(style.size * 0.08)}`,
                      WebkitTextStroke: undefined,
                      textShadow: 'none',
                    }),
                  }}
                >
                  {word}
                </span>
              </span>
            )
          })}
        </span>
      </div>
    </div>
  )
}
