'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import GoogleMark from '@/components/GoogleMark'
import { authErrorMessage } from '@/lib/auth-errors'

interface AuthShellProps {
  title: string
  intro?: React.ReactNode
  /** Tujuan setelah login; tampilkan tombol Google jika diisi */
  googleNext?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

/** Kerangka halaman masuk/daftar: judul, tombol Google, pemisah, lalu form email. */
export default function AuthShell({ title, intro, googleNext, children, footer }: AuthShellProps) {
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const google = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle(googleNext)  // browser berpindah ke halaman Google
    } catch (e) {
      setError(authErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="pt-14 md:pt-20 pb-8 max-w-md">
      <h1 className="type-display text-ink text-[clamp(2rem,4vw,2.6rem)]">{title}</h1>
      {intro && <div className="mt-3 text-ink-muted leading-relaxed">{intro}</div>}

      {googleNext !== undefined && (
        <>
          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="mt-8 btn h-11 w-full bg-white text-[#1f1f1f] hover:bg-white/90 font-semibold"
          >
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <GoogleMark />}
            Lanjutkan dengan Google
          </button>
          {error && <p role="alert" className="mt-2 text-sm text-tally">{error}</p>}
          <div className="my-6 flex items-center gap-3 text-xs text-ink-faint" aria-hidden>
            <span className="h-px flex-1 bg-rule" />
            atau dengan email
            <span className="h-px flex-1 bg-rule" />
          </div>
        </>
      )}

      <div className={googleNext === undefined ? 'mt-8' : ''}>{children}</div>
      {footer && <div className="mt-6 text-sm text-ink-muted">{footer}</div>}
    </div>
  )
}

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string
  hint?: string
}

export function AuthField({ label, hint, type = 'text', ...input }: FieldProps) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  return (
    <label className="block">
      <span className="text-sm text-ink">{label}</span>
      <span className="field h-11 mt-1.5">
        <input
          {...input}
          type={isPassword && visible ? 'text' : type}
          className="w-full bg-transparent text-ink placeholder:text-ink-faint outline-none"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            className="text-ink-muted hover:text-ink"
            aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        )}
      </span>
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  )
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-ink underline underline-offset-4 decoration-rule hover:decoration-ink-muted">
      {children}
    </Link>
  )
}
