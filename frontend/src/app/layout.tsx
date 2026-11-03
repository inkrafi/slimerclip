import type { Metadata, Viewport } from 'next'
import './globals.css'
import { headers } from 'next/headers'
import { AuthProvider } from '@/components/AuthProvider'
import { LocaleProvider } from '@/components/LocaleProvider'
import MobileCta from '@/components/marketing/MobileCta'
import SiteFooter from '@/components/SiteFooter'
import SiteHeader from '@/components/SiteHeader'
import { jakarta, onest, syne } from '@/lib/fonts'
import { getLocale } from '@/lib/locale-server'
import { SURFACE_HEADER } from '@/lib/routes'

const META = {
  id: {
    title: 'SlimerClip: jasa clipping podcast & motion video peluncuran SaaS',
    description: 'Podcast jadi klip 9:16 siap unggah, produk SaaS jadi motion video peluncuran. Mulai dari konsultasi gratis.',
  },
  en: {
    title: 'SlimerClip: podcast clipping & SaaS launch motion video',
    description: 'Podcasts into ready-to-post 9:16 clips, SaaS products into launch motion video. Start with a free consultation.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return META[await getLocale()]
}

export const viewport: Viewport = { themeColor: '#1a1742' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const isPublic = (await headers()).get(SURFACE_HEADER) === 'public'
  return (
    <html lang={locale} className={`${jakarta.variable} ${syne.variable} ${onest.variable}`}>
      <body className="min-h-screen">
        <noscript><style>{'.reveal{opacity:1;transform:none}.scrub{display:none}.hero-static{display:block}'}</style></noscript>
        <LocaleProvider locale={locale}>
          <AuthProvider>
            {isPublic && <div className="env-layer" aria-hidden />}
            {isPublic && (
              <a href="#main" className="sr-only z-50 rounded bg-signal px-4 py-2 font-semibold text-bay focus:not-sr-only focus:fixed focus:left-4 focus:top-2">
                {locale === 'id' ? 'Lewati ke isi halaman' : 'Skip to content'}
              </a>
            )}
            <SiteHeader />
            <main id="main" tabIndex={-1} className={isPublic ? 'outline-none' : 'mx-auto max-w-6xl px-4 sm:px-6 pb-24'}>{children}</main>
            {isPublic && <SiteFooter locale={locale} />}
            {isPublic && <MobileCta locale={locale} />}
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
