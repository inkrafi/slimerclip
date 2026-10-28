import type { Metadata } from 'next'

// Halaman review klien bersifat pribadi: jangan diindeks mesin pencari, jangan kirim alamatnya ke situs lain
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
