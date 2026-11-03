'use client'

import { useRouter } from 'next/navigation'
import CreateEntry from '@/components/CreateEntry'
import RequireAuth from '@/components/RequireAuth'
import { extractVideoId } from '@/lib/api'

export default function AdminHome() {
  const router = useRouter()

  const handleSubmit = (url: string) => {
    const id = /youtu\.?be/.test(url) ? extractVideoId(url) : null
    if (!id) return 'Itu bukan link video YouTube. Contoh: https://www.youtube.com/watch?v=…'
    router.push(`/video/${id}`)
  }

  return (
    <RequireAuth>
      <div className="pt-12 max-w-3xl">
        <h1 className="type-display text-ink text-[clamp(2rem,4vw,2.8rem)]">Ruang kerja</h1>
        <p className="mt-3 text-ink-muted">Mulai klip dari podcast atau video panjang dari topik.</p>
        <div className="mt-8"><CreateEntry onSubmit={handleSubmit} /></div>
      </div>
    </RequireAuth>
  )
}
