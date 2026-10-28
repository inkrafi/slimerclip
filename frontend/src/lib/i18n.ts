/**
 * Bahasa halaman publik (landing, masuk/daftar, jasa clipping): pengunjung dari Indonesia → bahasa Indonesia + Rupiah,
 * selain itu → bahasa Inggris + USD. Ditentukan di proxy.ts (pilihan manual > negara dari IP > bahasa browser),
 * lalu diteruskan lewat header ke server component dan lewat LocaleProvider ke client component.
 * Ruang kerja & editor tetap berbahasa Indonesia.
 */
export type Locale = 'id' | 'en'
export const LOCALES: Locale[] = ['id', 'en']

/** Header dari proxy ke server component */
export const LOCALE_HEADER = 'x-slimer-locale'
/** Pilihan manual pengunjung lewat tombol ID/EN (menang atas deteksi IP) */
export const LOCALE_COOKIE = 'slimer_lang'

/** Header negara dari hosting/CDN (Vercel, Cloudflare, CloudFront, Netlify/proxy lain), kode ISO 3166 */
export const COUNTRY_HEADERS = ['x-vercel-ip-country', 'cf-ipcountry', 'cloudfront-viewer-country', 'x-country-code', 'x-geo-country']

export const isLocale = (value: unknown): value is Locale => value === 'id' || value === 'en'

export function localeForCountry(country: string | null | undefined): Locale | null {
  const code = (country || '').trim().toUpperCase()
  // XX / T1 = negara tidak diketahui / Tor (Cloudflare)
  if (code.length !== 2 || code === 'XX' || code === 'T1') return null
  return code === 'ID' ? 'id' : 'en'
}

/** Cadangan tanpa info negara: bahasa browser (Accept-Language) yang paling diutamakan antara id/en */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  const prefs = (header || '').split(',').map(part => {
    const [tag, q] = part.trim().split(';q=')
    return { lang: tag.toLowerCase().split('-')[0], q: q ? Number(q) : 1 }
  }).filter(p => p.lang).sort((a, b) => b.q - a.q)
  const hit = prefs.find(p => p.lang === 'id' || p.lang === 'ms' || p.lang === 'en')
  return hit ? (hit.lang === 'en' ? 'en' : 'id') : prefs.length ? 'en' : null
}

/** Teks per bahasa, ditaruh di samping komponennya */
export type Copy<T> = Record<Locale, T>
