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

  if (ready && !session) {
    return (
      <AuthShell title="Link sudah tidak berlaku" intro="Link atur ulang kata sandi hanya bisa dipakai sekali dan berlaku sebentar.">
        <Link href="/lupa-sandi" className="btn btn-primary">Minta link baru</Link>
      </AuthShell>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    if (password.length < MIN_PASSWORD) return setError(`Kata sandi minimal ${MIN_PASSWORD} karakter.`)
    if (password !== confirm) return setError('Kedua kata sandi tidak sama.')
    setBusy(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) return setError(authErrorMessage(updateError))
    toast.success('Kata sandi diperbarui')
    router.replace(next)
  }

  return (
    <AuthShell title="Buat kata sandi baru" intro={session?.user.email ? <>Untuk akun <span className="text-ink">{session.user.email}</span>.</> : undefined}>
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Kata sandi baru" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required minLength={MIN_PASSWORD} hint={`Minimal ${MIN_PASSWORD} karakter.`} />
        <AuthField label="Ulangi kata sandi" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required />
        {error && <p role="alert" className="text-sm text-tally">{error}</p>}
        <button type="submit" disabled={busy || !ready} className="btn btn-primary h-11 w-full">
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Simpan kata sandi
        </button>
      </form>
    </AuthShell>
  )
}
