'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Toaster } from 'sonner'
import RenderIndicator from '@/components/RenderIndicator'
import { syne } from '@/lib/fonts'

const NAV = [
  { href: '/', label: 'Ruang kerja', match: (p: string) => p === '/' || p.startsWith('/video') },
  { href: '/riwayat', label: 'Riwayat', match: (p: string) => p.startsWith('/riwayat') },
]

export default function SiteHeader() {
  const pathname = usePathname() || '/'

  return (
    <>
      <Toaster
        position="bottom-center"
        theme="dark"
        toastOptions={{
          style: { background: '#2a2660', border: '1px solid var(--color-rule)', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)' },
        }}
      />
      <header className="sticky top-0 z-40 border-b border-rule bg-bay/55 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 text-ink" aria-label="SlimerClip, ke halaman awal">
            <Image src="/logo-mark.png" alt="" width={32} height={32} priority className="size-8" />
            <span className={`${syne.className} text-xl leading-none tracking-[-0.02em]`}>SlimerClip</span>
          </Link>
          <div className="flex items-center gap-3">
          <RenderIndicator />
          <nav aria-label="Navigasi utama" className="flex items-center gap-1 text-sm">
            {NAV.map(item => {
              const active = item.match(pathname)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`h-14 px-3 flex items-center border-b-2 -mb-px ${active ? 'border-signal text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
          </div>
        </div>
      </header>
    </>
  )
}
