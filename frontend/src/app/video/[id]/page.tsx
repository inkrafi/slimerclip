'use client'

import { use } from 'react'
import VideoWorkspace from '@/components/VideoWorkspace'

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <VideoWorkspace key={id} videoId={id} />
}
