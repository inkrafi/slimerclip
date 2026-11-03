import type { Metadata } from 'next'
import MotionProjectForm from '@/components/motion/MotionProjectForm'
import RequireAuth from '@/components/RequireAuth'

export const metadata: Metadata = { title: 'Tambah proyek motion · SlimerClip' }

export default function NewMotionProjectPage() {
  return (
    <RequireAuth>
      <MotionProjectForm />
    </RequireAuth>
  )
}
