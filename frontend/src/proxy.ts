import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { COUNTRY_HEADERS, isLocale, LOCALE_COOKIE, LOCALE_HEADER, localeForCountry, localeFromAcceptLanguage } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost|.*\.test)(:\d+)?$/

/** Bahasa pengunjung: pilihan manual (cookie) > negara dari IP (header hosting) > bahasa browser > default. */
function pickLocale(request: NextRequest): Locale {
  const manual = request.cookies.get(LOCALE_COOKIE)?.value
  if (isLocale(manual)) return manual
  for (const name of COUNTRY_HEADERS) {
    const byCountry = localeForCountry(request.headers.get(name))
    if (byCountry) return byCountry
  }
  // Tanpa info negara (mis. server sendiri tanpa CDN). Saat pengembangan lokal default bahasa Indonesia.
  if (LOCAL_HOST.test(request.headers.get('host') || '')) return 'id'
  return localeFromAcceptLanguage(request.headers.get('accept-language')) ?? 'en'
}

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set(LOCALE_HEADER, pickLocale(request))
  // Alamat berbahasa Inggris untuk halaman jasa
  if (request.nextUrl.pathname === '/services') {
    return NextResponse.rewrite(new URL('/jasa', request.url), { request: { headers } })
  }
  return NextResponse.next({ request: { headers } })
}

export const config = {
  // Halaman saja; file statis & aset Next tidak perlu
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo-mark.png|.*\\.(?:svg|png|jpg|jpeg|webp|mp4)$).*)'],
}
