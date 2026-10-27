'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import type { UploadKit } from '@/lib/types'

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Gagal menyalin.')
    }
  }
  return (
    <button type="button" onClick={copy} aria-label={label} title={label}
      className="grid size-7 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-raised hover:text-ink">
      {copied ? <Check className="size-3.5 text-teal" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  )
}

/** Judul, deskripsi & hashtag siap salin ke YouTube Studio. */
export default function UploadKitPanel({ kit }: { kit: UploadKit }) {
  return (
    <details className="group mt-3 rounded-md border border-rule text-sm">
      <summary className="cursor-pointer select-none px-3 py-2 text-ink-muted hover:text-ink">Siap upload: judul & deskripsi</summary>
      <div className="space-y-3 border-t border-rule px-3 py-3">
        <div>
          <p className="text-xs text-ink-muted">Pilihan judul</p>
          <ul className="mt-1 space-y-1">
            {kit.titles.map((title, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="min-w-0 flex-1 pt-1 leading-snug text-ink">{title}</span>
                <CopyButton text={title} label={`Salin judul ${i + 1}`} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-muted">Deskripsi + hashtag</p>
            <CopyButton text={kit.description_full} label="Salin deskripsi dan hashtag" />
          </div>
          <p className="mt-1 whitespace-pre-line leading-snug text-ink">{kit.description}</p>
          {kit.hashtags.length > 0 && <p className="mt-1 text-label-iris">{kit.hashtags.join(' ')}</p>}
        </div>
        <p className="text-xs text-ink-faint">
          Di Studio: Konten anak <span className="text-ink-muted">Tidak</span>, bahasa video Indonesia, dan isi
          {' '}<span className="text-ink-muted">Video terkait</span> dengan video panjang channel kamu.
        </p>
      </div>
    </details>
  )
}
