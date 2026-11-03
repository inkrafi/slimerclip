'use client'

import { useEffect, useRef } from 'react'

interface Props {
  children: React.ReactNode
  /** Jeda muncul dalam ms, untuk urutan berjenjang */
  delay?: number
  className?: string
}

/** Muncul saat masuk layar (sekali saja). Tanpa JavaScript atau dengan reduced motion, isi langsung terlihat. */
export default function Reveal({ children, delay = 0, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        el.classList.add('is-in')
        observer.disconnect()
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return <div ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>{children}</div>
}
