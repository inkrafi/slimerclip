'use client'

import { useRef } from 'react'
import { CaptionPage } from '@/components/CaptionPreview'
import { ASS_EM_SCALE, CAPTION_FONT_CSS } from '@/lib/caption-fonts'
import type { CaptionStyle } from '@/lib/caption-presets'
import type { HookSettings, TranscriptSegment } from '@/lib/types'

/** Nilai dalam satuan video 1080 px → ukuran relatif terhadap lebar pratinjau. */
const u = (value: number) => `${(value / 10.8).toFixed(3)}cqw`

// Sama dengan backend (caption_service.py)
const PAGE_GAP_SECONDS = 0.7

interface CaptionWord { start: number; end: number; text: string; stop: boolean; segment: number }

/** Kata-kata caption di rentang klip, dikelompokkan per halaman seperti CaptionService._pages. */
function captionPages(segments: TranscriptSegment[], range: [number, number], perPage: number): CaptionWord[][] {
  const words: CaptionWord[] = []
  segments.forEach((seg, segment) => {
    for (const w of seg.words) {
      if (w.start < range[0] - 0.05 || w.end > range[1] + 0.05) continue
      const raw = w.word.trim()
      const text = raw.replace(/[.,;:]+$/, '')
      if (text) words.push({ start: w.start, end: w.end, text, stop: /[.?!]$/.test(raw), segment })
    }
  })
  const pages: CaptionWord[][] = []
  let page: CaptionWord[] = []
  for (const w of words) {
    const last = page[page.length - 1]
    if (last && (page.length >= perPage || last.stop || w.start - last.end > PAGE_GAP_SECONDS)) {
      pages.push(page)
      page = []
    }
    page.push(w)
  }
  if (page.length) pages.push(page)
  return pages
}

interface DragProps {
  /** Posisi (% tinggi video) */
  y: number
  min: number
  max: number
  /** "center": y = tengah elemen (caption); "top": y = tepi atas (hook) */
  anchor: 'center' | 'top'
  label: string
  inset: string
  onChange: (y: number) => void
  onTap?: () => void
  children: React.ReactNode
}

/** Elemen di atas video yang bisa digeser naik-turun; klik tanpa geser memanggil onTap. */
function DragY({ y, min, max, anchor, label, inset, onChange, onTap, children }: DragProps) {
  const drag = useRef<{ startY: number; startValue: number; height: number; moved: boolean } | null>(null)

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(y)}
      title="Geser untuk memindahkan, klik untuk mengedit"
      className={`absolute touch-none select-none cursor-grab active:cursor-grabbing rounded-sm outline-1 outline-dashed outline-transparent hover:outline-white/60 focus-visible:outline-white text-center ${anchor === 'center' ? '-translate-y-1/2' : ''}`}
      style={{ top: `${y}%`, left: inset, right: inset }}
      onPointerDown={e => {
        const height = e.currentTarget.parentElement?.getBoundingClientRect().height ?? 1
        drag.current = { startY: e.clientY, startValue: y, height, moved: false }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={e => {
        const d = drag.current
        if (!d) return
        const dy = e.clientY - d.startY
        if (Math.abs(dy) > 3) d.moved = true
        if (d.moved) onChange(Math.round(Math.min(max, Math.max(min, d.startValue + (dy / d.height) * 100))))
      }}
      onPointerUp={() => {
        if (drag.current && !drag.current.moved) onTap?.()
        drag.current = null
      }}
      onKeyDown={e => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          onChange(Math.min(max, Math.max(min, y + (e.key === 'ArrowUp' ? -1 : 1))))
        } else if (e.key === 'Enter') onTap?.()
      }}
    >
      {children}
    </div>
  )
}

interface LiveCaptionProps {
  segments: TranscriptSegment[]
  style: CaptionStyle
  /** Waktu pemutar (detik video sumber) */
  time: number | null
  range: [number, number]
  onMove: (positionY: number) => void
  /** Kalimat (indeks segmen transkrip) yang diklik, untuk diedit */
  onPick: (segment: number) => void
}

/** Caption yang tampil sesuai waktu video, persis seperti nanti dirender. */
export function LiveCaption({ segments, style, time, range, onMove, onPick }: LiveCaptionProps) {
  if (time === null) return null
  const pages = captionPages(segments, range, Math.max(1, style.words_per_line))
  const index = pages.findIndex((page, i) => {
    const next = pages[i + 1]?.[0].start
    const last = page[page.length - 1]
    const end = next !== undefined ? Math.max(last.end, Math.min(last.end + 0.3, next)) : last.end + 0.3
    return time >= page[0].start && time < end
  })
  if (index < 0) return null
  const page = pages[index]
  let active = 0
  page.forEach((w, i) => { if (w.start <= time) active = i })

  return (
    <DragY y={style.position_y} min={10} max={90} anchor="center" label="Posisi caption" inset="7%"
      onChange={onMove} onTap={() => onPick(page[active].segment)}>
      <CaptionPage style={style} words={page.map(w => w.text)} active={active} />
    </DragY>
  )
}

/** Hook di atas video, sama dengan hook_ass di backend (satuan 1080×1920). */
export function HookOverlay({ hook, visible, onMove, onTap }: {
  hook: HookSettings
  visible: boolean
  onMove: (positionY: number) => void
  onTap: () => void
}) {
  if (!hook.enabled || !hook.text.trim() || !visible) return null
  const pad = Math.max(12, Math.round(hook.size * 0.28))
  const boxed = hook.style !== 'outline'
  const colors = {
    light: { color: '#141414', background: '#ffffff' },
    dark: { color: '#ffffff', background: 'rgb(0 0 0 / 0.9)' },
    outline: { color: '#ffffff', background: 'transparent' },
  }[hook.style]
  const bord = Math.max(4, Math.floor(hook.size / 14))

  return (
    <DragY y={hook.position_y} min={5} max={80} anchor="top" label="Posisi hook" inset={u(90)} onChange={onMove} onTap={onTap}>
      <div style={{ paddingTop: boxed ? u(pad) : 0 }}>
        <span
          style={{
            ...CAPTION_FONT_CSS[hook.font],
            ...colors,
            fontSize: u(hook.size * ASS_EM_SCALE[hook.font]),
            lineHeight: u(hook.size),
            whiteSpace: 'pre-line',
            padding: boxed ? `${u(pad)} ${u(pad)}` : 0,
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone',
            WebkitTextStroke: boxed ? undefined : `${u(bord * 2)} #000`,
            paintOrder: 'stroke fill',
            textShadow: boxed ? undefined : `0 ${u(3)} ${u(3)} rgb(0 0 0 / 0.6)`,
          }}
        >
          {hook.text.trim()}
        </span>
      </div>
    </DragY>
  )
}
