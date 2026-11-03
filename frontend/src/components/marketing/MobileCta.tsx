import { contactLinks } from '@/content/service'
import type { Locale } from '@/lib/i18n'

const COPY: Record<Locale, { cta: string; message: string; subject: string }> = {
  id: { cta: 'Konsultasi gratis', message: 'Halo SlimerClip, saya ingin konsultasi. Yang sedang saya kerjakan: ', subject: 'Konsultasi SlimerClip' },
  en: { cta: 'Get a free consultation', message: "Hi SlimerClip, I'd like a consultation. I'm working on: ", subject: 'SlimerClip consultation' },
}

/** Layar sempit: tombol konsultasi selalu terjangkau di bawah layar. */
export default function MobileCta({ locale }: { locale: Locale }) {
  const t = COPY[locale]
  const link = contactLinks(locale, t.message, t.subject)[0]
  if (!link) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-[#0b0a17]/95 p-3 sm:hidden">
      <a href={link.href} target="_blank" rel="noopener noreferrer" className="btn btn-primary h-12 w-full">{t.cta}</a>
    </div>
  )
}
