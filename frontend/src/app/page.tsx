'use client'

import { useRouter } from 'next/navigation'
import Hero from '@/components/landing/Hero'
import HowItWorks from '@/components/landing/HowItWorks'
import SplitStory from '@/components/landing/SplitStory'
import ScoreStory from '@/components/landing/ScoreStory'
import LibraryCta from '@/components/landing/LibraryCta'
import { useAuth } from '@/components/AuthProvider'
import { useLandingMedia } from '@/hooks/useLandingMedia'
import { extractVideoId } from '@/lib/api'

export default function Home() {
  const router = useRouter()
  const { enabled, signedIn, me } = useAuth()
  const media = useLandingMedia(signedIn)

  // Belum login → daftar/masuk dulu, lalu kembali ke video yang ditempel
  const handleSubmit = (url: string) => {
    const id = /youtu\.?be/.test(url) ? extractVideoId(url) : null
    if (!id) return 'Itu bukan link video YouTube. Contoh: https://www.youtube.com/watch?v=…'
    const target = `/video/${id}`
    router.push(signedIn ? target : `/daftar?next=${encodeURIComponent(target)}`)
  }

  // Keterangan di bawah form: tawaran uji coba gratis, atau sisa jatah pengguna
  const note = !enabled ? undefined
    : !signedIn ? 'Coba gratis: 3 analisis pertama tanpa biaya. Cukup buat akun, bisa langsung dengan Google.'
    : !me || me.is_admin ? undefined
    : me.has_gemini_key ? 'Analisis memakai API key Gemini milikmu.'
    : me.free_analyses_left ? `Sisa ${me.free_analyses_left} analisis gratis. Video yang sudah pernah dianalisis tidak memotong jatah.`
    : 'Jatah analisis gratis sudah habis. Tambahkan API key Gemini milikmu di Pengaturan.'

  return (
    <>
      <Hero media={media} onSubmit={handleSubmit} note={note} />
      <HowItWorks />
      <SplitStory videoId={media.videos[0]?.video_id} />
      <ScoreStory />
      <LibraryCta media={media} onSubmit={handleSubmit} note={note} />
    </>
  )
}
