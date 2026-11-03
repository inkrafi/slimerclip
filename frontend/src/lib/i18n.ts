/**
 * Bahasa halaman: pengunjung dari Indonesia → bahasa Indonesia + Rupiah, selain itu → bahasa Inggris + USD.
 * Ditentukan di proxy.ts hanya dari negara IP, lalu diteruskan lewat header ke server component dan lewat
 * LocaleProvider ke client component. Tidak ada pilihan manual. Ruang kerja & editor tetap berbahasa Indonesia.
 */
export type Locale = 'id' | 'en'
export const LOCALES: Locale[] = ['id', 'en']

/** Header dari proxy ke server component */
export const LOCALE_HEADER = 'x-slimer-locale'
export const isLocale = (value: unknown): value is Locale => value === 'id' || value === 'en'

export function localeForCountry(country: string | null | undefined): Locale | null {
  const code = (country || '').trim().toUpperCase()
  // XX / T1 = negara tidak diketahui / Tor (Cloudflare)
  if (code.length !== 2 || code === 'XX' || code === 'T1') return null
  return code === 'ID' ? 'id' : 'en'
}

/** Teks per bahasa, ditaruh di samping komponennya */
export type Copy<T> = Record<Locale, T>
