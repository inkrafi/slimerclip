'use client'

import type { LongformMotion, LongformMotionTemplate } from '@/lib/types'

const TEMPLATES: { id: LongformMotionTemplate | ''; label: string }[] = [
  { id: '', label: 'Tanpa animasi' },
  { id: 'kinetic', label: 'Teks kinetik' },
  { id: 'data', label: 'Grafik angka' },
  { id: 'compare', label: 'Perbandingan' },
  { id: 'flow', label: 'Alur langkah' },
]
const FULL_TEMPLATES: { id: LongformMotionTemplate; label: string }[] = [
  { id: 'ledger', label: 'Struk atau tabel' },
  { id: 'number', label: 'Angka besar' },
  { id: 'share', label: 'Cincin persen' },
  { id: 'verdict', label: 'Pertanyaan dan stempel' },
  { id: 'picture', label: 'Ilustrasi' },
]
const PICTURES = [
  { id: 'phone', label: 'Ponsel' }, { id: 'tire', label: 'Ban kempes' }, { id: 'bowl', label: 'Mangkuk makan' }, { id: 'wallet', label: 'Dompet' }, { id: 'laptop', label: 'Laptop' },
] as const

const EMPTY: Record<LongformMotionTemplate, LongformMotion> = {
  kinetic: { template: 'kinetic', lead: '', words: [''], note: '' },
  data: { template: 'data', title: '', values: [], prefix: '', suffix: '', caption: '', note: '' },
  compare: { template: 'compare', left: { title: '', items: [''] }, right: { title: '', items: [''] } },
  flow: { template: 'flow', title: '', steps: [{ head: '', body: '' }, { head: '', body: '' }] },
  ledger: { template: 'ledger', title: '', rows: [], start: 0, prefix: 'Rp', suffix: '', result: '' },
  number: { template: 'number', label: '', value: 0, prefix: '', suffix: '', note: '', tone: 'plain' },
  share: { template: 'share', label: '', percent: 50, note: '' },
  verdict: { template: 'verdict', question: '', answer: '' },
  picture: { template: 'picture', name: 'wallet', title: '', note: '', screen: '' },
  choice: { template: 'choice', title: '', options: ['', ''], pick: 0, result: '' },
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

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs text-ink-muted">
      {label}
      <input type="number" min={0} value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value) || 0)} className={`mt-1 ${inputClass}`} />
    </label>
  )
}

const lines = (value: string) => value.split('\n')

/** Pilihan animasi satu adegan. Isinya harus sesuai narasi, karena tampil di video apa adanya. */
export default function MotionFields({ motion, disabled, full, only, onChange }: {
  motion: LongformMotion | null | undefined; disabled: boolean; full?: boolean
  /** Batasi pilihan animasi, tanpa pilihan "Tanpa animasi" */
  only?: LongformMotionTemplate[]
  onChange: (motion: LongformMotion | null) => void
}) {
  const choices = only ? [...TEMPLATES, ...FULL_TEMPLATES].filter(item => only.includes(item.id as LongformMotionTemplate))
    : full ? [...TEMPLATES, ...FULL_TEMPLATES] : TEMPLATES
  const template = motion?.template ?? ''
  // Bentuk "Pilihan" sudah tidak ditawarkan; adegan lama yang memakainya tetap terbaca
  if (template === 'choice' && !choices.some(item => item.id === 'choice')) choices.push({ id: 'choice', label: 'Pilihan (lama)' })
  return (
    <div className="mt-3 border-t border-rule pt-3">
      <label className="block text-xs text-ink-muted">
        {full || only ? 'Jenis animasi' : 'Animasi di atas video'}
        <select value={template} disabled={disabled} onChange={e => onChange(e.target.value ? EMPTY[e.target.value as LongformMotionTemplate] : null)} className={`mt-1 ${inputClass}`}>
          {choices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      {motion && <p className="mt-1 text-xs text-ink-faint">Isi sesuai narasi. Animasi yang belum lengkap tidak dipakai saat disimpan.</p>}

      {motion?.template === 'ledger' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Judul" value={motion.title} max={50} disabled={disabled} onChange={title => onChange({ ...motion, title })} />
          <Field label="Label hasil" value={motion.result} max={20} disabled={disabled} placeholder="Sisa" onChange={result => onChange({ ...motion, result })} />
          <NumberField label="Nilai awal, 0 jika tidak ada" value={motion.start} disabled={disabled} onChange={start => onChange({ ...motion, start })} />
          <Field label="Awalan" value={motion.prefix} max={8} disabled={disabled} placeholder="Rp" onChange={prefix => onChange({ ...motion, prefix })} />
          <label className="block text-xs text-ink-muted sm:col-span-2">
            Baris, satu per baris: nama | nilai penuh (2 sampai 6 baris)
            <textarea defaultValue={motion.rows.map(r => `${r.label} | ${r.value}`).join('\n')} rows={4} disabled={disabled}
              onBlur={e => onChange({
                ...motion,
                rows: lines(e.target.value).slice(0, 6).map(line => {
                  const [label, value] = line.split('|')
                  return { label: (label ?? '').trim(), value: Number((value ?? '').replace(/[^\d.]/g, '')) }
                }).filter(r => r.label),
              })}
              className="mt-1 w-full rounded-md border border-rule bg-bay px-2 py-1.5 text-sm text-ink focus:border-signal focus:outline-none" />
          </label>
        </div>
      )}

      {motion?.template === 'number' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Label" value={motion.label} max={50} disabled={disabled} onChange={label => onChange({ ...motion, label })} />
          <NumberField label="Angka" value={motion.value} disabled={disabled} onChange={value => onChange({ ...motion, value })} />
          <Field label="Awalan" value={motion.prefix} max={8} disabled={disabled} placeholder="Rp" onChange={prefix => onChange({ ...motion, prefix })} />
          <Field label="Akhiran" value={motion.suffix} max={12} disabled={disabled} onChange={suffix => onChange({ ...motion, suffix })} />
          <Field label="Catatan (opsional)" value={motion.note} max={70} disabled={disabled} onChange={note => onChange({ ...motion, note })} />
          <label className="block text-xs text-ink-muted">
            Latar
            <select value={motion.tone} disabled={disabled} onChange={e => onChange({ ...motion, tone: e.target.value === 'bad' ? 'bad' : 'plain' })} className={`mt-1 ${inputClass}`}>
              <option value="plain">Gelap</option>
              <option value="bad">Merah, untuk kabar buruk</option>
            </select>
          </label>
        </div>
      )}

      {motion?.template === 'share' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Label" value={motion.label} max={50} disabled={disabled} onChange={label => onChange({ ...motion, label })} />
          <NumberField label="Persen" value={motion.percent} disabled={disabled} onChange={percent => onChange({ ...motion, percent })} />
          <Field label="Catatan (opsional)" value={motion.note} max={70} disabled={disabled} onChange={note => onChange({ ...motion, note })} />
        </div>
      )}

      {motion?.template === 'verdict' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Pertanyaan" value={motion.question} max={40} disabled={disabled} onChange={question => onChange({ ...motion, question })} />
          <Field label="Teks stempel" value={motion.answer} max={20} disabled={disabled} placeholder="BELUM TENTU" onChange={answer => onChange({ ...motion, answer })} />
        </div>
      )}

      {motion?.template === 'picture' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-ink-muted">
            Gambar
            <select value={motion.name} disabled={disabled} onChange={e => onChange({ ...motion, name: e.target.value as typeof motion.name })} className={`mt-1 ${inputClass}`}>
              {PICTURES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <Field label="Judul" value={motion.title} max={40} disabled={disabled} onChange={title => onChange({ ...motion, title })} />
          <Field label="Catatan (opsional)" value={motion.note} max={70} disabled={disabled} onChange={note => onChange({ ...motion, note })} />
          {motion.name === 'phone' && <Field label="Teks di layar ponsel" value={motion.screen} max={16} disabled={disabled} onChange={screen => onChange({ ...motion, screen })} />}
        </div>
      )}

      {motion?.template === 'choice' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Judul" value={motion.title} max={50} disabled={disabled} onChange={title => onChange({ ...motion, title })} />
          <Field label="Judul setelah dipilih (opsional)" value={motion.result} max={50} disabled={disabled} onChange={result => onChange({ ...motion, result })} />
          <label className="block text-xs text-ink-muted">
            Pilihan, satu per baris (2 sampai 6)
            <textarea value={motion.options.join('\n')} rows={4} disabled={disabled} onChange={e => onChange({ ...motion, options: lines(e.target.value).slice(0, 6) })}
              className="mt-1 w-full rounded-md border border-rule bg-bay px-2 py-1.5 text-sm text-ink focus:border-signal focus:outline-none" />
          </label>
          <label className="block text-xs text-ink-muted">
            Yang dipilih kursor
            <select value={motion.pick} disabled={disabled} onChange={e => onChange({ ...motion, pick: Number(e.target.value) })} className={`mt-1 ${inputClass}`}>
              {motion.options.map((option, i) => <option key={i} value={i}>{option || `Pilihan ${i + 1}`}</option>)}
            </select>
          </label>
        </div>
      )}

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
