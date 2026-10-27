'use client'

import { useState } from 'react'
import { ASS_EM_SCALE, CAPTION_FONT_CSS } from '@/lib/caption-fonts'
import type { EditRecipe, MarkKind } from '@/lib/types'

// Sama dengan backend/clip_effects.py (satuan video 1080×1920)
const MARGIN_X = 54
const MARGIN_Y = 130
const STACK_GAP = 14
const TEXT_SCALE = 3.2
const LINE_HEIGHT = 1.3
const KINDS: MarkKind[] = ['logo', 'account', 'source']

/** Nilai dalam satuan video 1080 px → ukuran relatif terhadap lebar pratinjau. */
const u = (value: number) => `${(value / 10.8).toFixed(3)}cqw`
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Gradien CSS yang meniru PNG bayangan di backend (write_shade_png). */
function vignetteBackground(v: EditRecipe['vignette']): string {
  const alpha = 0.25 + 0.65 * v.strength / 100
  const ramp = (direction: string, reach: number) => {
    const stops = [0, 0.25, 0.5, 0.75, 1].map(f => `rgb(0 0 0 / ${(alpha * smooth(1 - f)).toFixed(3)}) ${(f * reach).toFixed(1)}%`)
    return `linear-gradient(${direction}, ${stops.join(', ')})`
  }
  if (v.shape === 'bottom') return ramp('to top', v.height)
  if (v.shape === 'top') return ramp('to bottom', v.height)
  if (v.shape === 'both') return `${ramp('to top', v.height / 2)}, ${ramp('to bottom', v.height / 2)}`
  return `radial-gradient(ellipse at center, transparent ${70 - v.strength * 0.4}%, rgb(0 0 0 / ${0.35 + v.strength * 0.005}) 100%)`
}

// Sama dengan HOOK_SHADE_* di backend/clip_effects.py
const HOOK_SHADE_HEIGHT = 70
const HOOK_SHADE_OUT = 0.5

/** Bayangan bawah yang tampil bersama hook lalu memudar (hook_shade_filter di backend). */
export function HookShade({ hook, time, end, clipEnd }: {
  hook: EditRecipe['hook']
  /** Detik sejak awal klip; Infinity = tampil penuh (saat hook sedang diatur) */
  time: number
  end: number
  clipEnd: number
}) {
  if (!hook.enabled || !hook.text.trim() || hook.shade <= 0 || time < 0 || time >= end) return null
  // Langsung tampil, memudar bersama teks hook
  const opacity = !Number.isFinite(time) || end >= clipEnd ? 1 : Math.min(1, (end - time) / HOOK_SHADE_OUT)
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden
      style={{ opacity, background: vignetteBackground({ shape: 'bottom', strength: hook.shade, height: HOOK_SHADE_HEIGHT }) }} />
  )
}

export function VignettePreview({ vignette }: { vignette: EditRecipe['vignette'] }) {
  if (vignette.strength <= 0) return null
  return <div className="pointer-events-none absolute inset-0" style={{ background: vignetteBackground(vignette) }} aria-hidden />
}

/** Logo, teks akun, dan teks sumber; yang posisinya sama ditumpuk dari tepi ke dalam (seperti marks_layout). */
export function MarksPreview({ marks, logoUrl }: { marks: EditRecipe['marks']; logoUrl?: string }) {
  const [aspect, setAspect] = useState<{ url: string; value: number } | null>(null)
  const logoAspect = aspect && aspect.url === logoUrl ? aspect.value : null
  const cursor: Record<string, number> = {}
  const items: React.ReactNode[] = []

  for (const kind of KINDS) {
    const mark = marks[kind]
    if (!mark.enabled || (kind === 'logo' ? !logoUrl : !mark.text)) continue
    const pos = mark.position
    const offset = cursor[pos] ?? MARGIN_Y
    const style: React.CSSProperties = {
      position: 'absolute',
      opacity: mark.opacity / 100,
      ...(pos.endsWith('c') ? { left: '50%', transform: 'translateX(-50%)' } : { [pos.endsWith('l') ? 'left' : 'right']: u(MARGIN_X) }),
      [pos.startsWith('t') ? 'top' : 'bottom']: u(offset),
    }
    if (kind === 'logo') {
      const width = 1080 * mark.size / 100
      items.push(
        // eslint-disable-next-line @next/next/no-img-element -- aset dari backend dengan URL bertanda tangan
        <img key={kind} src={logoUrl} alt="" style={{ ...style, width: u(width) }}
          onLoad={e => setAspect({ url: logoUrl!, value: e.currentTarget.naturalHeight / e.currentTarget.naturalWidth })} />,
      )
      if (logoAspect === null) continue  // tinggi logo belum diketahui: teks di posisi yang sama menunggu
      cursor[pos] = offset + width * logoAspect + STACK_GAP
    } else {
      const size = mark.size * TEXT_SCALE
      items.push(
        <span key={kind} className="whitespace-nowrap text-white" style={{
          ...style, ...CAPTION_FONT_CSS['poppins-semibold'], fontSize: u(size * ASS_EM_SCALE['poppins-semibold']), lineHeight: `${u(size * LINE_HEIGHT)}`,
          textShadow: `0 ${u(2)} ${u(3)} rgb(0 0 0 / 0.6)`,
        }}>
          {mark.text}
        </span>,
      )
      cursor[pos] = offset + size * LINE_HEIGHT + STACK_GAP
    }
  }
  return <div className="pointer-events-none absolute inset-0" aria-hidden>{items}</div>
}
