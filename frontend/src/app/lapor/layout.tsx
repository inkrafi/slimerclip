import type { Metadata } from 'next'

// Laporan klien bersifat pribadi: jangan diindeks mesin pencari, jangan kirim alamatnya ke situs lain
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return children
}
