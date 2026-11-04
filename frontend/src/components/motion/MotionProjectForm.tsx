'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { createMotionProject, deleteMotionProject, getMotionProjects, updateMotionProject } from '@/lib/api'
import { MOTION_PACKAGES, MOTION_STATUSES } from '@/lib/motion'
import type { MotionProjectInput } from '@/lib/types'

const EMPTY: MotionProjectInput = { client: '', product: '', package: 'launch', status: 'konsultasi', deadline: '', price: '', drive_url: '', notes: '' }
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-ink">{label}</span>
      <span className={`field mt-1.5 min-h-11 ${error ? 'border-tally' : ''}`}>{children}</span>
      {hint && !error && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs text-tally">{error}</span>}
    </label>
  )
}

type FieldErrors = { client?: string; drive_url?: string }

const clientError = (value: string) => (value.trim() ? undefined : 'Isi nama klien, supaya proyeknya mudah dicari.')
const urlError = (value: string) => (!value.trim() || /^https?:\/\//i.test(value.trim()) ? undefined : 'Tempel tautan lengkap yang diawali https://.')

const inputClass = 'w-full bg-transparent text-ink placeholder:text-ink-faint outline-none'

/** Pattern 3, Form: tambah proyek (tanpa projectId) atau ubah proyek yang ada. */
export default function MotionProjectForm({ projectId }: { projectId?: string }) {
  const router = useRouter()
  const [form, setForm] = useState<MotionProjectInput | null>(projectId ? null : EMPTY)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    getMotionProjects().then(items => {
      if (cancelled) return
      const found = items.find(p => p.id === projectId)
      if (found) setForm(found)
      else setLoadError('Proyek ini tidak ditemukan. Mungkin sudah dihapus.')
    }).catch(e => { if (!cancelled) setLoadError(message(e, 'Proyek gagal dimuat.')) })
    return () => { cancelled = true }
  }, [projectId])

  const set = <K extends keyof MotionProjectInput>(key: K, value: MotionProjectInput[K]) =>
    setForm(f => (f ? { ...f, [key]: value } : f))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const errors = { client: clientError(form.client), drive_url: urlError(form.drive_url) }
    setFieldErrors(errors)
    if (errors.client || errors.drive_url) return
    setBusy(true)
    setError(null)
    try {
      if (projectId) {
        await updateMotionProject(projectId, form)
        toast.success('Proyek disimpan.')
        router.push('/proyek-motion')
      } else {
        const project = await createMotionProject(form)
        toast.success('Proyek ditambahkan. Lanjut isi brief dari klien.')
        router.push(`/proyek-motion/${project.id}/brief`)
      }
    } catch (err) {
      setError(message(err, 'Proyek gagal disimpan. Coba lagi.'))
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!projectId) return
    setConfirming(false)
    setBusy(true)
    try {
      await deleteMotionProject(projectId)
      toast.success('Proyek dihapus.')
      router.push('/proyek-motion')
    } catch (err) {
      setError(message(err, 'Proyek gagal dihapus. Coba lagi.'))
      setBusy(false)
    }
  }

  return (
    <div className="pt-12 max-w-2xl">
      <Link href="/proyek-motion" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Proyek motion
      </Link>
      <h1 className="mt-2 type-heading text-3xl text-ink">{projectId ? form?.client || 'Proyek' : 'Tambah proyek'}</h1>

      {projectId && form && (
        <Link href={`/proyek-motion/${projectId}/brief`} className="btn btn-quiet mt-3 -ml-2 min-h-11">
          <FileText className="size-4" aria-hidden /> Brief dan prompt
        </Link>
      )}

      {loadError && <p role="alert" className="mt-6 text-tally">{loadError}</p>}
      {!form && !loadError && <div className="mt-6 space-y-4" aria-hidden>{[0, 1, 2].map(i => <div key={i} className="skeleton h-11 rounded" />)}</div>}

      {form && (
        <form onSubmit={submit} noValidate className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nama klien" error={fieldErrors.client}>
              <input required aria-invalid={Boolean(fieldErrors.client)} maxLength={80} value={form.client} autoComplete="off" className={inputClass}
                onChange={e => { set('client', e.target.value); setFieldErrors(f => ({ ...f, client: undefined })) }}
                onBlur={e => setFieldErrors(f => ({ ...f, client: clientError(e.target.value) }))} />
            </Field>
            <Field label="Produk (opsional)">
              <input maxLength={80} value={form.product} onChange={e => set('product', e.target.value)} autoComplete="off" className={inputClass} />
            </Field>
            <Field label="Paket">
              <select value={form.package} onChange={e => set('package', e.target.value as MotionProjectInput['package'])} className={inputClass}>
                {MOTION_PACKAGES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => set('status', e.target.value as MotionProjectInput['status'])} className={inputClass}>
                {MOTION_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Tenggat (opsional)">
              <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Harga disepakati (opsional)" hint="Tulis dengan mata uangnya, mis. Rp7,5 jt atau $1.190.">
              <input maxLength={40} value={form.price} onChange={e => set('price', e.target.value)} autoComplete="off" className={inputClass} />
            </Field>
          </div>
          <Field label="Tautan hasil di Google Drive (opsional)" error={fieldErrors.drive_url}>
            <input type="url" aria-invalid={Boolean(fieldErrors.drive_url)} maxLength={500} value={form.drive_url} placeholder="https://drive.google.com/…" className={inputClass}
              onChange={e => { set('drive_url', e.target.value); setFieldErrors(f => ({ ...f, drive_url: undefined })) }}
              onBlur={e => setFieldErrors(f => ({ ...f, drive_url: urlError(e.target.value) }))} />
          </Field>
          {form.drive_url.startsWith('http') && (
            <a href={form.drive_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-muted underline underline-offset-4 hover:text-ink">
              Buka tautan <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          <Field label="Catatan (opsional)">
            <textarea rows={5} maxLength={2000} value={form.notes} onChange={e => set('notes', e.target.value)} className={`${inputClass} py-2.5 resize-y`} />
          </Field>

          {error && <p role="alert" className="text-sm text-tally">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button type="submit" disabled={busy} className="btn btn-primary h-11 px-6">
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {projectId ? 'Simpan proyek' : 'Tambah proyek'}
            </button>
            {projectId && (
              <button type="button" disabled={busy} onClick={() => setConfirming(true)} className="btn h-11 text-tally hover:bg-raised">Hapus proyek</button>
            )}
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirming}
        title={`Hapus proyek "${form?.client ?? ''}"?`}
        body="Catatan proyek ini akan hilang dan tidak bisa dikembalikan. File di Google Drive tidak ikut terhapus."
        confirmLabel="Hapus proyek"
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
