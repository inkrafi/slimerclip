'use client'

import { useId } from 'react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  /** Label kata kerja (sentence case): jadi aria-label sekaligus teks tooltip, mis. "Hapus link" */
  label: string
  icon: LucideIcon
  onClick?: () => void
  href?: string
  external?: boolean
  disabled?: boolean
  tone?: 'default' | 'danger'
  spin?: boolean
}

/**
 * Tombol ikon persegi dengan tooltip sungguhan (muncul saat hover & fokus keyboard, bukan atribut title).
 * Ukuran 36px, 44px di layar sentuh (lihat .icon-btn di globals.css).
 */
export default function IconButton({ label, icon: Icon, onClick, href, external, disabled, tone = 'default', spin }: Props) {
  const tipId = useId()
  const className = `icon-btn ${tone === 'danger' ? 'hover:text-tally' : ''}`
  const glyph = <Icon className={`size-4 ${spin ? 'animate-spin' : ''}`} aria-hidden />
  return (
    <span className="tip-wrap">
      {href ? (
        <a href={href} aria-label={label} aria-describedby={tipId} className={className}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {glyph}
        </a>
      ) : (
        <button type="button" aria-label={label} aria-describedby={tipId} onClick={onClick} disabled={disabled} className={className}>
          {glyph}
        </button>
      )}
      <span role="tooltip" id={tipId} className="tip">{label}</span>
    </span>
  )
}
