'use client'

import { useRouter } from 'next/navigation'
import Hero from '@/components/landing/Hero'
import HowItWorks from '@/components/landing/HowItWorks'
import SplitStory from '@/components/landing/SplitStory'
import ScoreStory from '@/components/landing/ScoreStory'
import LibraryCta from '@/components/landing/LibraryCta'
import { useAuth } from '@/components/AuthProvider'
import { useCopy } from '@/components/LocaleProvider'
import { useLandingMedia } from '@/hooks/useLandingMedia'
import { extractVideoId } from '@/lib/api'

const COPY = {
  id: {
    notYoutube: 'Itu bukan link video YouTube. Contoh: https://www.youtube.com/watch?v=…',
    trial: 'Coba gratis: 3 analisis pertama tanpa biaya. Cukup buat akun, bisa langsung dengan Google.',
    ownKey: 'Analisis memakai API key Gemini milikmu.',
    left: (n: number) => `Sisa ${n} analisis gratis. Video yang sudah pernah dianalisis tidak memotong jatah.`,
    out: 'Jatah analisis gratis sudah habis. Tambahkan API key Gemini milikmu di Pengaturan.',
  },
  en: {
    notYoutube: "That isn't a YouTube video link. Example: https://www.youtube.com/watch?v=…",
    trial: 'Try it free: your first 3 analyses cost nothing. Just create an account, Google sign-in works.',
    ownKey: 'Analysis uses your own Gemini API key.',
    left: (n: number) => `${n} free analys${n === 1 ? 'is' : 'es'} left. Videos analyzed before don't use your quota.`,
    out: 'Your free analyses are used up. Add your own Gemini API key in Settings.',
  },
}

export default function Home() {
  const router = useRouter()
  const { enabled, signedIn, me } = useAuth()
  const t = useCopy(COPY)
  const media = useLandingMedia(signedIn)

  // Belum login → daftar/masuk dulu, lalu kembali ke video yang ditempel
  const handleSubmit = (url: string) => {
    const id = /youtu\.?be/.test(url) ? extractVideoId(url) : null
    if (!id) return t.notYoutube
    const target = `/video/${id}`
    router.push(signedIn ? target : `/daftar?next=${encodeURIComponent(target)}`)
  }

  // Keterangan di bawah form: tawaran uji coba gratis, atau sisa jatah pengguna
  const note = !enabled ? undefined
    : !signedIn ? t.trial
    : !me || me.is_admin ? undefined
    : me.has_gemini_key ? t.ownKey
    : me.free_analyses_left ? t.left(me.free_analyses_left)
    : t.out

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
