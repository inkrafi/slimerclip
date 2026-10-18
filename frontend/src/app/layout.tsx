import type { Metadata } from 'next'
import './globals.css'
import SiteHeader from '@/components/SiteHeader'
import { jakarta, onest, syne } from '@/lib/fonts'

export const metadata: Metadata = {
  title: 'SlimerClip: penonton sudah memilih momennya, kamu tinggal unggah',
  description: 'Klip podcast dari momen yang benar-benar diputar ulang penonton YouTube, dirender 9:16 mengikuti siapa pun yang bicara, lengkap dengan hook dan caption.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${syne.variable} ${onest.variable}`}>
      <body className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-24">{children}</main>
      </body>
    </html>
  )
}
