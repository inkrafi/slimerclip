'use client'

import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  /** Judul yang menyebut item persis, mis. 'Hapus link review "Podcast Budi"?' */
  title: string
  body: string
  /** Kata kerja destruktif di tombol konfirmasi, mis. "Hapus link" */
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Konfirmasi tindakan destruktif: <dialog> modal (fokus terkunci di dalam, Esc = batal), Batal jadi fokus awal,
 * tombol konfirmasi berwarna destruktif. Fokus kembali ke pemicu saat ditutup.
 */
export default function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel = 'Batal', onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const trigger = useRef<Element | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      trigger.current = document.activeElement
      dialog.showModal()
      dialog.querySelector<HTMLButtonElement>('[data-cancel]')?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
      ;(trigger.current as HTMLElement | null)?.focus?.()
    }
  }, [open])

  return (
    <dialog ref={ref} onCancel={e => { e.preventDefault(); onCancel() }} aria-labelledby="confirm-title" aria-describedby="confirm-body"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-rule bg-[#2a2660] p-6 text-ink backdrop:bg-black/60">
      <h2 id="confirm-title" className="type-heading text-lg text-ink">{title}</h2>
      <p id="confirm-body" className="mt-2 text-sm text-ink-muted">{body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" data-cancel onClick={onCancel} className="btn btn-quiet">{cancelLabel}</button>
        <button type="button" onClick={onConfirm} className="btn bg-tally text-bay hover:opacity-90">{confirmLabel}</button>
      </div>
    </dialog>
  )
}
