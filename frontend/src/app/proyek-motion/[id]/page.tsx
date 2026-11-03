import type { Metadata } from 'next'
import MotionProjectForm from '@/components/motion/MotionProjectForm'
import RequireAuth from '@/components/RequireAuth'

export const metadata: Metadata = { title: 'Proyek motion · SlimerClip' }

export default async function MotionProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <RequireAuth>
      <MotionProjectForm projectId={id} />
    </RequireAuth>
  )
}
