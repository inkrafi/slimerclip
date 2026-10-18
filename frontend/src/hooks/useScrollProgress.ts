import { useEffect, useRef } from 'react'

/**
 * Menulis progres scroll sebuah elemen ke variabel CSS `--p` (0 → 1) tanpa re-render React.
 *
 * mode "pass":   0 saat elemen mulai masuk dari bawah layar, 1 saat sudah keluar di atas (parallax).
 * mode "sticky": 0 saat bagian atas elemen menyentuh atas layar, 1 saat bagian bawahnya tiba
 *                di bawah layar (untuk adegan sticky yang berubah selama di-scroll).
 * Jika pengguna memilih reduced motion, `--p` dikunci di nilai `reducedValue`.
 */
export function useScrollProgress<T extends HTMLElement>(mode: 'pass' | 'sticky' = 'pass', reducedValue = 0) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--p', String(reducedValue))
      return
    }

    let frame = 0
    const update = () => {
      frame = 0
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      const raw = mode === 'sticky'
        ? -rect.top / Math.max(1, rect.height - vh)
        : (vh - rect.top) / (rect.height + vh)
      el.style.setProperty('--p', Math.min(1, Math.max(0, raw)).toFixed(4))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [mode, reducedValue])

  return ref
}
