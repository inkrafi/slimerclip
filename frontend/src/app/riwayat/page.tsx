import type { Metadata } from 'next'
import HistoryPanel from '@/components/HistoryPanel'
import RequireAuth from '@/components/RequireAuth'

export const metadata: Metadata = { title: 'Riwayat · SlimerClip' }

export default function RiwayatPage() {
  return (
    <div className="max-w-3xl pt-12">
      <RequireAuth>
        <HistoryPanel />
      </RequireAuth>
    </div>
  )
}
