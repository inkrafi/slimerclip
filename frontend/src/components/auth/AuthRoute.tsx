'use client'

import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { safeNext } from '@/lib/supabase'

interface AuthRouteProps {
  children: (next: string) => React.ReactNode
  /** Halaman tetap ditampilkan untuk pengguna yang sudah masuk (mis. atur ulang kata sandi) */
  allowSignedIn?: boolean
}

/** Halaman masuk/daftar: membaca ?next=, dan pengguna yang sudah masuk langsung diteruskan ke sana. */
export default function AuthRoute(props: AuthRouteProps) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  )
}

function Inner({ children, allowSignedIn = false }: AuthRouteProps) {
  const next = safeNext(useSearchParams().get('next'))
  const router = useRouter()
  const { enabled, ready, session } = useAuth()

  useEffect(() => {
    if (!allowSignedIn && ready && session) router.replace(next)
  }, [allowSignedIn, ready, session, next, router])

  if (!enabled) {
    return (
      <div className="pt-16 max-w-md">
        <h1 className="type-heading text-3xl text-ink">Login tidak aktif</h1>
        <p className="mt-2 text-ink-muted">Aplikasi berjalan dalam mode lokal, jadi semua fitur sudah bisa dipakai tanpa masuk.</p>
        <Link href={next} className="mt-6 btn btn-primary">Lanjutkan</Link>
      </div>
    )
  }
  return <>{children(next)}</>
}

/** URL kembali dari email (konfirmasi akun / atur ulang kata sandi). */
export const emailRedirect = (next: string) =>
  `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
