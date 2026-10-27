'use client'

import { use } from 'react'
import LongformStudio from '@/components/longform/LongformStudio'
import RequireAuth from '@/components/RequireAuth'

export default function TopicStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <RequireAuth>
      <LongformStudio videoId={id} />
    </RequireAuth>
  )
}
