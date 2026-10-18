'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import AuthRoute, { emailRedirect } from '@/components/auth/AuthRoute'
import AuthShell, { AuthField, AuthLink } from '@/components/auth/AuthShell'
import { authErrorMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  return <AuthRoute>{next => <ForgotPassword next={next} />}</AuthRoute>
}

function ForgotPassword({ next }: { next: string }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: emailRedirect(`/atur-sandi?next=${encodeURIComponent(next)}`),
    })
    setBusy(false)
    if (resetError) setError(authErrorMessage(resetError))
    else setSent(true)
  }

  const backToSignIn = <AuthLink href={`/masuk?next=${encodeURIComponent(next)}`}>Kembali ke halaman masuk</AuthLink>

  if (sent) {
    return (
      <AuthShell
        title="Cek emailmu"
        intro={<>Jika <span className="text-ink">{email.trim()}</span> terdaftar, link untuk membuat kata sandi baru sudah dikirim. Buka link itu di browser ini.</>}
        footer={backToSignIn}
      >
        <p className="text-sm text-ink-muted">Belum masuk dalam beberapa menit? Cek folder spam, atau pastikan alamat emailnya benar.</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Lupa kata sandi"
      intro="Masukkan email akunmu. Kami kirim link untuk membuat kata sandi baru."
      footer={backToSignIn}
    >
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        {error && <p role="alert" className="text-sm text-tally">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary h-11 w-full">
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Kirim link
        </button>
      </form>
    </AuthShell>
  )
}
