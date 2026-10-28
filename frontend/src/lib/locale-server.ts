import { headers } from 'next/headers'
import { isLocale, LOCALE_HEADER } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'

/** Bahasa halaman untuk server component (ditentukan proxy.ts). */
export async function getLocale(): Promise<Locale> {
  const value = (await headers()).get(LOCALE_HEADER)
  return isLocale(value) ? value : 'id'
}
