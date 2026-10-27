'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ExternalLink, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/AuthProvider'
import Avatar from '@/components/Avatar'
import RequireAuth from '@/components/RequireAuth'
import { deleteAccount, deleteGeminiKey, saveGeminiKey, saveNiche } from '@/lib/api'
import { CATEGORY_LABELS, NICHE_TOPICS } from '@/lib/niche'
import { safeNext } from '@/lib/supabase'
import { Me, NicheSetting } from '@/lib/types'

export default function SettingsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <Settings />
      </Suspense>
    </RequireAuth>
  )
}

function Settings() {
  const { enabled, me, refreshMe, signOut } = useAuth()
  const nextParam = useSearchParams().get('next')
  const backTo = nextParam ? safeNext(nextParam) : null
  const router = useRouter()

  if (!me) {
    return <p className="pt-16 flex items-center gap-2 text-ink-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Memuat…</p>
  }

  const remove = async () => {
    if (!confirm('Hapus akun? Riwayat, file upload, dan semua klip hasil render ikut terhapus permanen.')) return
    try {
      await deleteAccount()
      await signOut()
      toast.success('Akun dihapus')
      router.replace('/')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Akun gagal dihapus.')
    }
  }

  return (
    <div className="pt-12 max-w-2xl">
      <h1 className="type-display text-ink text-[clamp(2rem,4vw,2.75rem)]">Pengaturan</h1>

      <section aria-labelledby="account-title" className="mt-10 flex items-center gap-4">
        <Avatar me={me} />
        <div className="min-w-0">
          <h2 id="account-title" className="font-semibold text-ink truncate">{me.name}</h2>
          <p className="text-sm text-ink-muted truncate">{me.email || 'Mode lokal'}{me.is_admin && ', admin'}</p>
        </div>
      </section>

      <Usage me={me} />

      <Niche me={me} onSaved={refreshMe} />

      {enabled && <GeminiKey me={me} onSaved={refreshMe} backTo={backTo} />}

      {enabled && (
        <section aria-labelledby="leave-title" className="mt-12 border-t border-rule pt-8">
          <h2 id="leave-title" className="type-heading text-xl text-ink">Akun</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => signOut().then(() => router.replace('/'))} className="btn btn-quiet">Keluar</button>
            <button type="button" onClick={remove} className="btn text-tally hover:bg-tally/10">Hapus akun dan semua data</button>
          </div>
        </section>
      )}
    </div>
  )
}

function Niche({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const [value, setValue] = useState<NicheSetting>(me.niche)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(value) !== JSON.stringify(me.niche)

  const toggle = (topic: string) =>
    setValue(v => ({ ...v, topics: v.topics.includes(topic) ? v.topics.filter(t => t !== topic) : [...v.topics, topic] }))

  const save = async () => {
    setBusy(true)
    try {
      await saveNiche(value)
      onSaved()
      toast.success('Niche tersimpan')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Niche gagal disimpan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="niche-title" className="mt-12">
      <h2 id="niche-title" className="type-heading text-xl text-ink">Niche channel</h2>
      <p className="mt-1 text-sm text-ink-muted max-w-[60ch]">
        Momen di luar topik pilihanmu disembunyikan di hasil analisis (tetap bisa ditampilkan). Kalau tidak ada yang dipilih,
        semua momen ditampilkan.
      </p>
      <fieldset className="mt-4">
        <legend className="sr-only">Topik niche</legend>
        <div className="flex flex-wrap gap-2">
          {NICHE_TOPICS.map(topic => {
            const on = value.topics.includes(topic)
            return (
              <button key={topic} type="button" aria-pressed={on} onClick={() => toggle(topic)}
                className={`h-8 rounded-full border px-3 text-sm ${on ? 'border-signal bg-signal/15 text-ink' : 'border-rule text-ink-muted hover:text-ink'}`}>
                {CATEGORY_LABELS[topic]}
              </button>
            )
          })}
        </div>
      </fieldset>
      <label className="mt-4 flex items-start gap-3 text-sm">
        <input type="checkbox" checked={value.comedy} onChange={e => setValue(v => ({ ...v, comedy: e.target.checked }))}
          className="mt-0.5 size-4 accent-signal" />
        <span>
          <span className="text-ink">Sertakan momen lucu sebagai selingan</span>
          <span className="block text-ink-muted">Momen komedi tetap ditampilkan walau di luar niche, siapa tahu itu yang meledak.</span>
        </span>
      </label>
      <button type="button" onClick={save} disabled={busy || !dirty} className="btn btn-primary mt-4">
        {busy ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Menyimpan…</> : 'Simpan niche'}
      </button>
    </section>
  )
}

function Meter({ used, limit }: { used: number; limit: number }) {
  return (
    <div className="mt-2 flex gap-1" aria-hidden>
      {Array.from({ length: limit }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i < used ? 'bg-ink-faint' : 'bg-teal'}`} />
      ))}
    </div>
  )
}

function Usage({ me }: { me: Me }) {
  if (me.is_admin) {
    return (
      <section aria-labelledby="usage-title" className="mt-10 rounded-lg border border-rule glass p-5">
        <h2 id="usage-title" className="font-semibold text-ink">Jatah pemakaian</h2>
        <p className="mt-1 text-sm text-ink-muted">Admin: analisis dan render tanpa batas, termasuk render langsung dari link YouTube.</p>
      </section>
    )
  }
  const freeLimit = me.free_analyses_limit ?? 0
  const freeLeft = me.free_analyses_left ?? 0
  const renderLimit = me.render_daily_limit ?? 0
  const rendersToday = Math.min(me.renders_today ?? 0, renderLimit)

  return (
    <section aria-labelledby="usage-title" className="mt-10 rounded-lg border border-rule glass p-5 grid gap-6 sm:grid-cols-2">
      <h2 id="usage-title" className="sr-only">Jatah pemakaian</h2>
      <div>
        <p className="text-sm text-ink">Analisis gratis</p>
        <p className="text-sm text-ink-muted">
          {me.has_gemini_key ? 'Tidak dipakai lagi, analisis memakai API key milikmu.' : `${freeLeft} dari ${freeLimit} tersisa`}
        </p>
        <Meter used={freeLimit - freeLeft} limit={freeLimit} />
      </div>
      <div>
        <p className="text-sm text-ink">Render hari ini</p>
        <p className="text-sm text-ink-muted">{rendersToday} dari {renderLimit} klip, diatur ulang setiap hari</p>
        <Meter used={rendersToday} limit={renderLimit} />
      </div>
      <p className="sm:col-span-2 text-xs text-ink-muted">
        Render memakai file video yang kamu upload (maks {me.upload_max_mb} MB, {me.upload_max_minutes} menit).
      </p>
    </section>
  )
}

function GeminiKey({ me, onSaved, backTo }: { me: Me; onSaved: () => void; backTo: string | null }) {
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(!me.has_gemini_key)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    setBusy(true)
    setError(null)
    try {
      await saveGeminiKey(value.trim())
      setValue('')
      setEditing(false)
      setSaved(true)
      onSaved()
      toast.success('API key tersimpan')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API key gagal disimpan.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('Hapus API key? Analisis berikutnya kembali memakai jatah gratis (jika masih ada).')) return
    try {
      await deleteGeminiKey()
      setEditing(true)
      setSaved(false)
      onSaved()
      toast.success('API key dihapus')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'API key gagal dihapus.')
    }
  }

  return (
    <section aria-labelledby="key-title" className="mt-12">
      <h2 id="key-title" className="type-heading text-xl text-ink">API key Gemini</h2>
      <p className="mt-1 text-sm text-ink-muted max-w-[60ch]">
        Dipakai untuk analisis setelah jatah gratis habis, jadi analisismu tidak dibatasi jatah SlimerClip.
        Key disimpan terenkripsi dan hanya dipakai untuk analisis milikmu.
      </p>

      {me.has_gemini_key && !editing ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-rule glass px-4 py-3">
          <KeyRound className="size-4 text-teal" aria-hidden />
          <span className="text-sm text-ink">Tersimpan <span className="timecode text-ink-muted">••••{me.gemini_key_hint}</span></span>
          <span className="ml-auto flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className="btn btn-sm btn-quiet">Ganti</button>
            <button type="button" onClick={remove} className="btn btn-sm text-tally hover:bg-tally/10">Hapus</button>
          </span>
        </div>
      ) : (
        <form onSubmit={save} className="mt-5">
          <ol className="text-sm text-ink-muted space-y-1 list-decimal pl-5">
            <li>
              Buka{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-4 decoration-rule hover:decoration-ink-muted inline-flex items-center gap-1">
                Google AI Studio <ExternalLink className="size-3" aria-hidden />
              </a>{' '}
              dan masuk dengan akun Google.
            </li>
            <li>Pilih <span className="text-ink">Create API key</span>, lalu salin key-nya.</li>
            <li>Tempel di bawah. Key dicek ke Google sebelum disimpan.</li>
          </ol>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <label className="field h-11 flex-1">
              <span className="sr-only">API key Gemini</span>
              <input
                type="password"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="AIza…"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-transparent text-ink placeholder:text-ink-faint outline-none timecode"
              />
            </label>
            <button type="submit" disabled={busy || !value.trim()} className="btn btn-primary h-11">
              {busy ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Mengecek…</> : 'Simpan key'}
            </button>
            {me.has_gemini_key && (
              <button type="button" onClick={() => { setEditing(false); setError(null) }} className="btn btn-quiet h-11">Batal</button>
            )}
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-tally">{error}</p>}
        </form>
      )}

      {saved && backTo && (
        <Link href={backTo} className="mt-4 btn btn-primary">Lanjutkan analisis</Link>
      )}
    </section>
  )
}
