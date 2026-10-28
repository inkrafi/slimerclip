import { Onest, Plus_Jakarta_Sans, Syne } from 'next/font/google'

// Plus Jakarta Sans (dirancang studio tipografi Jakarta) untuk judul: tegas tapi mudah dibaca
export const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-jakarta',
})

// Syne khusus untuk wordmark logo "SlimerClip"
export const syne = Syne({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-syne',
})

// Onest untuk teks antarmuka
export const onest = Onest({
  subsets: ['latin'],
  variable: '--font-onest',
})
