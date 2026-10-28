'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MailCheck } from 'lucide-react'
import AuthRoute, { emailRedirect } from '@/components/auth/AuthRoute'
import AuthShell, { AuthField, AuthLink } from '@/components/auth/AuthShell'
import { authErrorMessage, MIN_PASSWORD } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'
import { useCopy, useLocale } from '@/components/LocaleProvider'

const COPY = {
  id: {
    minPass: (n: number) => `Kata sandi minimal ${n} karakter.`, exists: 'Email ini sudah terdaftar. Silakan masuk.',
    checkTitle: 'Cek emailmu', checkIntro: (e: React.ReactNode) => <>Link konfirmasi sudah dikirim ke {e}. Buka link itu di browser ini untuk mengaktifkan akun.</>,
    wrongEmail: 'Salah alamat email?', changeEmail: 'Ubah email', spam: 'Belum masuk? Cek folder spam atau promosi.',
    resent: 'Email dikirim ulang.', resend: 'Kirim ulang',
    title: 'Buat akun gratis',
    intro: 'Akun baru langsung dapat 3 analisis gratis. Setelah itu, kamu bisa memakai API key Gemini milikmu sendiri, yang juga gratis dibuat di Google AI Studio.',
    haveAccount: 'Sudah punya akun?', signIn: 'Masuk', name: 'Nama', password: 'Kata sandi', hint: (n: number) => `Minimal ${n} karakter.`,
    submit: 'Buat akun',
  },
  en: {
    minPass: (n: number) => `Password must be at least ${n} characters.`, exists: 'This email is already registered. Please sign in.',
    checkTitle: 'Check your email', checkIntro: (e: React.ReactNode) => <>We sent a confirmation link to {e}. Open it in this browser to activate your account.</>,
    wrongEmail: 'Wrong email address?', changeEmail: 'Change email', spam: 'Nothing yet? Check your spam or promotions folder.',
    resent: 'Email sent again.', resend: 'Resend',
    title: 'Create a free account',
    intro: 'New accounts get 3 free analyses right away. After that you can use your own Gemini API key, which is also free to create in Google AI Studio.',
    haveAccount: 'Already have an account?', signIn: 'Sign in', name: 'Name', password: 'Password', hint: (n: number) => `At least ${n} characters.`,
    submit: 'Create account',
  },
}

export default function SignUpPage() {
  return <AuthRoute>{next => <SignUp next={next} />}</AuthRoute>
}

function SignUp({ next }: { next: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const { locale } = useLocale()
  const t = useCopy(COPY)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    if (password.length < MIN_PASSWORD) {
      setError(t.minPass(MIN_PASSWORD))
      return
    }
    setBusy(true)
    setError(null)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: emailRedirect(next), data: { full_name: name.trim() } },
    })
    setBusy(false)
    if (signUpError) {
      setError(authErrorMessage(signUpError, locale))
      return
    }
    // Konfirmasi email dimatikan → langsung masuk
    if (data.session) {
      router.replace(next)
      return
    }
    // Supabase tidak memberi error untuk email yang sudah terdaftar, tapi identities-nya kosong
    if (data.user && data.user.identities?.length === 0) {
      setError(t.exists)
      return
    }
    setSentTo(email.trim())
  }

  const resend = async () => {
    if (!supabase || !sentTo) return
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: sentTo, options: { emailRedirectTo: emailRedirect(next) } })
    if (resendError) setError(authErrorMessage(resendError, locale))
    else setResent(true)
  }

  if (sentTo) {
    return (
      <AuthShell
        title={t.checkTitle}
        intro={t.checkIntro(<span className="text-ink">{sentTo}</span>)}
        footer={<>{t.wrongEmail} <button type="button" onClick={() => { setSentTo(null); setResent(false) }} className="text-ink underline underline-offset-4 decoration-rule">{t.changeEmail}</button></>}
      >
        <div className="flex items-start gap-3 rounded-lg border border-rule glass p-4 text-sm text-ink-muted">
          <MailCheck className="size-5 shrink-0 text-teal" aria-hidden />
          <p>
            {t.spam}{' '}
            {resent
              ? <span className="text-sage">{t.resent}</span>
              : <button type="button" onClick={resend} className="text-ink underline underline-offset-4">{t.resend}</button>}
          </p>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-tally">{error}</p>}
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={t.title}
      intro={t.intro}
      googleNext={next}
      footer={<>{t.haveAccount} <AuthLink href={`/masuk?next=${encodeURIComponent(next)}`}>{t.signIn}</AuthLink></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <AuthField label={t.name} value={name} onChange={e => setName(e.target.value)} autoComplete="name" required maxLength={80} />
        <AuthField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        <AuthField
          label={t.password}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          hint={t.hint(MIN_PASSWORD)}
        />
        {error && <p role="alert" className="text-sm text-tally">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary h-11 w-full">
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {t.submit}
        </button>
      </form>
    </AuthShell>
  )
}
