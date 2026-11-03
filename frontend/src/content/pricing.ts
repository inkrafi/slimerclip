import type { Locale } from '@/lib/i18n'

/**
 * Harga jasa per negara pengunjung. Hanya boleh diimpor dari server component,
 * supaya HTML dan JavaScript yang dikirim hanya memuat harga untuk negara pengunjung itu.
 */
export type Plan = {
  name: string
  /** Awalan harga, mis. "Mulai" */
  from?: string
  price: string
  unit?: string
  items: string[]
  featured?: boolean
}

export const CLIPPING_PLANS: Record<Locale, Plan[]> = {
  id: [
    { name: 'Satuan', price: 'Rp50 rb', unit: '/ klip', items: ['Minimal 5 klip', 'Hook, caption, musik, thumbnail', 'Judul, deskripsi & hashtag', '1× revisi'] },
    { name: 'Starter', price: 'Rp900 rb', unit: '/ bulan', items: ['20 klip per bulan', 'Semua fitur edit', '1× revisi per klip'] },
    { name: 'Growth', price: 'Rp1,6 jt', unit: '/ bulan', featured: true, items: ['40 klip per bulan', 'Subtitle terjemahan ID/EN', '2× revisi per klip', 'Prioritas pengerjaan'] },
    { name: 'Pro', price: 'Rp2,1 jt', unit: '/ bulan', items: ['60 klip per bulan', 'Format edit khas brand-mu', '2× revisi per klip', 'Laporan performa bulanan'] },
  ],
  en: [
    { name: 'Per clip', price: '$20', unit: '/ clip', items: ['Minimum 5 clips', 'Hook, captions, music, thumbnail', 'Title, description & hashtags', '1 revision'] },
    { name: 'Starter', price: '$249', unit: '/ month', items: ['15 clips per month', 'All editing features', '1 revision per clip'] },
    { name: 'Growth', price: '$449', unit: '/ month', featured: true, items: ['30 clips per month', 'Translated subtitles (EN/ID)', '2 revisions per clip', 'Priority turnaround'] },
    { name: 'Pro', price: '$799', unit: '/ month', items: ['60 clips per month', 'Your own brand edit style', '2 revisions per clip', 'Monthly performance report'] },
  ],
}

export const MOTION_PLANS: Record<Locale, Plan[]> = {
  id: [
    { name: 'Teaser', from: 'Mulai', price: 'Rp3,5 jt', items: ['Video 15–30 detik', 'Untuk pemanasan sebelum peluncuran'] },
    { name: 'Launch video', from: 'Mulai', price: 'Rp7,5 jt', featured: true, items: ['Video 45–60 detik', 'Untuk hari peluncuran'] },
    { name: 'Launch kit', from: 'Mulai', price: 'Rp12 jt', items: ['Video 60 detik', '3 potongan pendek', 'Versi vertikal'] },
    { name: 'Custom', price: 'Konsultasi', items: ['Durasi atau kebutuhan lain', 'Lingkup dan harga dibahas bersama'] },
  ],
  en: [
    { name: 'Teaser', from: 'From', price: '$590', items: ['15–30 second video', 'For the run-up to launch'] },
    { name: 'Launch video', from: 'From', price: '$1,190', featured: true, items: ['45–60 second video', 'For launch day'] },
    { name: 'Launch kit', from: 'From', price: '$1,790', items: ['60 second video', '3 short cutdowns', 'Vertical version'] },
    { name: 'Custom', price: 'Consultation', items: ['Other lengths or needs', 'Scope and price agreed together'] },
  ],
}

/** Harga awal untuk ringkasan di halaman depan */
export const STARTING_PRICES: Record<Locale, { clipping: string; motion: string }> = {
  id: { clipping: 'Mulai Rp50 rb per klip, paket bulanan mulai Rp900 rb', motion: 'Mulai Rp3,5 jt per video' },
  en: { clipping: 'From $20 per clip, monthly plans from $249', motion: 'From $590 per video' },
}
