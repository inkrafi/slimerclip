'use client'

import { use } from 'react'
import RequireAuth from '@/components/RequireAuth'
import VideoWorkspace from '@/components/VideoWorkspace'

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <RequireAuth>
      <VideoWorkspace key={id} videoId={id} />
    </RequireAuth>
  )
}
