import type { Locale } from '@/lib/i18n'

/**
 * Isi halaman jasa yang diatur pemilik: kontak & portofolio.
 * Kontak diambil dari env agar tidak tertulis di kode:
 *   NEXT_PUBLIC_CONTACT_WHATSAPP = nomor WA format internasional tanpa +, mis. 6281234567890 (pengunjung Indonesia)
 *   NEXT_PUBLIC_CONTACT_EMAIL    = email (utama untuk luar negeri, cadangan untuk Indonesia)
 *   NEXT_PUBLIC_CONTACT_BOOKING  = tautan booking call, mis. Cal.com (utama untuk luar negeri jika diisi)
 */
export const CONTACT = {
  whatsapp: (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || '').replace(/\D/g, ''),
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '',
  booking: process.env.NEXT_PUBLIC_CONTACT_BOOKING || '',
}

export type ContactKind = 'whatsapp' | 'email' | 'booking'
export type ContactLink = { kind: ContactKind; href: string }

/** Jalur kontak sesuai asal pengunjung, urut dari yang utama. Indonesia: WhatsApp dulu. Luar negeri: booking call, lalu email. */
export function contactLinks(locale: Locale, message: string, subject: string): ContactLink[] {
  const whatsapp: ContactLink | null = CONTACT.whatsapp
    ? { kind: 'whatsapp', href: `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}` } : null
  const email: ContactLink | null = CONTACT.email
    ? { kind: 'email', href: `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}` } : null
  const booking: ContactLink | null = CONTACT.booking ? { kind: 'booking', href: CONTACT.booking } : null
  const order = locale === 'id' ? [whatsapp, email] : [booking, email]
  return order.filter((link): link is ContactLink => link !== null)
}

export type WorkSlot = {
  /** Nama file tanpa ekstensi, di public/portfolio/clips atau public/portfolio/motion */
  file: string
  /** Boleh kosong. Tampil di bawah video. */
  title: string
  /** Boleh kosong. Baris kecil di bawah judul, mis. nama podcast. */
  source: string
}

/**
 * 10 klip 9:16. Taruh file di frontend/public/portfolio/clips/clip-01.mp4 dan seterusnya.
 * Gambar sampul opsional: clip-01.jpg di folder yang sama. Slot tanpa file tidak tampil.
 */
export const CLIP_SLOTS: WorkSlot[] = [
  { file: 'clip-01', title: '', source: '' },
  { file: 'clip-02', title: '', source: '' },
  { file: 'clip-03', title: '', source: '' },
  { file: 'clip-04', title: '', source: '' },
  { file: 'clip-05', title: '', source: '' },
  { file: 'clip-06', title: '', source: '' },
  { file: 'clip-07', title: '', source: '' },
  { file: 'clip-08', title: '', source: '' },
  { file: 'clip-09', title: '', source: '' },
  { file: 'clip-10', title: '', source: '' },
]

/**
 * 3 video motion 16:9, semuanya tampil dengan label karya konsep.
 * Taruh file di frontend/public/portfolio/motion/motion-01.mp4 dan seterusnya.
 */
export const MOTION_SLOTS: WorkSlot[] = [
  { file: 'motion-01', title: '', source: '' },
  { file: 'motion-02', title: '', source: '' },
  { file: 'motion-03', title: '', source: '' },
]
