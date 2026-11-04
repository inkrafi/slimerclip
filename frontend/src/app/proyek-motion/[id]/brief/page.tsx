import type { Metadata } from 'next'
import MotionBriefPage from '@/components/motion/MotionBriefPage'
import RequireAuth from '@/components/RequireAuth'

export const metadata: Metadata = { title: 'Brief dan prompt · SlimerClip' }

export default async function MotionBriefRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <RequireAuth>
      <MotionBriefPage projectId={id} />
    </RequireAuth>
  )
}
