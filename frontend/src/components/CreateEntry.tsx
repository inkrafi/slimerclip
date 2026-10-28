'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Film, Scissors, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import AnalyzeForm from '@/components/AnalyzeForm'
import ClipProfileFields, { useClipProfileOptions } from '@/components/ClipProfileFields'
import { useAuth } from '@/components/AuthProvider'
import { deleteClientPreset, getClientPresets, getTemplates, saveClientPreset } from '@/lib/api'
import { profileSummary, sameProfile, saveProfile, setActivePreset, useActivePreset, useStoredProfile } from '@/lib/clipProfile'
import type { ClientPreset, EditTemplate } from '@/lib/types'

interface Props {
  /** Mode klip: link YouTube → kembalikan pesan error, atau kosong jika valid */
  onSubmit: (url: string) => string | void
}

type Mode = 'clips' | 'longform'

const MODES: { id: Mode; label: string; icon: typeof Scissors }[] = [
  { id: 'clips', label: 'Klip dari podcast', icon: Scissors },
  { id: 'longform', label: 'Video panjang dari topik', icon: Film },
]

/**
 * Pintu masuk Ruang kerja. Pengguna biasa: kolom link YouTube (klip 9:16).
 * Admin: pilih mode — klip dari podcast, atau video panjang tanpa wajah dari topik/isu yang sedang ramai.
 */
export default function CreateEntry({ onSubmit }: Props) {
  const { me } = useAuth()
  const [mode, setMode] = useState<Mode>('clips')
  if (!me?.is_admin) return <AnalyzeForm onSubmit={onSubmit} isLoading={false} size="lg" />

  return (
    <div>
      <div role="tablist" aria-label="Yang ingin dibuat" className="mb-3 inline-flex rounded-lg border border-rule bg-bay/60 p-1 text-sm">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} aria-controls={`create-${id}`} onClick={() => setMode(id)}
            className={`flex h-9 items-center gap-2 rounded-md px-3.5 ${mode === id ? 'bg-raised text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      <div id={`create-${mode}`} role="tabpanel">
        {mode === 'clips' ? <><AnalyzeForm onSubmit={onSubmit} isLoading={false} size="lg" /><ProfilePanel /></> : <TopicForm />}
      </div>
    </div>
  )
}

/**
 * Profil analisis (admin): diingat di browser dan dipakai saat video berikutnya dianalisis.
 * Preset klien = profil + format edit yang biasa dipakai untuk klien itu (format edit jadi pilihan awal "render semua").
 */
function ProfilePanel() {
  const profile = useStoredProfile()
  const options = useClipProfileOptions()
  const active = useActivePreset()
  const [presets, setPresets] = useState<ClientPreset[] | null>(null)
  const [templates, setTemplates] = useState<EditTemplate[]>([])
  const [saving, setSaving] = useState<{ name: string; template_id: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getClientPresets().then(setPresets).catch(() => setPresets([]))
    getTemplates().then(setTemplates).catch(() => {})
  }, [])

  const choose = (id: string) => setActivePreset(presets?.find(p => p.id === id) ?? null)
  const changed = !!active && !sameProfile(active.profile, profile)

  const save = async () => {
    if (!saving?.name.trim()) return
    setBusy(true)
    try {
      const preset = await saveClientPreset({ name: saving.name, profile, template_id: saving.template_id })
      setPresets(prev => [preset, ...(prev ?? []).filter(p => p.id !== preset.id)])
      setActivePreset(preset)
      setSaving(null)
      toast.success(`Preset "${preset.name}" disimpan`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preset gagal disimpan.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!active || !confirm(`Hapus preset klien "${active.name}"?`)) return
    try {
      await deleteClientPreset(active.id)
      setPresets(prev => prev?.filter(p => p.id !== active.id) ?? null)
      setActivePreset(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preset gagal dihapus.')
    }
  }

  return (
    <details className="group mt-3 rounded-lg border border-rule bg-bay/40 px-4 py-2.5 text-sm">
      <summary className="cursor-pointer list-none text-ink-muted marker:hidden">
        <span className="text-ink">Pengaturan klip</span>
        {active && <span className="ml-2 rounded bg-raised px-1.5 py-0.5 text-xs text-ink">{active.name}{changed ? ' (diubah)' : ''}</span>}
        <span className="ml-2">{profileSummary(profile, options)}</span>
        <span className="ml-2 underline underline-offset-4 group-open:hidden">Ubah</span>
      </summary>
      <div className="mt-3 space-y-4 pb-1">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-48 text-sm">
            <span className="text-ink-muted">Klien</span>
            <select value={active?.id ?? ''} onChange={e => choose(e.target.value)}
              className="mt-1 block h-9 w-full rounded-md border border-rule bg-bay px-2 text-sm text-ink focus:border-signal focus:outline-none">
              <option value="">Tanpa preset</option>
              {presets?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {!saving && (
            <button type="button" className="btn btn-sm btn-quiet"
              onClick={() => setSaving({ name: active?.name ?? '', template_id: active?.template_id ?? '' })}>
              {active && changed ? 'Perbarui preset' : 'Simpan sebagai preset'}
            </button>
          )}
          {active && !saving && <button type="button" onClick={remove} className="btn btn-sm btn-quiet">Hapus preset</button>}
        </div>
        {saving && (
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-rule p-3">
            <label className="block text-sm">
              <span className="text-ink-muted">Nama klien</span>
              <input value={saving.name} maxLength={40} autoFocus onChange={e => setSaving({ ...saving, name: e.target.value })}
                placeholder="Mis. Podcast Pak Budi"
                className="mt-1 block h-9 w-56 rounded-md border border-rule bg-bay px-2 text-sm text-ink focus:border-signal focus:outline-none" />
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">Format edit (untuk render semua)</span>
              <select value={saving.template_id} onChange={e => setSaving({ ...saving, template_id: e.target.value })}
                className="mt-1 block h-9 w-56 rounded-md border border-rule bg-bay px-2 text-sm text-ink focus:border-signal focus:outline-none">
                <option value="">Tidak ditentukan</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <button type="button" onClick={save} disabled={busy || !saving.name.trim()} className="btn btn-sm btn-primary">Simpan</button>
            <button type="button" onClick={() => setSaving(null)} className="btn btn-sm btn-quiet">Batal</button>
            <p className="w-full text-xs text-ink-faint">Menyimpan pengaturan klip di bawah ini. Format edit dibuat di editor klip (Simpan format edit).</p>
          </div>
        )}
        <ClipProfileFields value={profile} onChange={saveProfile} options={options} />
      </div>
    </details>
  )
}

function TopicForm() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/longform?q=${encodeURIComponent(q)}` : '/longform')
  }
  return (
    <form onSubmit={go}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="field h-14 flex-1">
          <span className="sr-only">Topik atau kata kunci</span>
          <input value={query} maxLength={100} onChange={e => setQuery(e.target.value)}
            placeholder="Kata kunci (opsional), mis. saham, AI, PHK"
            className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-faint" />
        </label>
        <button type="submit" className="btn btn-primary h-14 px-6">
          <Sparkles className="size-4" aria-hidden /> {query.trim() ? 'Cari topik' : 'Lihat rekomendasi topik'}
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-muted">Rekomendasi topik terbaru sesuai niche channelmu sudah disiapkan, tinggal pilih.</p>
    </form>
  )
}
