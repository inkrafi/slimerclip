'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { safeNext, supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  )
}

/**
 * Tujuan redirect setelah login Google. supabase-js menukar `?code=` menjadi sesi secara
 * otomatis saat dimuat (PKCE); halaman ini menunggu sesinya lalu lanjut ke tujuan awal.
 */
function Callback() {
  const params = useSearchParams()
  const router = useRouter()
  const next = safeNext(params.get('next'))
  const providerError = params.get('error_description')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (providerError || !supabase) return
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (data.session) router.replace(next)
      else setError(sessionError?.message ?? 'Login belum selesai. Coba masuk lagi.')
    })
  }, [providerError, next, router])

  const message = providerError || error
  if (message) {
    return (
      <div className="pt-16 max-w-md">
        <h1 className="type-heading text-2xl text-ink">Login tidak berhasil</h1>
        <p role="alert" className="mt-2 text-ink-muted">{message}</p>
        <p className="mt-2 text-sm text-ink-muted">
          Jika ini link konfirmasi email yang dibuka di browser atau perangkat lain, akunmu kemungkinan sudah aktif.
          Silakan masuk dengan email dan kata sandimu.
        </p>
        <Link href={`/masuk?next=${encodeURIComponent(next)}`} className="mt-6 btn btn-primary">Masuk</Link>
      </div>
    )
  }

  return (
    <p className="pt-16 flex items-center gap-2 text-ink-muted" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Menyelesaikan login…
    </p>
  )
}
