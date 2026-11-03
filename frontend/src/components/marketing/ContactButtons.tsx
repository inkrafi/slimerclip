import { ArrowRight, CalendarDays, Mail, MessageCircle } from 'lucide-react'
import type { ContactKind } from '@/content/service'
import { contactLinks } from '@/content/service'
import type { Locale } from '@/lib/i18n'

const ICONS = { whatsapp: MessageCircle, email: Mail, booking: CalendarDays }

const LABELS: Record<Locale, Record<ContactKind, string>> = {
  id: { whatsapp: 'Chat WhatsApp', email: 'Kirim email', booking: 'Jadwalkan panggilan' },
  en: { whatsapp: 'Chat on WhatsApp', email: 'Email us', booking: 'Book a call' },
}

const NOTES: Record<Locale, Record<ContactKind, string>> = {
  id: { whatsapp: 'Gratis, lewat WhatsApp.', email: 'Gratis, lewat email.', booking: 'Gratis, lewat panggilan.' },
  en: { whatsapp: 'Free, on WhatsApp.', email: 'Free, by email.', booking: 'Free, on a call.' },
}

/** Kalimat kecil di dekat tombol utama: konsultasinya gratis dan lewat jalur apa */
export function ContactNote({ locale, className = '' }: { locale: Locale; className?: string }) {
  const kind = contactLinks(locale, '', '')[0]?.kind
  return kind ? <p className={`text-sm text-ink-muted ${className}`}>{NOTES[locale][kind]}</p> : null
}

interface Props {
  locale: Locale
  message: string
  subject: string
  /** Teks tombol utama; kosong = nama jalur kontaknya */
  primaryLabel?: string
  centered?: boolean
  /** Tombol utama saja */
  primaryOnly?: boolean
  /** Tampilkan tombol utama dengan gaya tenang (kartu paket selain yang disarankan) */
  quiet?: boolean
  /** Tombol utama lebih besar, untuk penutup halaman */
  large?: boolean
}

/** Tombol kontak sesuai asal pengunjung. Tautannya datang dari env, jadi bisa kosong sebelum diatur. */
export default function ContactButtons({ locale, message, subject, primaryLabel, centered, primaryOnly, quiet, large }: Props) {
  const links = contactLinks(locale, message, subject)
  const shown = primaryOnly ? links.slice(0, 1) : links
  if (!shown.length) return null
  return (
    <div className={`flex flex-wrap gap-3 ${centered ? 'justify-center' : ''}`}>
      {shown.map((link, i) => {
        const Icon = ICONS[link.kind]
        const primary = i === 0 && !quiet
        return (
          <a key={link.kind} href={link.href} target="_blank" rel="noopener noreferrer"
            className={`btn group/cta ${large && i === 0 ? 'h-14 px-8 text-base' : 'h-12 px-6'} ${primary ? 'btn-primary cta-lux' : 'btn-quiet cta-quiet'}`}>
            <Icon className="size-4" aria-hidden />
            {i === 0 && primaryLabel ? primaryLabel : LABELS[locale][link.kind]}
            <ArrowRight className="cta-arrow size-4" aria-hidden />
          </a>
        )
      })}
    </div>
  )
}
