'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, ChevronDown, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { buildPrompts, emptyBrief, missingFields } from '@/lib/motion-prompts'
import type { MotionPrompt } from '@/lib/motion-prompts'
import type { MotionBrief, MotionProject } from '@/lib/types'

const inputClass = 'w-full bg-transparent text-ink placeholder:text-ink-faint outline-none'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-ink">{label}</span>
      <span className="field mt-1.5 min-h-11">{children}</span>
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2.5 text-sm text-ink">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="size-4 accent-signal" />
      {label}
    </label>
  )
}

function Group({ title, about, children }: { title: string; about?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-rule glass p-4 sm:p-5">
      <legend className="px-1 font-semibold text-ink">{title}</legend>
      {about && <p className="text-sm text-ink-muted">{about}</p>}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function CopyPrompt({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button type="button" className="btn btn-quiet min-h-11 shrink-0" onClick={() => {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
        .catch(() => toast.error('Prompt gagal disalin. Pilih teksnya lalu salin manual.'))
    }}>
      {copied ? <Check className="size-4 text-teal" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? 'Tersalin' : 'Salin'}
    </button>
  )
}

const STAGES: { id: MotionPrompt['stage']; title: string; about: string }[] = [
  { id: 'bahan', title: 'Stage 1: bahan', about: 'Mulai dari sini, dan periksa storyboard sebelum lanjut.' },
  { id: 'build', title: 'Stage 3: build', about: 'Lampirkan aset, lalu kirim.' },
  { id: 'fix', title: 'Perbaikan', about: 'Skill sudah mencegah masalah ini, jadi pakai hanya kalau masih muncul di hasil render.' },
  { id: 'polish', title: 'Polish', about: 'Disusun dari elemen video ini. Pilih yang memang menambah rasa.' },
  { id: 'revisi', title: 'Revisi', about: 'Dipakai setelah klien memberi masukan.' },
]

/** Pattern 3, Form: brief klien di atas, prompt yang dihasilkan di bawahnya. Prompt mengikuti isian secara langsung. */
export default function MotionBriefEditor({ project, onSave }: {
  project: MotionProject
  onSave: (product: string, brief: MotionBrief) => Promise<unknown>
}) {
  const [product, setProduct] = useState(project.product)
  const [brief, setBrief] = useState<MotionBrief>({ ...emptyBrief(project.package), ...project.brief })
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  const set = <K extends keyof MotionBrief>(key: K, value: MotionBrief[K]) => {
    setBrief(b => ({ ...b, [key]: value }))
    setDirty(true)
  }
  const text = (key: { [K in keyof MotionBrief]: MotionBrief[K] extends string ? K : never }[keyof MotionBrief], max = 300) => ({
    value: brief[key] as string,
    maxLength: max,
    autoComplete: 'off',
    className: inputClass,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value),
  })

  const prompts = useMemo(() => buildPrompts(product, project.deadline, brief), [product, project.deadline, brief])
  const missing = useMemo(() => missingFields(product, project.deadline, brief), [product, project.deadline, brief])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      await onSave(product, brief)
      setDirty(false)
      toast.success('Brief disimpan.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Brief gagal disimpan. Isianmu masih ada, coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl pt-12 pb-16">
      <Link href={`/proyek-motion/${project.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {project.client}
      </Link>
      <h1 className="mt-2 type-heading text-3xl text-ink">Brief dan prompt</h1>
      <p className="mt-2 text-ink-muted">Isi dari jawaban klien, boleh bertahap. Prompt di bawah ikut berubah sesuai isianmu.</p>

      <form onSubmit={save} noValidate className="mt-6 space-y-5">
        <Group title="Produk">
          <Field label="Nama produk"><input value={product} maxLength={80} autoComplete="off" className={inputClass} onChange={e => { setProduct(e.target.value); setDirty(true) }} /></Field>
          <Field label="Audiens" hint="Jabatan dan ukuran perusahaan."><input {...text('audience')} /></Field>
          <div className="sm:col-span-2">
            <Field label="Fungsi produk" hint="Satu kalimat: siapa yang dibantu dan apa yang diambil alih."><input {...text('what_it_is')} /></Field>
          </div>
        </Group>

        <Group title="Pesan">
          <Field label="Tujuan video" hint="Mis. Product Hunt, hero website, iklan sosial."><input {...text('goal')} /></Field>
          <Field label="Bahasa teks di video"><input {...text('language', 40)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Pesan utama" hint="Satu kalimat yang harus diingat penonton."><input {...text('message')} /></Field>
          </div>
          <div className="sm:col-span-2"><Field label="Nada video"><input {...text('tone')} /></Field></div>
        </Group>

        <Group title="Isi video" about="Lima bagian ini menjadi lima adegan di storyboard.">
          <Field label="Hook" hint="Rasa sakitnya dalam satu gambar."><input {...text('hook')} /></Field>
          <Field label="Masalah" hint="Yang dilakukan pengguna sekarang, dan kenapa menyiksa."><input {...text('problem')} /></Field>
          <Field label="Fitur utama" hint="Yang ditampilkan di UI asli."><input {...text('feature')} /></Field>
          <Field label="Hasil akhir" hint="Keadaan setelah produk bekerja."><input {...text('payoff')} /></Field>
          <Field label="CTA" hint="Mis. Live on Product Hunt · produk.com"><input {...text('cta')} /></Field>
          <Field label="Tagline (opsional)"><input {...text('tagline', 120)} /></Field>
        </Group>

        <Group title="Elemen animasi" about="Menentukan fix dan polish yang muncul. Kosongkan kalau videonya tidak punya elemen itu.">
          <Field label="Penghitung angka" hint="Mis. task counter."><input {...text('counter', 60)} /></Field>
          <Field label="Warna pendar penghitung" hint="Merah untuk masalah, warna brand untuk hasil baik."><input {...text('glow', 30)} /></Field>
          <Field label="Kartu atau baris berulang" hint="Mis. agent cards."><input {...text('cards', 60)} /></Field>
          <Field label="Tampilan akhir" hint="Mis. the whole board clear."><input {...text('payoff_view', 80)} /></Field>
          <div className="sm:col-span-2"><Toggle label="Kursor berpindah antar tab di adegan masalah" checked={brief.cursor_tabs} onChange={v => set('cursor_tabs', v)} /></div>
        </Group>

        <Group title="Aset dari klien" about="Yang belum ada akan dimintakan lewat prompt aset.">
          <Field label="Sumber UI" hint="UI harus SVG supaya tetap tajam saat kamera mendekat.">
            <select value={brief.ui_source} onChange={e => set('ui_source', e.target.value as MotionBrief['ui_source'])} className={inputClass}>
              <option value="figma">File Figma</option>
              <option value="screenshots">Hanya screenshot</option>
              <option value="none">Belum ada</option>
            </select>
          </Field>
          <Field label="Warna brand" hint="Kode hex. Kosongkan kalau belum ada."><input {...text('colors', 120)} /></Field>
          <Field label="Font" hint="Kosongkan kalau belum ada."><input {...text('fonts', 120)} /></Field>
          <div>
            <Toggle label="Logo SVG sudah ada" checked={brief.has_logo} onChange={v => set('has_logo', v)} />
            <Toggle label="Gambar latar sudah ada" checked={brief.has_backgrounds} onChange={v => set('has_backgrounds', v)} />
          </div>
        </Group>

        <Group title="Format" about="Awalnya mengikuti paket proyek. Panduan aslinya memakai 30 detik.">
          <Field label="Durasi">
            <select value={brief.seconds} onChange={e => set('seconds', Number(e.target.value))} className={inputClass}>
              {[15, 30, 45, 60].map(s => <option key={s} value={s}>{s} detik</option>)}
            </select>
          </Field>
          <div>
            <Toggle label="Potongan vertikal 9:16" checked={brief.cut_vertical} onChange={v => set('cut_vertical', v)} />
            <Toggle label="Potongan persegi 1:1" checked={brief.cut_square} onChange={v => set('cut_square', v)} />
          </div>
        </Group>

        <Group title="Revisi klien" about="Isi saat ada masukan, satu perubahan per prompt.">
          <div className="sm:col-span-2"><Field label="Yang ingin diubah" hint="Mis. penghitung naik sampai 999, bukan 200."><input {...text('revision')} /></Field></div>
        </Group>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary h-11 px-6">
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Simpan brief
          </button>
          <span className="text-sm text-ink-muted" aria-live="polite">{dirty ? 'Ada perubahan yang belum disimpan.' : 'Tersimpan.'}</span>
        </div>
      </form>

      <section className="mt-10" aria-labelledby="prompt-heading">
        <h2 id="prompt-heading" className="type-heading text-2xl text-ink">Prompt</h2>
        <p className="mt-2 text-ink-muted">Pasang skill <code className="text-ink">launch-motion</code>, lalu kirim berurutan dalam satu chat Claude.</p>
        {missing.length > 0 && (
          <p className="mt-3 rounded-md border border-rule bg-panel p-3 text-sm text-ink">
            Masih kosong: {missing.join(', ')}. Bagian ini tampil sebagai [tanda kurung], dan Claude akan menanyakannya.
          </p>
        )}
        {STAGES.map(stage => {
          const items = prompts.filter(p => p.stage === stage.id)
          if (!items.length) return null
          return (
            <div key={stage.id} className="mt-6">
              <h3 className="font-semibold text-ink">{stage.title}</h3>
              <p className="text-sm text-ink-muted">{stage.about}</p>
              <ul className="mt-2 divide-y divide-rule rounded-lg border border-rule glass">
                {items.map(prompt => (
                  <li key={prompt.id} className="p-3 sm:px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 py-1">
                        <p className="font-medium text-ink">{prompt.title}</p>
                        <p className="text-sm text-ink-muted">{prompt.about}</p>
                      </div>
                      <CopyPrompt text={prompt.text} />
                    </div>
                    <details className="group mt-1">
                      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden /> Lihat prompt
                      </summary>
                      <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border border-rule bg-bay p-3 font-sans text-sm text-ink">{prompt.text}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>
    </div>
  )
}
