'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import GoogleMark from '@/components/GoogleMark'
import { authErrorMessage } from '@/lib/auth-errors'
import { safeNext } from '@/lib/supabase'

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignIn />
    </Suspense>
  )
}

/** Login admin: hanya lewat Google, karena backend hanya mengakui admin dari sesi Google. Tidak ditautkan dari mana pun. */
function SignIn() {
  const params = useSearchParams()
  const next = safeNext(params.get('next'))
  const denied = params.get('ditolak') === '1'
  const router = useRouter()
  const { enabled, ready, session, signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ready && session) router.replace(next)
  }, [ready, session, next, router])

  const google = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle(next)  // browser berpindah ke halaman Google
    } catch (e) {
      setError(authErrorMessage(e, 'id'))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-rule glass p-6">
      <h1 className="type-heading text-2xl text-ink">Masuk admin</h1>
      {enabled ? (
        <>
          <p className="mt-2 text-sm text-ink-muted">Pakai akun Google yang terdaftar sebagai admin.</p>
          <button type="button" onClick={google} disabled={busy} className="mt-6 btn h-11 w-full bg-white text-[#1f1f1f] hover:bg-white/90 font-semibold">
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <GoogleMark />}
            Lanjutkan dengan Google
          </button>
          {denied && !error && <p role="alert" className="mt-3 text-sm text-tally">Akun tadi tidak punya akses admin. Coba masuk dengan akun Google lain.</p>}
          {error && <p role="alert" className="mt-3 text-sm text-tally">{error}</p>}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-muted">Aplikasi berjalan dalam mode lokal, jadi semua fitur bisa dipakai tanpa masuk.</p>
          <Link href={next} className="mt-6 btn btn-primary">Lanjutkan</Link>
        </>
      )}
    </div>
  )
}
