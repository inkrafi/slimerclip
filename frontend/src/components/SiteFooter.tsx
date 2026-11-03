import Link from 'next/link'
import { Mail } from 'lucide-react'
import { CONTACT } from '@/content/service'
import { syne } from '@/lib/fonts'
import type { Locale } from '@/lib/i18n'

const COPY: Record<Locale, {
  tagline: string
  services: string; clipping: string; motion: string; pricingClip: string; pricingMotion: string
  workTitle: string; work: string[]
  legal: string; privacy: string; terms: string
  contact: string; contactNote: string; rights: string
}> = {
  id: {
    tagline: 'Jasa clipping podcast dan motion video untuk peluncuran SaaS.',
    services: 'Layanan', clipping: 'Jasa clipping', motion: 'Motion video', pricingClip: 'Paket clipping', pricingMotion: 'Paket motion',
    workTitle: 'Cara kita bekerja',
    work: ['Mulai dari konsultasi gratis', 'Pembayaran lewat transfer bank atau QRIS', 'DP 50% untuk klien baru', 'Hasil dikirim lewat Google Drive'],
    legal: 'Legal', privacy: 'Kebijakan privasi', terms: 'Syarat layanan',
    contact: 'Kontak', contactNote: 'Ceritakan kebutuhanmu lewat email.', rights: 'Hak cipta dilindungi.',
  },
  en: {
    tagline: 'Podcast clipping and motion video for SaaS launches.',
    services: 'Services', clipping: 'Podcast clipping', motion: 'Motion video', pricingClip: 'Clipping plans', pricingMotion: 'Motion packages',
    workTitle: 'How we work',
    work: ['Starts with a free consultation', 'Pay by Wise, PayPal, or Payoneer', '50% upfront for new clients', 'Files delivered via Google Drive'],
    legal: 'Legal', privacy: 'Privacy policy', terms: 'Terms of service',
    contact: 'Contact', contactNote: 'Tell us what you need by email.', rights: 'All rights reserved.',
  },
}

const linkClass = 'link-slide inline-flex min-h-11 items-center text-ink-muted hover:text-ink'

/** Footer halaman jasa, dirender di server sesuai negara pengunjung. Sengaja tanpa tautan masuk. */
export default function SiteFooter({ locale }: { locale: Locale }) {
  const t = COPY[locale]
  return (
    <footer className="bg-gradient-to-b from-transparent to-[#121033] pb-20 sm:pb-0">
      <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.4fr_1fr]">
          <div>
            <p className={`${syne.className} text-2xl text-ink`}>SlimerClip</p>
            <p className="mt-3 max-w-[32ch] text-sm leading-relaxed text-ink-muted">{t.tagline}</p>
            {CONTACT.email && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-ink">{t.contact}</h2>
                <p className="mt-1 text-sm text-ink-muted">{t.contactNote}</p>
                <a href={`mailto:${CONTACT.email}`} className={`${linkClass} gap-2 break-all text-sm`}>
                  <Mail className="size-4 shrink-0" aria-hidden /> {CONTACT.email}
                </a>
              </div>
            )}
          </div>
          <nav aria-label={t.services}>
            <h2 className="text-sm font-semibold text-ink">{t.services}</h2>
            <ul className="mt-2 text-sm">
              <li><Link href="/clipping" className={linkClass}>{t.clipping}</Link></li>
              <li><Link href="/clipping#paket" className={linkClass}>{t.pricingClip}</Link></li>
              <li><Link href="/motion" className={linkClass}>{t.motion}</Link></li>
              <li><Link href="/motion#paket" className={linkClass}>{t.pricingMotion}</Link></li>
            </ul>
          </nav>
          <div>
            <h2 className="text-sm font-semibold text-ink">{t.workTitle}</h2>
            <ul className="mt-4 space-y-3 text-sm text-ink-muted">
              {t.work.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <nav aria-label={t.legal}>
            <h2 className="text-sm font-semibold text-ink">{t.legal}</h2>
            <ul className="mt-2 text-sm">
              <li><Link href="/privasi" className={linkClass}>{t.privacy}</Link></li>
              <li><Link href="/syarat" className={linkClass}>{t.terms}</Link></li>
            </ul>
          </nav>
        </div>
        <p className="mt-12 border-t border-rule py-6 text-xs text-ink-muted">© {new Date().getFullYear()} SlimerClip. {t.rights}</p>
      </div>
    </footer>
  )
}
