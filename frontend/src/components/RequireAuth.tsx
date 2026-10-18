'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

/** Halaman yang butuh login: belum login → diarahkan ke /masuk, lalu kembali ke halaman ini. */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, signedIn } = useAuth()
  const router = useRouter()
  const pathname = usePathname() || '/'
  const mustSignIn = ready && !signedIn

  useEffect(() => {
    if (mustSignIn) router.replace(`/masuk?next=${encodeURIComponent(pathname)}`)
  }, [mustSignIn, router, pathname])

  if (!ready || !signedIn) {
    return <p className="pt-16 flex items-center gap-2 text-ink-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Memuat…</p>
  }
  return <>{children}</>
}
