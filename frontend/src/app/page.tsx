'use client'

import { useRouter } from 'next/navigation'
import Hero from '@/components/landing/Hero'
import HowItWorks from '@/components/landing/HowItWorks'
import SplitStory from '@/components/landing/SplitStory'
import ScoreStory from '@/components/landing/ScoreStory'
import LibraryCta from '@/components/landing/LibraryCta'
import { useLandingMedia } from '@/hooks/useLandingMedia'
import { extractVideoId } from '@/lib/api'

export default function Home() {
  const router = useRouter()
  const media = useLandingMedia()

  const handleSubmit = (url: string) => {
    const id = /youtu\.?be/.test(url) ? extractVideoId(url) : null
    if (!id) return 'Itu bukan link video YouTube. Contoh: https://www.youtube.com/watch?v=…'
    router.push(`/video/${id}`)
  }

  return (
    <>
      <Hero media={media} onSubmit={handleSubmit} />
      <HowItWorks />
      <SplitStory videoId={media.videos[0]?.video_id} />
      <ScoreStory />
      <LibraryCta media={media} onSubmit={handleSubmit} />
    </>
  )
}
