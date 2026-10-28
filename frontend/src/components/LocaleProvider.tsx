'use client'

import { createContext, useCallback, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { LOCALE_COOKIE } from '@/lib/i18n'
import type { Copy, Locale } from '@/lib/i18n'

const LocaleContext = createContext<{ locale: Locale; setLocale: (next: Locale) => void }>({
  locale: 'id',
  setLocale: () => {},
})

/** Bahasa halaman (dari proxy.ts lewat layout). setLocale = pilihan manual, disimpan 1 tahun. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter()
  const setLocale = useCallback((next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    router.refresh()   // server render ulang dengan bahasa baru
  }, [router])
  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
}

export const useLocale = () => useContext(LocaleContext)

/** Teks komponen dalam bahasa aktif: const t = useCopy(COPY) */
export function useCopy<T>(copy: Copy<T>): T {
  return copy[useContext(LocaleContext).locale]
}

/** Tombol ganti bahasa ID / EN */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  const next: Locale = locale === 'id' ? 'en' : 'id'
  return (
    <button type="button" onClick={() => setLocale(next)} className={`h-8 rounded-md border border-rule px-2 text-xs text-ink-muted hover:text-ink ${className}`}
      aria-label={locale === 'id' ? 'Switch to English' : 'Ganti ke bahasa Indonesia'} title={locale === 'id' ? 'English' : 'Bahasa Indonesia'}>
      <span className={locale === 'id' ? 'text-ink font-semibold' : ''}>ID</span>
      <span className="mx-1 text-ink-faint">/</span>
      <span className={locale === 'en' ? 'text-ink font-semibold' : ''}>EN</span>
    </button>
  )
}
