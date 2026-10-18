'use client'

import { RotateCcw } from 'lucide-react'
import CaptionPreview from '@/components/CaptionPreview'
import { CAPTION_FONT_CSS } from '@/lib/caption-fonts'
import {
  CAPTION_FONTS, CAPTION_PRESETS, CaptionFont, CaptionStyle, HIGHLIGHT_SWATCHES, HighlightStyle, presetOf,
} from '@/lib/caption-presets'

interface Props {
  value: CaptionStyle
  onChange: (style: CaptionStyle) => void
  disabled?: boolean
  sampleWords: string[]
  backgroundUrl?: string
}

/** Pilih preset caption, lihat pratinjaunya langsung, lalu sesuaikan tiap opsi. */
export default function CaptionStyleEditor({ value, onChange, disabled, sampleWords, backgroundUrl }: Props) {
  const preset = presetOf(value)
  const set = <K extends keyof CaptionStyle>(key: K, v: CaptionStyle[K]) => onChange({ ...value, [key]: v })
  // Preset yang terakhir dipilih: cocok persis, atau yang fontnya sama (untuk tombol "kembalikan")
  const basePreset = preset ?? CAPTION_PRESETS.find(p => p.style.font === value.font) ?? CAPTION_PRESETS[0]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
        <CaptionPreview style={value} words={sampleWords} backgroundUrl={backgroundUrl} />
        <div role="radiogroup" aria-label="Gaya caption" className="space-y-1">
          {CAPTION_PRESETS.map(p => {
            const selected = preset?.id === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange(p.style)}
                title={p.description}
                className={`w-full flex items-center gap-2 rounded-md border px-2.5 h-9 text-left ${
                  selected ? 'border-signal bg-signal/10' : 'border-transparent hover:bg-raised'
                }`}
              >
                <span
                  className="w-12 shrink-0 truncate text-[13px] leading-none"
                  style={{
                    ...CAPTION_FONT_CSS[p.style.font],
                    color: p.style.highlight_style === 'none' ? p.style.color : p.style.highlight_color,
                    textTransform: p.style.uppercase ? 'uppercase' : 'none',
                  }}
                  aria-hidden
                >
                  Aa
                </span>
                <span className="text-sm text-ink truncate">{p.name}</span>
              </button>
            )
          })}
        </div>
      </div>
      <p className="text-xs text-ink-muted">
        {preset ? preset.description : `Gaya sendiri, berdasarkan ${basePreset.name}.`}
      </p>

      <details className="group rounded-md border border-rule">
        <summary className="flex items-center justify-between px-3 h-9 text-sm text-ink cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          Sesuaikan gaya
          <span className="text-xs text-ink-muted group-open:hidden">font, warna, posisi</span>
        </summary>
        <fieldset disabled={disabled} className="px-3 pb-3 space-y-3 text-sm">
          <Row label="Font">
            <select
              className="rounded-md border border-rule bg-bay px-2 h-8 text-ink max-w-[10rem]"
              value={value.font}
              onChange={e => set('font', e.target.value as CaptionFont)}
            >
              {CAPTION_FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </Row>
          <Range label="Ukuran" value={value.size} min={50} max={190} step={2} onChange={v => set('size', v)} />
          <Range label="Kata per tampilan" value={value.words_per_line} min={1} max={6} onChange={v => set('words_per_line', v)} />
          <Range
            label="Posisi"
            value={value.position_y}
            min={15}
            max={85}
            onChange={v => set('position_y', v)}
            format={v => (v < 38 ? 'atas' : v > 62 ? 'bawah' : 'tengah')}
          />

          <Row label="Sorotan kata">
            <div role="radiogroup" aria-label="Sorotan kata" className="grid grid-cols-3 rounded-md border border-rule p-0.5 text-xs">
              {([['color', 'Warna'], ['box', 'Kotak'], ['none', 'Tanpa']] as [HighlightStyle, string][]).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={value.highlight_style === id}
                  disabled={id === 'box' && value.background}
                  onClick={() => set('highlight_style', id)}
                  className={`h-7 px-2 rounded-[5px] ${value.highlight_style === id ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Row>
          {value.highlight_style !== 'none' && (
            <Row label="Warna sorotan">
              <div className="flex items-center gap-1.5">
                {HIGHLIGHT_SWATCHES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('highlight_color', c)}
                    aria-label={`Warna sorotan ${c}`}
                    aria-pressed={value.highlight_color === c}
                    className={`size-5 rounded-full border ${value.highlight_color === c ? 'border-ink ring-2 ring-ink/40' : 'border-rule'}`}
                    style={{ background: c }}
                  />
                ))}
                <ColorInput label="Warna sorotan lain" value={value.highlight_color} onChange={v => set('highlight_color', v)} />
              </div>
            </Row>
          )}
          <Row label="Warna teks"><ColorInput label="Warna teks" value={value.color} onChange={v => set('color', v)} /></Row>

          {!value.background && (
            <>
              <Range label="Garis tepi" value={value.outline_width} min={0} max={12} onChange={v => set('outline_width', v)} />
              {value.outline_width > 0 && (
                <Row label="Warna garis"><ColorInput label="Warna garis tepi" value={value.outline_color} onChange={v => set('outline_color', v)} /></Row>
              )}
              <Range label="Bayangan" value={value.shadow} min={0} max={8} onChange={v => set('shadow', v)} />
            </>
          )}

          <Toggle label="Huruf kapital" checked={value.uppercase} onChange={v => set('uppercase', v)} />
          <Toggle label="Efek pop pada kata aktif" checked={value.animation === 'pop'} onChange={v => set('animation', v ? 'pop' : 'none')} />
          <Toggle
            label="Latar gelap di belakang teks"
            checked={value.background}
            onChange={v => onChange({ ...value, background: v, highlight_style: v && value.highlight_style === 'box' ? 'color' : value.highlight_style })}
          />

          {!preset && (
            <button
              type="button"
              onClick={() => onChange(basePreset.style)}
              className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink underline underline-offset-4 decoration-rule"
            >
              <RotateCcw className="size-3" aria-hidden /> Kembalikan ke {basePreset.name}
            </button>
          )}
        </fieldset>
      </details>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      {children}
    </div>
  )
}

function Range({ label, value, min, max, step = 1, onChange, format }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; format?: (v: number) => string
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-ink-muted">
        {label}
        <span className="timecode text-ink">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-signal"
      />
    </label>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="color"
      aria-label={label}
      value={value.toLowerCase()}
      onChange={e => onChange(e.target.value.toUpperCase())}
      className="h-7 w-10 rounded-md border border-rule bg-bay cursor-pointer"
    />
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="size-4 accent-signal" />
    </label>
  )
}
