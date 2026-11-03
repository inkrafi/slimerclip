import Band from '@/components/marketing/Band'
import ContactButtons from '@/components/marketing/ContactButtons'
import Reveal from '@/components/marketing/Reveal'
import type { Locale } from '@/lib/i18n'

const COPY: Record<Locale, { cta: string; nextTitle: string; next: string[] }> = {
  id: {
    cta: 'Mulai konsultasi gratis',
    nextTitle: 'Setelah kamu menghubungi kami',
    next: ['Kamu ceritakan kebutuhannya.', 'Kami sarankan paket dan tulis harganya.', 'Pekerjaan dimulai setelah kamu setuju.'],
  },
  en: {
    cta: 'Start a free consultation',
    nextTitle: 'After you reach out',
    next: ['You tell us what you need.', 'We suggest a package and put the price in writing.', 'Work begins once you agree.'],
  },
}

interface Props {
  locale: Locale
  title: string
  body: string
  message: string
  subject: string
}

/** Penutup halaman: satu ajakan yang jelas dan apa yang terjadi setelahnya. Tombol di header menuju ke sini. */
export default function ContactBand({ locale, title, body, message, subject }: Props) {
  const t = COPY[locale]
  return (
    <Band tone="magenta" id="konsultasi" labelledBy="contact-title">
      <span className="gel gel-a" aria-hidden />
      <span className="gel gel-b" aria-hidden />
      <Reveal className="relative text-center">
        <h2 id="contact-title" className="type-display mx-auto max-w-[18ch] text-ink text-[clamp(2.4rem,6vw,4.8rem)]">{title}</h2>
        <p className="mx-auto mt-5 max-w-[52ch] text-lg leading-relaxed text-ink/85">{body}</p>
        <div className="mt-9">
          <ContactButtons locale={locale} message={message} subject={subject} primaryLabel={t.cta} centered large />
        </div>
      </Reveal>
      <Reveal delay={120} className="relative mx-auto mt-14 max-w-4xl border-t border-white/20 pt-6">
        <p className="text-center text-sm font-semibold text-ink">{t.nextTitle}</p>
        <ol className="mt-4 grid gap-3 text-sm text-ink/85 sm:grid-cols-3">
          {t.next.map((step, i) => (
            <li key={step} className="flex gap-2.5">
              <span className="timecode font-semibold text-ink">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </Reveal>
    </Band>
  )
}
