'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/AuthProvider'
import AuthRoute from '@/components/auth/AuthRoute'
import AuthShell, { AuthField } from '@/components/auth/AuthShell'
import { authErrorMessage, MIN_PASSWORD } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'
import { useCopy, useLocale } from '@/components/LocaleProvider'

const COPY = {
  id: {
    expired: 'Link sudah tidak berlaku', expiredIntro: 'Link atur ulang kata sandi hanya bisa dipakai sekali dan berlaku sebentar.',
    newLink: 'Minta link baru', minPass: (n: number) => `Kata sandi minimal ${n} karakter.`, mismatch: 'Kedua kata sandi tidak sama.',
    updated: 'Kata sandi diperbarui', title: 'Buat kata sandi baru', forAccount: (e: React.ReactNode) => <>Untuk akun {e}.</>,
    newPass: 'Kata sandi baru', repeat: 'Ulangi kata sandi', hint: (n: number) => `Minimal ${n} karakter.`, submit: 'Simpan kata sandi',
  },
  en: {
    expired: 'This link has expired', expiredIntro: 'Password reset links work only once and for a short time.',
    newLink: 'Request a new link', minPass: (n: number) => `Password must be at least ${n} characters.`, mismatch: "The passwords don't match.",
    updated: 'Password updated', title: 'Set a new password', forAccount: (e: React.ReactNode) => <>For account {e}.</>,
    newPass: 'New password', repeat: 'Repeat password', hint: (n: number) => `At least ${n} characters.`, submit: 'Save password',
  },
}

export default function SetPasswordPage() {
  return <AuthRoute allowSignedIn>{next => <SetPassword next={next} />}</AuthRoute>
}

/** Kata sandi baru, dibuka dari link "lupa kata sandi" (link itu membuat sesi sementara). */
function SetPassword({ next }: { next: string }) {
  const router = useRouter()
  const { ready, session } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { locale } = useLocale()
  const t = useCopy(COPY)

  if (ready && !session) {
    return (
      <AuthShell title={t.expired} intro={t.expiredIntro}>
        <Link href="/lupa-sandi" className="btn btn-primary">{t.newLink}</Link>
      </AuthShell>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    if (password.length < MIN_PASSWORD) return setError(t.minPass(MIN_PASSWORD))
    if (password !== confirm) return setError(t.mismatch)
    setBusy(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) return setError(authErrorMessage(updateError, locale))
    toast.success(t.updated)
    router.replace(next)
  }

  return (
    <AuthShell title={t.title} intro={session?.user.email ? t.forAccount(<span className="text-ink">{session.user.email}</span>) : undefined}>
      <form onSubmit={submit} className="space-y-4">
        <AuthField label={t.newPass} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required minLength={MIN_PASSWORD} hint={t.hint(MIN_PASSWORD)} />
        <AuthField label={t.repeat} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required />
        {error && <p role="alert" className="text-sm text-tally">{error}</p>}
        <button type="submit" disabled={busy || !ready} className="btn btn-primary h-11 w-full">
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {t.submit}
        </button>
      </form>
    </AuthShell>
  )
}
