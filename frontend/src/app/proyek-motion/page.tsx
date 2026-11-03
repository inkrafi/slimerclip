import type { Metadata } from 'next'
import MotionProjectList from '@/components/motion/MotionProjectList'
import RequireAuth from '@/components/RequireAuth'

export const metadata: Metadata = { title: 'Proyek motion · SlimerClip' }

export default function ProyekMotionPage() {
  return (
    <RequireAuth>
      <MotionProjectList />
    </RequireAuth>
  )
}
