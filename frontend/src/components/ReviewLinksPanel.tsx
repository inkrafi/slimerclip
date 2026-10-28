'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Link2, Loader2, Mail, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import IconButton from '@/components/common/IconButton'
import { useDraft } from '@/hooks/useDraft'
import { createReview, deleteReview, listReviews, reviewPageUrl } from '@/lib/api'
import { useActivePreset } from '@/lib/clipProfile'
import type { RenderedClip, ReviewLink, RevisionReason } from '@/lib/types'

const REASON_LABEL: Record<RevisionReason, string> = {
  momen: 'momen kurang tepat', kutipan: 'kutipan/caption salah', gaya: 'gaya/tampilan', musik: 'musik/suara', lainnya: 'lainnya',
}

const fmtDate = (epoch: number) => new Date(epoch * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

type Draft = { client: string; title: string; note: string; excluded: string[] }

/**
 * Link review per klien (khusus admin): satu link tanpa login berisi klip final; klien menyetujui / minta revisi,
 * mengunduh, menyalin paket upload, dan menempelkan link unggahan. Status tiap link tampil di sini.
 */
export default function ReviewLinksPanel({ videoId, clips, videoTitle }: { videoId: string; clips: RenderedClip[]; videoTitle: string }) {
  const preset = useActivePreset()
  const finals = clips.filter(c => c.status === 'final' && !c.legacy)
  const [links, setLinks] = useState<ReviewLink[] | null>(null)
  const [open, setOpen] = useState(false)
  // Draf form tersimpan per video: tidak hilang saat halaman dimuat ulang
  const [draft, setDraft, clearDraft] = useDraft<Draft>(`slimerclip.reviewDraft.${videoId}`,
    { client: preset?.name ?? '', title: videoTitle, note: '', excluded: [] })
  const [errors, setErrors] = useState<{ client?: string; clips?: string }>({})
  const [busy, setBusy] = useState(false)
  const [toDelete, setToDelete] = useState<ReviewLink | null>(null)

  useEffect(() => {
    listReviews(videoId).then(setLinks).catch(() => setLinks([]))
  }, [videoId])

  const titleOf = (key: string) => clips.find(c => c.key === key)?.title || key
  const selected = finals.filter(c => !draft.excluded.includes(c.key))

  const validateClient = (value: string) => setErrors(e => ({ ...e, client: value.trim() ? undefined : 'Isi nama klien agar link mudah dikenali.' }))

  const create = async () => {
    const next = {
      client: draft.client.trim() ? undefined : 'Isi nama klien agar link mudah dikenali.',
      clips: selected.length ? undefined : 'Pilih minimal satu klip final untuk dikirim.',
    }
    setErrors(next)
    if (next.client || next.clips) {
      document.getElementById(next.client ? 'review-client' : 'review-clips')?.focus()
      return
    }
    setBusy(true)
    try {
      const review = await createReview({
        client_name: draft.client, title: draft.title, note: draft.note, preset_id: preset?.id,
        items: selected.map(c => ({ video_id: videoId, key: c.key })),
      })
      setLinks(prev => [review, ...(prev ?? [])])
      setOpen(false)
      clearDraft()
      setDraft({ client: preset?.name ?? '', title: videoTitle, note: '', excluded: [] })
      await navigator.clipboard.writeText(reviewPageUrl(review.token)).catch(() => {})
      toast.success('Link review dibuat dan disalin')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Link review belum bisa dibuat. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    const link = toDelete
    setToDelete(null)
    if (!link) return
    try {
      await deleteReview(link.id)
      setLinks(prev => prev?.filter(l => l.id !== link.id) ?? null)
      toast.success(`Link review "${link.client_name}" dihapus`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Link belum bisa dihapus. Coba lagi.')
    }
  }

  if (!finals.length && !links?.length) return null

  return (
    <section aria-labelledby="review-title" className="mt-8 rounded-lg border border-rule glass p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="review-title" className="font-semibold text-ink flex items-center gap-2"><Link2 className="size-4 text-signal" aria-hidden /> Link review untuk klien</h2>
          <p className="mt-1 text-sm text-ink-muted">Klien membuka di HP tanpa login: putar, setujui atau minta revisi, unduh, salin judul & deskripsi.</p>
        </div>
        {!open && finals.length > 0 && (
          <button type="button" onClick={() => setOpen(true)} className="btn btn-sm btn-primary"><Plus className="size-4" aria-hidden /> Buat link review</button>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-4 rounded-md border border-rule bg-bay/40 p-4 text-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="review-client" className="text-ink-muted">Nama klien</label>
              <input id="review-client" value={draft.client} maxLength={60} autoFocus
                onChange={e => { setDraft({ ...draft, client: e.target.value }); if (errors.client) setErrors(x => ({ ...x, client: undefined })) }}
                onBlur={e => validateClient(e.target.value)}
                aria-invalid={!!errors.client} aria-describedby={errors.client ? 'review-client-error' : undefined}
                className={`mt-1 h-10 w-full rounded-md border bg-bay px-3 text-ink focus:border-signal focus:outline-none ${errors.client ? 'border-tally' : 'border-rule'}`} />
              {errors.client && <p id="review-client-error" className="mt-1 text-sm text-tally">{errors.client}</p>}
            </div>
            <div>
              <label htmlFor="review-batch" className="text-ink-muted">Judul batch</label>
              <input id="review-batch" value={draft.title} maxLength={100} onChange={e => setDraft({ ...draft, title: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-rule bg-bay px-3 text-ink focus:border-signal focus:outline-none" />
            </div>
          </div>
          <div>
            <label htmlFor="review-note" className="text-ink-muted">Pesan untuk klien (opsional)</label>
            <textarea id="review-note" value={draft.note} maxLength={500} rows={2} onChange={e => setDraft({ ...draft, note: e.target.value })}
              placeholder="Ini 8 klip dari episode 12. Setujui yang mau diunggah."
              className="mt-1 w-full rounded-md border border-rule bg-bay px-3 py-2 text-ink focus:border-signal focus:outline-none" />
          </div>
          <fieldset id="review-clips" tabIndex={-1} aria-describedby={errors.clips ? 'review-clips-error' : undefined}>
            <legend className="text-ink-muted">Klip final ({selected.length} dari {finals.length} dipilih)</legend>
            <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto">
              {finals.map(c => (
                <li key={c.key}>
                  <label className="tap flex items-center gap-2 rounded px-1 py-2 hover:bg-raised">
                    <input type="checkbox" className="size-4 accent-signal" checked={!draft.excluded.includes(c.key)} onChange={e => {
                      const excluded = e.target.checked ? draft.excluded.filter(k => k !== c.key) : [...draft.excluded, c.key]
                      setDraft({ ...draft, excluded })
                      if (errors.clips) setErrors(x => ({ ...x, clips: undefined }))
                    }} />
                    <span className="truncate text-ink">{c.title || c.key}</span>
                  </label>
                </li>
              ))}
            </ul>
            {errors.clips
              ? <p id="review-clips-error" className="mt-1 text-sm text-tally">{errors.clips}</p>
              : <p className="mt-1 text-xs text-ink-faint">Hanya klip yang sudah dirender final yang bisa dikirim.</p>}
          </fieldset>
          <div className="flex gap-2">
            <button type="button" onClick={create} disabled={busy} className="btn btn-sm btn-primary">
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Buat & salin link
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-sm btn-quiet">Tutup form</button>
          </div>
        </div>
      )}

      {links === null ? (
        <div className="mt-4 space-y-2" aria-busy="true" aria-label="Memuat link review">
          <div className="skeleton h-12" /><div className="skeleton h-12" />
        </div>
      ) : links.length > 0 && (
        <ul className="mt-4 divide-y divide-rule">
          {links.map(link => <LinkRow key={link.id} link={link} titleOf={titleOf} onDelete={() => setToDelete(link)} />)}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={`Hapus link review "${toDelete?.client_name ?? ''}"?`}
        body="Link langsung tidak bisa dibuka lagi oleh klien. Klip dan laporan tidak ikut terhapus."
        confirmLabel="Hapus link"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  )
}

function LinkRow({ link, titleOf, onDelete }: { link: ReviewLink; titleOf: (key: string) => string; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = reviewPageUrl(link.token)
  const s = link.summary
  const message = `Halo ${link.client_name}, klip ${link.title ? `"${link.title}" ` : ''}sudah siap untuk dicek (${s.total} klip): ${url}`
  return (
    <li className="py-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{link.client_name} <span className="font-normal text-ink-muted">· {link.title || `${s.total} klip`}</span></p>
          <p className="mt-1 text-xs text-ink-muted">
            Dibuat {fmtDate(link.created_at)} ·{' '}
            {s.opened ? `dibuka ${s.opened}× (terakhir ${fmtDate(s.last_opened!)})` : <span className="text-signal">belum dibuka</span>}
          </p>
          <p className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-teal/15 px-2 py-1 text-teal">{s.approved} disetujui</span>
            {s.revision > 0 && <span className="rounded-full bg-signal/15 px-2 py-1 text-signal">{s.revision} revisi</span>}
            <span className="text-ink-muted py-1">{s.pending} belum dicek · {s.published} sudah diunggah</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" className="btn btn-sm btn-quiet" onClick={() => {
            navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
          }}>
            {copied ? <Check className="size-4 text-teal" aria-hidden /> : <Copy className="size-4" aria-hidden />} Salin link
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-quiet">
            <MessageCircle className="size-4" aria-hidden /> Kirim WA
          </a>
          <IconButton label="Kirim lewat email" icon={Mail}
            href={`mailto:?subject=${encodeURIComponent(`Klip siap dicek: ${link.title || link.client_name}`)}&body=${encodeURIComponent(message)}`} />
          <IconButton label="Buka seperti klien" icon={ExternalLink} href={url} external />
          <IconButton label={`Hapus link ${link.client_name}`} icon={Trash2} onClick={onDelete} tone="danger" />
        </div>
      </div>
      {link.revisions.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-md border border-signal/30 bg-signal/5 p-3 text-sm">
          {link.revisions.map(r => (
            <li key={r.key} className="text-ink">
              <span className="font-semibold">{titleOf(r.key)}</span>
              <span className="text-ink-muted"> — {r.reason ? REASON_LABEL[r.reason] : 'revisi'}{r.note && `: “${r.note}”`}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
