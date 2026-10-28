'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import AuthRoute, { emailRedirect } from '@/components/auth/AuthRoute'
import AuthShell, { AuthField, AuthLink } from '@/components/auth/AuthShell'
import { authErrorMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'
import { useCopy, useLocale } from '@/components/LocaleProvider'

const COPY = {
  id: {
    back: 'Kembali ke halaman masuk', checkTitle: 'Cek emailmu',
    sentIntro: (e: React.ReactNode) => <>Jika {e} terdaftar, link untuk membuat kata sandi baru sudah dikirim. Buka link itu di browser ini.</>,
    late: 'Belum masuk dalam beberapa menit? Cek folder spam, atau pastikan alamat emailnya benar.',
    title: 'Lupa kata sandi', intro: 'Masukkan email akunmu. Kami kirim link untuk membuat kata sandi baru.', submit: 'Kirim link',
  },
  en: {
    back: 'Back to sign in', checkTitle: 'Check your email',
    sentIntro: (e: React.ReactNode) => <>If {e} is registered, we sent a link to set a new password. Open it in this browser.</>,
    late: "Nothing after a few minutes? Check your spam folder, or make sure the email address is right.",
    title: 'Forgot password', intro: "Enter your account email. We'll send you a link to set a new password.", submit: 'Send link',
  },
}

export default function ForgotPasswordPage() {
  return <AuthRoute>{next => <ForgotPassword next={next} />}</AuthRoute>
}

function ForgotPassword({ next }: { next: string }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const { locale } = useLocale()
  const t = useCopy(COPY)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: emailRedirect(`/atur-sandi?next=${encodeURIComponent(next)}`),
    })
    setBusy(false)
    if (resetError) setError(authErrorMessage(resetError, locale))
    else setSent(true)
  }

  const backToSignIn = <AuthLink href={`/masuk?next=${encodeURIComponent(next)}`}>{t.back}</AuthLink>

  if (sent) {
    return (
      <AuthShell
        title={t.checkTitle}
        intro={t.sentIntro(<span className="text-ink">{email.trim()}</span>)}
        footer={backToSignIn}
      >
        <p className="text-sm text-ink-muted">{t.late}</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={t.title}
      intro={t.intro}
      footer={backToSignIn}
    >
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        {error && <p role="alert" className="text-sm text-tally">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary h-11 w-full">
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {t.submit}
        </button>
      </form>
    </AuthShell>
  )
}
