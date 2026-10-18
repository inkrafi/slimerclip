'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import AuthRoute, { emailRedirect } from '@/components/auth/AuthRoute'
import AuthShell, { AuthField, AuthLink } from '@/components/auth/AuthShell'
import { authErrorMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'

export default function SignInPage() {
  return <AuthRoute>{next => <SignIn next={next} />}</AuthRoute>
}

function SignIn({ next }: { next: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; unconfirmed: boolean } | null>(null)
  const [resent, setResent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) {
      setError({ message: authErrorMessage(signInError), unconfirmed: signInError.code === 'email_not_confirmed' })
      setBusy(false)
      return
    }
    router.replace(next)
  }

  const resend = async () => {
    if (!supabase) return
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup', email: email.trim(), options: { emailRedirectTo: emailRedirect(next) },
    })
    if (resendError) setError({ message: authErrorMessage(resendError), unconfirmed: true })
    else setResent(true)
  }

  return (
    <AuthShell
      title={next.startsWith('/video/') ? 'Masuk dulu, momennya kita cari setelah ini.' : 'Masuk ke SlimerClip'}
      intro="Riwayat dan klip hasil render tersimpan di akunmu, jadi bisa dibuka lagi dari perangkat mana pun."
      googleNext={next}
      footer={<>Belum punya akun? <AuthLink href={`/daftar?next=${encodeURIComponent(next)}`}>Daftar gratis</AuthLink></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        <div>
          <AuthField label="Kata sandi" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          <Link href={`/lupa-sandi?next=${encodeURIComponent(next)}`} className="mt-1.5 inline-block text-xs text-ink-muted underline underline-offset-4 decoration-rule hover:text-ink">
            Lupa kata sandi?
          </Link>
        </div>
        {error && (
          <div role="alert" className="text-sm text-tally">
            {error.message}
            {error.unconfirmed && !resent && (
              <button type="button" onClick={resend} className="ml-1 text-ink underline underline-offset-4">Kirim ulang email konfirmasi</button>
            )}
            {resent && <span className="block text-sage">Email konfirmasi dikirim ulang ke {email.trim()}.</span>}
          </div>
        )}
        <button type="submit" disabled={busy} className="btn btn-primary h-11 w-full">
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Masuk
        </button>
      </form>
    </AuthShell>
  )
}
