import type { NicheSetting, Segment } from '@/lib/types'

// Sama dengan backend/niche.py
export const CATEGORY_LABELS: Record<string, string> = {
  bisnis: 'Bisnis & entrepreneurship',
  investasi: 'Investasi & saham',
  keuangan: 'Keuangan pribadi',
  marketing: 'Digital marketing & personal branding',
  karier: 'Karier & produktivitas',
  teknologi: 'Teknologi & AI',
  pendidikan: 'Pendidikan & ilmu pengetahuan',
  mindset: 'Mindset & motivasi',
  kesehatan: 'Kesehatan & gaya hidup',
  hubungan: 'Hubungan & keluarga',
  sosial: 'Isu sosial & politik',
  hiburan: 'Hiburan & selebriti',
  komedi: 'Komedi',
  lainnya: 'Lainnya',
}

/** Topik yang bisa dipilih sebagai niche (komedi diatur lewat selingan) */
export const NICHE_TOPICS = Object.keys(CATEGORY_LABELS).filter(k => k !== 'komedi' && k !== 'lainnya')

export const DEFAULT_NICHE: NicheSetting = { topics: [], comedy: true }

/**
 * Posisi momen terhadap niche: "niche" ditampilkan, "selingan" = momen lucu yang ikut ditampilkan,
 * "luar" disembunyikan. Analisis lama tanpa kategori dan niche kosong = semua ditampilkan.
 */
export type Fit = 'niche' | 'selingan' | 'luar'

export function fitOf(segment: Segment, niche: NicheSetting = DEFAULT_NICHE): Fit {
  const cat = segment.category
  if (!cat) return 'niche'
  if (niche.topics.includes(cat)) return 'niche'
  if (cat === 'komedi' && niche.comedy) return 'selingan'
  return niche.topics.length === 0 ? 'niche' : 'luar'
}
