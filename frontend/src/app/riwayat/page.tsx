import type { Metadata } from 'next'
import HistoryPanel from '@/components/HistoryPanel'

export const metadata: Metadata = { title: 'Riwayat · SlimerClip' }

export default function RiwayatPage() {
  return (
    <div className="max-w-3xl pt-12">
      <HistoryPanel />
    </div>
  )
}
