import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'
import { LocaleProvider } from '@/components/LocaleProvider'
import SiteHeader from '@/components/SiteHeader'
import { jakarta, onest, syne } from '@/lib/fonts'
import { getLocale } from '@/lib/locale-server'

const META = {
  id: {
    title: 'SlimerClip: penonton sudah memilih momennya, kamu tinggal unggah',
    description: 'Klip podcast dari momen yang benar-benar diputar ulang penonton YouTube, dirender 9:16 mengikuti siapa pun yang bicara, lengkap dengan hook dan caption.',
  },
  en: {
    title: 'SlimerClip: your viewers already picked the moments, you just post them',
    description: 'Podcast clips from the moments YouTube viewers actually replay, rendered 9:16 following whoever is speaking, with hooks and captions.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return META[await getLocale()]
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <html lang={locale} className={`${jakarta.variable} ${syne.variable} ${onest.variable}`}>
      <body className="min-h-screen">
        <LocaleProvider locale={locale}>
          <AuthProvider>
            <SiteHeader />
            <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-24">{children}</main>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
