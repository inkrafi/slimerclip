/** Halaman jasa untuk publik: tampil dengan menu jasa & footer, boleh diindeks. */
export const isPublicPath = (path: string) => ['/', '/clipping', '/motion', '/privasi', '/syarat'].includes(path)

/** Halaman jasa yang punya section #konsultasi */
export const hasContactBand = (path: string) => ['/', '/clipping', '/motion'].includes(path)

/** Header dari proxy ke layout: halaman ini memakai kerangka jasa (lebar penuh + footer) */
export const SURFACE_HEADER = 'x-slimer-surface'

/** Halaman untuk klien lewat tautan (review, laporan): tanpa menu. */
export const isClientPath = (path: string) => path.startsWith('/r/') || path.startsWith('/lapor/')

/** Halaman login admin: tanpa menu. */
export const isAuthPath = (path: string) => path.startsWith('/masuk') || path.startsWith('/auth')

/** Tujuan admin setelah login */
export const ADMIN_HOME = '/admin'
