'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Toaster } from 'sonner'
import AccountMenu from '@/components/AccountMenu'
import { useAuth } from '@/components/AuthProvider'
import { useCopy } from '@/components/LocaleProvider'
import RenderIndicator from '@/components/RenderIndicator'
import { syne } from '@/lib/fonts'
import { ADMIN_HOME, hasContactBand, isAuthPath, isClientPath, isPublicPath } from '@/lib/routes'

const isVideoProject = (p: string) => p.startsWith('/proyek-video') || /^\/video\/[^/]+\/longform/.test(p)

/** Ruang kerja admin: semua fitur produksi. Selalu berbahasa Indonesia. */
const ADMIN_NAV = [
  { href: ADMIN_HOME, label: 'Ruang kerja', match: (p: string) => p === ADMIN_HOME || (p.startsWith('/video') && !isVideoProject(p)) },
  { href: '/proyek-video', label: 'Proyek video', match: isVideoProject },
  { href: '/proyek-motion', label: 'Proyek motion', match: (p: string) => p.startsWith('/proyek-motion') },
  { href: '/laporan', label: 'Laporan', match: (p: string) => p.startsWith('/laporan') },
  { href: '/riwayat', label: 'Riwayat', match: (p: string) => p.startsWith('/riwayat') },
]

const COPY = {
  id: { clipping: 'Jasa clipping', motion: 'Motion video', cta: 'Konsultasi gratis', home: 'SlimerClip, ke halaman awal', nav: 'Navigasi utama', openMenu: 'Buka menu', closeMenu: 'Tutup menu' },
  en: { clipping: 'Podcast clipping', motion: 'Motion video', cta: 'Free consultation', home: 'SlimerClip, go to home', nav: 'Main navigation', openMenu: 'Open menu', closeMenu: 'Close menu' },
}

export default function SiteHeader() {
  const pathname = usePathname() || '/'
  const { me } = useAuth()
  const t = useCopy(COPY)
  const isPublic = isPublicPath(pathname)
  const bare = isClientPath(pathname) || isAuthPath(pathname)
  const ctaHref = hasContactBand(pathname) ? '#konsultasi' : '/#konsultasi'
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const items = isPublic
    ? [
        { href: '/clipping', label: t.clipping, match: (p: string) => p === '/clipping' },
        { href: '/motion', label: t.motion, match: (p: string) => p === '/motion' },
        // Hanya terlihat oleh admin yang sudah login
        ...(me?.is_admin ? [{ href: ADMIN_HOME, label: 'Ruang kerja', match: () => false }] : []),
      ]
    : ADMIN_NAV

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
          <Link href={isPublic || bare ? '/' : ADMIN_HOME} className="flex min-h-11 items-center gap-2.5 text-ink" aria-label={t.home}>
            <Image src="/logo-mark.png" alt="" width={32} height={32} priority className="size-8" />
            <span className={`${syne.className} text-xl leading-none tracking-[-0.02em]`}>SlimerClip</span>
          </Link>
          {!bare && (
            <div className="flex items-center gap-2 sm:gap-3">
              {!isPublic && <RenderIndicator />}
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
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
              {isPublic
                ? <a href={ctaHref} className="btn btn-sm btn-primary hidden h-9 sm:inline-flex">{t.cta}</a>
                : <AccountMenu />}
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
        {menuOpen && !bare && (
          <nav id="mobile-menu" aria-label={t.nav} className="sm:hidden border-t border-rule bg-bay px-4 pb-4">
            <ul className="divide-y divide-rule">
              {items.map(item => (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setMenuOpen(false)} aria-current={item.match(pathname) ? 'page' : undefined}
                    className={`flex h-12 items-center ${item.match(pathname) ? 'text-ink font-semibold' : 'text-ink-muted'}`}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {isPublic && <a href={ctaHref} onClick={() => setMenuOpen(false)} className="btn btn-primary mt-3 h-11 w-full">{t.cta}</a>}
          </nav>
        )}
        {isPublic && <span className="page-progress" aria-hidden />}
      </header>
    </>
  )
}
