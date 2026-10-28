'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Toaster } from 'sonner'
import AccountMenu from '@/components/AccountMenu'
import { useAuth } from '@/components/AuthProvider'
import { LanguageSwitch, useCopy } from '@/components/LocaleProvider'
import RenderIndicator from '@/components/RenderIndicator'
import { syne } from '@/lib/fonts'

const isLongform = (p: string) => p.startsWith('/longform') || /^\/video\/[^/]+\/longform/.test(p)

const NAV = [
  { href: '/', key: 'workspace', match: (p: string) => p === '/' || (p.startsWith('/video') && !isLongform(p)), wide: true, admin: false },
  { href: '/jasa', key: 'service', match: (p: string) => p.startsWith('/jasa'), wide: true, admin: false },
  { href: '/longform', key: 'longform', match: isLongform, wide: false, admin: true },
  { href: '/laporan', key: 'reports', match: (p: string) => p.startsWith('/laporan'), wide: true, admin: true },
  { href: '/riwayat', key: 'history', match: (p: string) => p.startsWith('/riwayat'), wide: false, admin: false },
] as const

const COPY = {
  id: { workspace: 'Ruang kerja', service: 'Jasa clipping', longform: 'Video panjang', reports: 'Laporan', history: 'Riwayat', home: 'SlimerClip, ke halaman awal', nav: 'Navigasi utama', openMenu: 'Buka menu', closeMenu: 'Tutup menu', signIn: 'Masuk' },
  en: { workspace: 'Workspace', service: 'Clipping service', longform: 'Long videos', reports: 'Reports', history: 'History', home: 'SlimerClip, go to home', nav: 'Main navigation', openMenu: 'Open menu', closeMenu: 'Close menu', signIn: 'Sign in' },
}

export default function SiteHeader() {
  const pathname = usePathname() || '/'
  const { me, enabled, signedIn } = useAuth()
  const t = useCopy(COPY)
  // Halaman klien (review /r/..., laporan /lapor/...): tanpa menu aplikasi & akun, cukup logo dan pilihan bahasa
  const clientView = pathname.startsWith('/r/') || pathname.startsWith('/lapor/')
  const items = NAV.filter(item => !item.admin || me?.is_admin)
  // Layar sempit: menu dilipat ke tombol (Esc menutup)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <>
      <Toaster
        position="bottom-center"
        theme="dark"
        toastOptions={{
          style: { background: '#2a2660', border: '1px solid var(--color-rule)', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)' },
        }}
      />
      <header className="print:hidden sticky top-0 z-40 border-b border-rule bg-bay/55 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-6">
          <Link href="/" className="flex items-center gap-2.5 text-ink" aria-label={t.home}>
            <Image src="/logo-mark.png" alt="" width={32} height={32} priority className="size-8" />
            <span className={`${syne.className} text-xl leading-none tracking-[-0.02em]`}>SlimerClip</span>
          </Link>
          {clientView ? <LanguageSwitch /> : (
          <div className="flex items-center gap-2 sm:gap-3">
          <RenderIndicator />
          <nav aria-label={t.nav} className="flex items-center gap-1 text-sm">
            {items.map(item => {
              const active = item.match(pathname)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`hidden sm:flex h-14 px-3 items-center border-b-2 -mb-px ${active ? 'border-signal text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}
                >
                  {t[item.key]}
                </Link>
              )
            })}
          </nav>
          <LanguageSwitch className="hidden sm:block" />
          <AccountMenu />
          <span className="sm:hidden">
          <span className="tip-wrap">
            <button type="button" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-controls="mobile-menu"
              aria-label={menuOpen ? t.closeMenu : t.openMenu} aria-describedby="menu-tip" className="icon-btn">
              {menuOpen ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
            </button>
            <span role="tooltip" id="menu-tip" className="tip" style={{ top: 'calc(100% + 0.5rem)', bottom: 'auto', left: 'auto', right: 0, transform: 'none' }}>{menuOpen ? t.closeMenu : t.openMenu}</span>
          </span>
          </span>
          </div>
          )}
        </div>
        {menuOpen && !clientView && (
          <nav id="mobile-menu" aria-label={t.nav} className="sm:hidden border-t border-rule bg-bay px-4 pb-4">
            <ul className="divide-y divide-rule">
              {items.map(item => (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setMenuOpen(false)} aria-current={item.match(pathname) ? 'page' : undefined}
                    className={`flex h-12 items-center ${item.match(pathname) ? 'text-ink font-semibold' : 'text-ink-muted'}`}>
                    {t[item.key]}
                  </Link>
                </li>
              ))}
              {/* "Masuk" dilipat ke menu di layar sempit agar header tidak melebar */}
              {enabled && !signedIn && (
                <li>
                  <Link href={`/masuk?next=${encodeURIComponent(pathname)}`} onClick={() => setMenuOpen(false)} className="flex h-12 items-center text-ink-muted">
                    {t.signIn}
                  </Link>
                </li>
              )}
            </ul>
            <LanguageSwitch className="mt-2 tap" />
          </nav>
        )}
      </header>
    </>
  )
}
