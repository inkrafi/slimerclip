'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Avatar from '@/components/Avatar'
import { Me } from '@/lib/types'

/** Ringkasan jatah untuk menu akun. */
function quotaLine(me: Me) {
  if (me.is_admin) return 'Admin, tanpa batas'
  if (me.has_gemini_key) return 'Analisis memakai API key milikmu'
  return `${me.free_analyses_left ?? 0} dari ${me.free_analyses_limit ?? 0} analisis gratis tersisa`
}

export default function AccountMenu() {
  const { enabled, ready, session, me, signOut } = useAuth()
  const pathname = usePathname() || '/'
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!enabled || !ready) return null

  if (!session) {
    const onAuthPage = ['/masuk', '/daftar', '/lupa-sandi', '/atur-sandi', '/auth'].some(p => pathname.startsWith(p))
    const next = encodeURIComponent(pathname === '/' || onAuthPage ? '/riwayat' : pathname)
    return (
      <div className="flex items-center gap-1">
        <Link href={`/masuk?next=${next}`} className="btn btn-sm text-ink-muted hover:text-ink">Masuk</Link>
        <Link href={`/daftar?next=${next}`} className="btn btn-sm btn-primary">Coba gratis</Link>
      </div>
    )
  }

  if (!me) return <span className="size-8 rounded-full bg-raised" aria-hidden />

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Akun ${me.name}`}
        className="flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      >
        <Avatar me={me} size="size-8" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-rule bg-[#2a2660] shadow-[0_20px_50px_-15px_rgb(0_0_0/0.6)] overflow-hidden">
          <div className="px-4 py-3 border-b border-rule">
            <p className="font-semibold text-ink truncate">{me.name}</p>
            <p className="text-sm text-ink-muted truncate">{me.email}</p>
            <p className="mt-2 text-xs text-ink-muted">{quotaLine(me)}</p>
          </div>
          <Link href="/pengaturan" role="menuitem" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-ink hover:bg-raised">
            Pengaturan
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); signOut().then(() => router.replace('/')) }}
            className="block w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-raised"
          >
            Keluar
          </button>
        </div>
      )}
    </div>
  )
}
