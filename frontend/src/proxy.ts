import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { LOCALE_HEADER, localeForCountry } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'
import { isPublicPath, SURFACE_HEADER } from '@/lib/routes'

/**
 * Header negara yang dipercaya, dari satu lapisan di depan server (default Cloudflare).
 * Hanya satu nama supaya pengunjung tidak bisa memilih harga dengan mengirim header lain.
 */
const COUNTRY_HEADER = (process.env.GEO_COUNTRY_HEADER || 'cf-ipcountry').toLowerCase()

/** Alamat lama yang sudah tidak punya halaman */
const REDIRECTS: Record<string, string> = {
  '/jasa': '/clipping',
  '/services': '/clipping',
  '/daftar': '/',
  '/lupa-sandi': '/',
  '/atur-sandi': '/',
}

/** Bahasa & harga mengikuti negara dari IP saja. Negara tidak diketahui → Inggris/USD. */
function pickLocale(request: NextRequest): Locale {
  const country = process.env.NODE_ENV === 'production'
    ? request.headers.get(COUNTRY_HEADER)
    : process.env.GEO_DEV_COUNTRY || 'ID'   // pengembangan lokal tidak punya header negara
  return localeForCountry(country) ?? 'en'
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const target = REDIRECTS[pathname]
  if (target) return NextResponse.redirect(new URL(target, request.url), 308)

  const headers = new Headers(request.headers)
  headers.set(LOCALE_HEADER, pickLocale(request))
  if (isPublicPath(pathname)) headers.set(SURFACE_HEADER, 'public')
  else headers.delete(SURFACE_HEADER)
  const response = NextResponse.next({ request: { headers } })
  // Hanya halaman jasa yang boleh diindeks; login, admin, dan halaman klien tidak
  if (!isPublicPath(pathname)) response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

export const config = {
  // Halaman saja; file statis & aset Next tidak perlu
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo-mark.png|.*\\.(?:svg|png|jpg|jpeg|webp|mp4)$).*)'],
}
