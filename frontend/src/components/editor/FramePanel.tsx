'use client'

import type { ClipFrame } from '@/lib/types'

const RATIOS: { id: ClipFrame['ratio']; label: string; hint: string; box: string }[] = [
  { id: 'full', label: 'Penuh', hint: '9:16', box: 'inset-0' },
  { id: 'portrait', label: 'Portrait', hint: '3:4', box: 'inset-x-0 top-[12.5%] bottom-[12.5%]' },
  { id: 'square', label: 'Square', hint: '1:1', box: 'inset-x-0 top-[21.9%] bottom-[21.9%]' },
  { id: 'classic', label: 'Klasik', hint: '4:3', box: 'inset-x-0 top-[28.9%] bottom-[28.9%]' },
  { id: 'landscape', label: 'Landscape', hint: '16:9', box: 'inset-x-0 top-[34.2%] bottom-[34.2%]' },
]

const BACKGROUNDS: { id: ClipFrame['background']; label: string }[] = [
  { id: 'blur', label: 'Blur' },
  { id: 'black', label: 'Hitam' },
]

/** Bentuk video di dalam hasil 9:16. Pratinjau editor tetap penuh; bingkainya terlihat di hasil render. */
export default function FramePanel({ frame, onChange }: { frame: ClipFrame; onChange: (frame: ClipFrame) => void }) {
  return (
    <div className="space-y-4 text-sm">
      <div role="radiogroup" aria-label="Bentuk video" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RATIOS.map(ratio => {
          const active = frame.ratio === ratio.id
          return (
            <button key={ratio.id} type="button" role="radio" aria-checked={active} onClick={() => onChange({ ...frame, ratio: ratio.id })}
              className={`flex items-center gap-3 rounded-md border p-2.5 text-left ${active ? 'border-signal bg-raised text-ink' : 'border-rule text-ink-muted hover:text-ink'}`}>
              <span className="relative h-12 w-[1.6875rem] shrink-0 overflow-hidden rounded-sm border border-rule bg-black/40" aria-hidden>
                <span className={`absolute ${ratio.box} ${active ? 'bg-signal' : 'bg-ink-muted'}`} />
              </span>
              <span>
                <span className="block font-semibold">{ratio.label}</span>
                <span className="block text-xs text-ink-muted">{ratio.hint}</span>
              </span>
            </button>
          )
        })}
      </div>

      {frame.ratio !== 'full' && (
        <div>
          <p id="frame-background" className="text-ink">Latar</p>
          <div role="radiogroup" aria-labelledby="frame-background" className="mt-1.5 inline-grid grid-cols-2 gap-1 rounded-md border border-rule p-0.5">
            {BACKGROUNDS.map(background => (
              <button key={background.id} type="button" role="radio" aria-checked={frame.background === background.id}
                onClick={() => onChange({ ...frame, background: background.id })}
                className={`h-9 min-w-20 rounded-[5px] px-3 ${frame.background === background.id ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}>
                {background.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-ink-muted">Pratinjau di sini tetap penuh. Bingkai dan latarnya terlihat di hasil render.</p>
        </div>
      )}
    </div>
  )
}
