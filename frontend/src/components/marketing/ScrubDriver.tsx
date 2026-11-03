'use client'

import { useEffect, useRef } from 'react'

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))

/**
 * Menggerakkan hero: posisi scroll → --p (0 sampai 1) yang dipakai CSS (.scrub-*).
 * Nilai diperhalus, loop berhenti saat sudah sampai, dan DOM hanya ditulis saat nilainya berubah.
 * Di layar sempit, layar pendek, dan reduced motion, CSS menyembunyikan hero ini dan driver tidak berjalan.
 */
export default function ScrubDriver({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const media = window.matchMedia('(min-width: 768px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)')
    const bands = [...root.querySelectorAll<HTMLElement>('[data-band]')]
    const clock = root.querySelector<HTMLElement>('[data-clock]')
    let current = -1
    let target = 0
    let raf = 0
    let last = 0
    let lastText = ''

    const write = (p: number) => {
      root.style.setProperty('--p', p.toFixed(4))
      for (const band of bands) {
        const visible = p > Number(band.dataset.from) && p < Number(band.dataset.to)
        const next = visible ? 'visible' : 'hidden'
        if (band.style.visibility !== next) band.style.visibility = next
      }
      if (clock) {
        // Podcast contoh 2 jam; playhead berhenti di puncak tonton ulang
        const seconds = Math.round(clamp((p - 0.08) / 0.3) * 0.645 * 7200)
        const text = [seconds / 3600, (seconds % 3600) / 60, seconds % 60].map(n => String(Math.floor(n)).padStart(2, '0')).join(':')
        if (text !== lastText) clock.textContent = lastText = text
      }
    }

    const tick = (now: number) => {
      const dt = last ? Math.min(now - last, 64) : 16
      last = now
      const next = current < 0 ? target : current + (target - current) * (1 - Math.exp(-dt / 45))
      const done = Math.abs(target - next) < 0.0004
      current = done ? target : next
      write(current)
      if (done) {
        raf = 0
        last = 0
      } else {
        raf = requestAnimationFrame(tick)
      }
    }

    const measure = () => {
      if (!media.matches) return
      const rect = root.getBoundingClientRect()
      target = clamp(-rect.top / Math.max(1, rect.height - window.innerHeight))
      if (!raf) raf = requestAnimationFrame(tick)
    }

    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    media.addEventListener('change', measure)
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      media.removeEventListener('change', measure)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return <div ref={ref} className="scrub">{children}</div>
}
