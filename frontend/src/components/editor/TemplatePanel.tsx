'use client'

import { useState } from 'react'
import { Check, Loader2, Trash2 } from 'lucide-react'
import type { EditTemplate } from '@/lib/types'

interface Props {
  templates: EditTemplate[]
  /** id format yang terakhir diterapkan di klip ini (penanda saja) */
  appliedId: string | null
  onApply: (template: EditTemplate) => void
  onSave: (name: string) => Promise<void>
  onDelete: (template: EditTemplate) => Promise<void>
}

/** Format edit tersimpan: terapkan ke klip ini, atau simpan pengaturan klip ini sebagai format baru. */
export default function TemplatePanel({ templates, appliedId, onApply, onSave, onDelete }: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const overwrite = templates.some(t => t.name.toLowerCase() === name.trim().toLowerCase())

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave(name.trim())
      setName('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 text-sm">
      {templates.length > 0 ? (
        <ul className="divide-y divide-rule rounded-md border border-rule">
          {templates.map(t => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-ink">{t.name}</span>
              {appliedId === t.id && <Check className="size-4 text-sage" aria-label="Diterapkan" />}
              <button type="button" onClick={() => onApply(t)} className="btn btn-sm btn-quiet">Terapkan</button>
              <button
                type="button"
                aria-label={`Hapus format ${t.name}`}
                disabled={deleting === t.id}
                onClick={async () => {
                  setDeleting(t.id)
                  try { await onDelete(t) } finally { setDeleting(null) }
                }}
                className="btn btn-sm px-2 text-ink-muted hover:text-tally"
              >
                {deleting === t.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">Belum ada format tersimpan.</p>
      )}

      <form onSubmit={e => { e.preventDefault(); save() }} className="flex gap-2">
        <input
          value={name}
          maxLength={40}
          onChange={e => setName(e.target.value)}
          placeholder="Nama format, mis. Gaya channel utama"
          aria-label="Nama format edit"
          className="h-9 min-w-0 flex-1 rounded-md border border-rule bg-bay px-3 text-ink focus:border-signal focus:outline-none"
        />
        <button type="submit" disabled={!name.trim() || saving} className="btn btn-sm btn-primary h-9 whitespace-nowrap">
          {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {overwrite ? 'Timpa format' : 'Simpan format'}
        </button>
      </form>
    </div>
  )
}
