'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

/**
 * Halaman admin: belum login → kembali ke halaman jasa, supaya alamat login tidak ditunjukkan ke pengunjung.
 * Hak akses sebenarnya ditegakkan backend (ADMIN_ONLY); halaman ini hanya mengatur tampilan.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, signedIn } = useAuth()
  const router = useRouter()
  const mustLeave = ready && !signedIn

  useEffect(() => {
    if (mustLeave) router.replace('/')
  }, [mustLeave, router])

  if (!ready || !signedIn) {
    return <p className="pt-16 flex items-center gap-2 text-ink-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Memuat…</p>
  }
  return <>{children}</>
}
