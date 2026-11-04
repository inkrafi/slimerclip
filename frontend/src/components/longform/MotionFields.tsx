'use client'

import type { LongformMotion, LongformMotionTemplate } from '@/lib/types'

const TEMPLATES: { id: LongformMotionTemplate | ''; label: string }[] = [
  { id: '', label: 'Tanpa animasi' },
  { id: 'kinetic', label: 'Teks kinetik' },
  { id: 'data', label: 'Grafik angka' },
  { id: 'compare', label: 'Perbandingan' },
  { id: 'flow', label: 'Alur langkah' },
]

const EMPTY: Record<LongformMotionTemplate, LongformMotion> = {
  kinetic: { template: 'kinetic', lead: '', words: [''], note: '' },
  data: { template: 'data', title: '', values: [], prefix: '', suffix: '', caption: '', note: '' },
  compare: { template: 'compare', left: { title: '', items: [''] }, right: { title: '', items: [''] } },
  flow: { template: 'flow', title: '', steps: [{ head: '', body: '' }, { head: '', body: '' }] },
}

const inputClass = 'h-11 sm:h-9 w-full rounded-md border border-rule bg-bay px-2 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none disabled:opacity-60'

function Field({ label, value, max, disabled, placeholder, onChange }: {
  label: string; value: string; max: number; disabled: boolean; placeholder?: string; onChange: (value: string) => void
}) {
  return (
    <label className="block text-xs text-ink-muted">
      {label}
      <input value={value} maxLength={max} disabled={disabled} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={`mt-1 ${inputClass}`} />
    </label>
  )
}

const lines = (value: string) => value.split('\n')

/** Pilihan animasi satu adegan. Isinya harus sesuai narasi, karena tampil di video apa adanya. */
export default function MotionFields({ motion, disabled, onChange }: {
  motion: LongformMotion | null | undefined; disabled: boolean; onChange: (motion: LongformMotion | null) => void
}) {
  const template = motion?.template ?? ''
  return (
    <div className="mt-3 border-t border-rule pt-3">
      <label className="block text-xs text-ink-muted">
        Animasi di atas video
        <select value={template} disabled={disabled} onChange={e => onChange(e.target.value ? EMPTY[e.target.value as LongformMotionTemplate] : null)} className={`mt-1 ${inputClass}`}>
          {TEMPLATES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      {motion && <p className="mt-1 text-xs text-ink-faint">Isi sesuai narasi. Animasi yang belum lengkap tidak dipakai saat disimpan.</p>}

      {motion?.template === 'kinetic' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Teks kecil (opsional)" value={motion.lead} max={40} disabled={disabled} onChange={lead => onChange({ ...motion, lead })} />
          <Field label="Catatan bawah (opsional)" value={motion.note} max={60} disabled={disabled} onChange={note => onChange({ ...motion, note })} />
          <label className="block text-xs text-ink-muted sm:col-span-2">
            Teks besar, maksimal 3 baris
            <textarea value={motion.words.join('\n')} rows={3} disabled={disabled} onChange={e => onChange({ ...motion, words: lines(e.target.value).slice(0, 3) })}
              className="mt-1 w-full rounded-md border border-rule bg-bay px-2 py-1.5 text-sm text-ink focus:border-signal focus:outline-none" />
          </label>
        </div>
      )}

      {motion?.template === 'data' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Judul" value={motion.title} max={60} disabled={disabled} onChange={title => onChange({ ...motion, title })} />
          <label className="block text-xs text-ink-muted">
            Angka, pisahkan dengan koma
            <input defaultValue={motion.values.join(', ')} disabled={disabled} placeholder="100, 91, 83, 74"
              onBlur={e => onChange({ ...motion, values: e.target.value.split(',').map(v => v.trim()).filter(Boolean).map(Number).filter(v => !Number.isNaN(v)) })}
              className={`mt-1 ${inputClass}`} />
          </label>
          <Field label="Awalan" value={motion.prefix} max={8} disabled={disabled} placeholder="Rp" onChange={prefix => onChange({ ...motion, prefix })} />
          <Field label="Akhiran" value={motion.suffix} max={12} disabled={disabled} placeholder=" juta" onChange={suffix => onChange({ ...motion, suffix })} />
          <Field label="Keterangan (opsional)" value={motion.caption} max={30} disabled={disabled} onChange={caption => onChange({ ...motion, caption })} />
          <Field label="Catatan sumber (opsional)" value={motion.note} max={60} disabled={disabled} onChange={note => onChange({ ...motion, note })} />
        </div>
      )}

      {motion?.template === 'compare' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(['left', 'right'] as const).map(key => (
            <div key={key} className="space-y-2">
              <Field label={key === 'left' ? 'Judul kiri' : 'Judul kanan'} value={motion[key].title} max={28} disabled={disabled}
                onChange={title => onChange({ ...motion, [key]: { ...motion[key], title } })} />
              <label className="block text-xs text-ink-muted">
                Poin, satu per baris (maksimal 3)
                <textarea value={motion[key].items.join('\n')} rows={3} disabled={disabled}
                  onChange={e => onChange({ ...motion, [key]: { ...motion[key], items: lines(e.target.value).slice(0, 3) } })}
                  className="mt-1 w-full rounded-md border border-rule bg-bay px-2 py-1.5 text-sm text-ink focus:border-signal focus:outline-none" />
              </label>
            </div>
          ))}
        </div>
      )}

      {motion?.template === 'flow' && (
        <div className="mt-2 space-y-2">
          <Field label="Judul" value={motion.title} max={50} disabled={disabled} onChange={title => onChange({ ...motion, title })} />
          <label className="block text-xs text-ink-muted">
            Langkah, satu per baris: nama | penjelasan (2 sampai 4 baris)
            <textarea value={motion.steps.map(s => (s.body ? `${s.head} | ${s.body}` : s.head)).join('\n')} rows={4} disabled={disabled}
              onChange={e => onChange({
                ...motion,
                steps: lines(e.target.value).slice(0, 4).map(line => {
                  const [head, ...rest] = line.split('|')
                  return { head: head.trimStart(), body: rest.join('|').trimStart() }
                }),
              })}
              className="mt-1 w-full rounded-md border border-rule bg-bay px-2 py-1.5 text-sm text-ink focus:border-signal focus:outline-none" />
          </label>
        </div>
      )}
    </div>
  )
}
