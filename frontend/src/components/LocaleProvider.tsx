'use client'

import { createContext, useContext } from 'react'
import type { Copy, Locale } from '@/lib/i18n'

const LocaleContext = createContext<Locale>('id')

/** Bahasa halaman (dari proxy.ts lewat layout). Mengikuti negara pengunjung; tidak ada pilihan manual. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export const useLocale = () => ({ locale: useContext(LocaleContext) })

/** Teks komponen dalam bahasa aktif: const t = useCopy(COPY) */
export function useCopy<T>(copy: Copy<T>): T {
  return copy[useContext(LocaleContext)]
}
