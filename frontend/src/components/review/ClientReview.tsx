'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Download, Image as ImageIcon, Link2, Loader2, MessageSquareWarning, RotateCcw, Subtitles } from 'lucide-react'
import { useCopy } from '@/components/LocaleProvider'
import { useDraft } from '@/hooks/useDraft'
import { decideReviewClip, downloadUrl, getPublicReview, publishReviewClip } from '@/lib/api'
import type { PublicReview, ReviewClip, RevisionReason, ReviewStatus, ReviewSummary } from '@/lib/types'

const COPY = {
  id: {
    loading: 'Memuat klip…', heading: (name: string) => `Klip untuk ${name}`,
    progress: (s: ReviewSummary) => `${s.approved} disetujui · ${s.revision} minta revisi · ${s.pending} belum dicek`,
    filters: { all: 'Semua', pending: 'Belum dicek', approved: 'Disetujui', revision: 'Revisi' },
    empty: 'Tidak ada klip di bagian ini.', showAll: 'Tampilkan semua klip', note: 'Catatan', unavailable: 'Klip ini sudah tidak tersedia. Hubungi pengirim link.',
    approve: 'Setujui', approved: 'Disetujui', revise: 'Minta revisi', revisionSent: 'Revisi diminta', change: 'Ubah keputusan',
    reasonQ: 'Apa yang perlu diubah?', notePh: 'Ceritakan singkat, mis. "nama tamu di caption salah"', send: 'Kirim revisi', cancel: 'Batal',
    reasons: { momen: 'Momennya kurang tepat', kutipan: 'Kutipan / caption salah', gaya: 'Gaya / tampilan', musik: 'Musik / suara', lainnya: 'Lainnya' } as Record<RevisionReason, string>,
    video: 'Video', thumbnail: 'Thumbnail', srt: 'Subtitle (SRT)',
    uploadKit: 'Siap upload', titles: 'Pilihan judul', description: 'Deskripsi + hashtag', copy: 'Salin', copied: 'Tersalin',
    published: 'Sudah diunggah?', publishPh: 'Tempel link Shorts / TikTok / Reels', save: 'Simpan',
    publishHint: 'Dengan link ini kami bisa melaporkan performa tiap klip setiap bulan.',
    badUrl: 'Tempel link YouTube Shorts, TikTok, atau Instagram Reels (diawali https://).',
    expires: (d: string) => `Link berlaku sampai ${d}.`, failed: 'Gagal menyimpan. Coba lagi.',
  },
  en: {
    loading: 'Loading clips…', heading: (name: string) => `Clips for ${name}`,
    progress: (s: ReviewSummary) => `${s.approved} approved · ${s.revision} need changes · ${s.pending} to review`,
    filters: { all: 'All', pending: 'To review', approved: 'Approved', revision: 'Changes' },
    empty: 'No clips here.', showAll: 'Show all clips', note: 'Note', unavailable: 'This clip is no longer available. Contact the sender.',
    approve: 'Approve', approved: 'Approved', revise: 'Request changes', revisionSent: 'Changes requested', change: 'Change decision',
    reasonQ: 'What should change?', notePh: 'Tell us briefly, e.g. "guest name in captions is wrong"', send: 'Send request', cancel: 'Cancel',
    reasons: { momen: 'Wrong moment', kutipan: 'Quote / caption error', gaya: 'Style / look', musik: 'Music / audio', lainnya: 'Other' } as Record<RevisionReason, string>,
    video: 'Video', thumbnail: 'Thumbnail', srt: 'Subtitles (SRT)',
    uploadKit: 'Ready to post', titles: 'Title options', description: 'Description + hashtags', copy: 'Copy', copied: 'Copied',
    published: 'Posted it?', publishPh: 'Paste the Shorts / TikTok / Reels link', save: 'Save',
    publishHint: 'With this link we can report how each clip performs every month.',
    badUrl: 'Paste a YouTube Shorts, TikTok, or Instagram Reels link (starting with https://).',
    expires: (d: string) => `This link works until ${d}.`, failed: "Couldn't save. Please try again.",
  },
}
type T = (typeof COPY)['id']
type Filter = 'all' | ReviewStatus

const PUBLISH_RE = /^https:\/\/(www\.|m\.|vm\.|vt\.)?(youtube\.com|youtu\.be|tiktok\.com|instagram\.com)\//i

function CopyText({ text, t, label }: { text: string; t: T; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" className="btn btn-sm btn-quiet shrink-0" onClick={() => {
      navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) }).catch(() => {})
    }}>
      {done ? <Check className="size-3.5 text-teal" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {done ? t.copied : label ?? t.copy}
    </button>
  )
}

export default function ClientReview({ token }: { token: string }) {
  const t = useCopy(COPY)
  const [data, setData] = useState<PublicReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    getPublicReview(token).then(setData).catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [token])

  if (error) return <p role="alert" className="pt-16 max-w-lg border-l-2 border-tally pl-4 text-ink-muted">{error}</p>
  if (!data) {
    return (
      <div className="pt-8" aria-busy="true" aria-label={t.loading}>
        <div className="skeleton h-10 w-2/3 max-w-md" />
        <div className="skeleton mt-6 h-2 max-w-xl" />
        <div className="mt-8 grid gap-10 md:grid-cols-2">
          {[0, 1].map(i => (
            <div key={i} className="flex gap-4"><div className="skeleton aspect-[9/16] w-40 sm:w-48" />
              <div className="flex-1 space-y-2"><div className="skeleton h-5 w-3/4" /><div className="skeleton h-9 w-40" /></div></div>
          ))}
        </div>
      </div>
    )
  }

  const update = (clip: ReviewClip, patch: Partial<ReviewClip>, summary: ReviewSummary) =>
    setData(d => d && {
      ...d, summary,
      clips: d.clips.map(c => (c.video_id === clip.video_id && c.key === clip.key ? { ...c, ...patch } : c)),
    })
  const shown = data.clips.filter(c => filter === 'all' || c.decision.status === filter)
  const s = data.summary
  const done = s.total ? Math.round((s.approved / s.total) * 100) : 0
  const expires = new Date(data.review.expires_at * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="pt-8 pb-16">
      <h1 className="type-display text-ink text-[clamp(1.8rem,5vw,2.6rem)]">{t.heading(data.review.client_name)}</h1>
      {data.review.title && <p className="mt-1 text-ink">{data.review.title}</p>}
      {data.review.note && <p className="mt-2 max-w-[60ch] text-ink-muted whitespace-pre-line">{data.review.note}</p>}

      <div className="mt-6 max-w-xl">
        <div className="h-2 rounded-full bg-rule overflow-hidden" aria-hidden>
          <div className="h-full origin-left bg-teal transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${done / 100})` }} />
        </div>
        <p className="mt-2 text-sm text-ink-muted" role="status">{t.progress(s)}</p>
      </div>

      <div role="group" aria-label="Filter" className="sticky top-14 z-10 -mx-1 mt-6 flex flex-wrap gap-1 bg-bay px-1 py-2">
        {(['all', 'pending', 'approved', 'revision'] as Filter[]).map(f => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={`tap h-9 shrink-0 rounded-full px-4 text-sm ${filter === f ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}>
            {t.filters[f]}{f !== 'all' && <span className="ml-1 timecode text-ink-faint">{f === 'pending' ? s.pending : s[f]}</span>}
          </button>
        ))}
      </div>

      {shown.length === 0
        ? (
          <div className="mt-10">
            <p className="text-ink-muted">{t.empty}</p>
            <button type="button" onClick={() => setFilter('all')} className="btn btn-sm btn-quiet mt-3">{t.showAll}</button>
          </div>
        )
        : (
          <ul className="mt-6 grid gap-10 md:grid-cols-2">
            {shown.map(clip => (
              <ClipCard key={`${clip.video_id}|${clip.key}`} clip={clip} token={token} reasons={data.reasons} t={t}
                onChange={(patch, summary) => update(clip, patch, summary)} />
            ))}
          </ul>
        )}

      <p className="mt-12 text-xs text-ink-faint">{t.expires(expires)}</p>
    </div>
  )
}

function ClipCard({ clip, token, reasons, t, onChange }: {
  clip: ReviewClip
  token: string
  reasons: RevisionReason[]
  t: T
  onChange: (patch: Partial<ReviewClip>, summary: ReviewSummary) => void
}) {
  const [revising, setRevising] = useState(false)
  // Draf revisi tersimpan per klip: tidak hilang saat halaman dimuat ulang
  const [draft, setDraft, clearDraft] = useDraft(`slimerclip.revision.${token.slice(-16)}.${clip.video_id}.${clip.key}`,
    { reason: (clip.decision.reason ?? 'momen') as RevisionReason, note: clip.decision.note ?? '' })
  const { reason, note } = draft
  const setReason = (r: RevisionReason) => setDraft({ ...draft, reason: r })
  const setNote = (n: string) => setDraft({ ...draft, note: n })
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const ids = { video_id: clip.video_id, key: clip.key }
  const status = clip.decision.status

  const decide = async (next: ReviewStatus) => {
    setBusy(true)
    try {
      const res = await decideReviewClip(token, { ...ids, status: next, ...(next === 'revision' ? { reason, note } : {}) })
      onChange({ decision: res.decision }, res.summary)
      setRevising(false)
      if (next === 'revision') clearDraft()
    } catch {
      setLinkError(t.failed)
    } finally {
      setBusy(false)
    }
  }

  const checkLink = (value: string) => {
    if (value.trim() && !PUBLISH_RE.test(value.trim())) setLinkError(t.badUrl)
  }

  const savePublish = async () => {
    if (!PUBLISH_RE.test(link.trim())) {
      setLinkError(t.badUrl)
      return
    }
    setBusy(true)
    setLinkError(null)
    try {
      const res = await publishReviewClip(token, { ...ids, url: link.trim() })
      onChange({ publish: res.publish }, res.summary)
      setLink('')
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : t.failed)
    } finally {
      setBusy(false)
    }
  }

  if (clip.unavailable) {
    return <li className="rounded-lg border border-dashed border-rule p-6 text-sm text-ink-muted">{t.unavailable}</li>
  }

  return (
    <li className={`min-w-0 ${status === 'pending' ? 'border-l-2 border-signal pl-3' : 'border-l-2 border-transparent pl-3'}`}>
      <div className="flex gap-4">
        <video src={clip.url} poster={clip.thumbnail_url || undefined} controls playsInline preload="metadata"
          className="aspect-[9/16] w-40 sm:w-48 shrink-0 rounded-lg border border-rule bg-black object-cover" />
        <div className="min-w-0 flex-1">
          <h2 className={`text-ink leading-snug ${status === 'pending' ? 'font-semibold' : 'font-normal'}`}>{clip.title}</h2>
          {clip.duration && <p className="mt-1 timecode text-xs text-ink-muted">{Math.round(clip.duration)}s</p>}

          {status === 'approved' && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-teal/15 px-3 py-1 text-sm text-teal">
              <Check className="size-4" aria-hidden /> {t.approved}
            </p>
          )}
          {status === 'revision' && (
            <div className="mt-3 rounded-md border border-signal/40 bg-signal/5 px-3 py-2 text-sm">
              <p className="flex items-center gap-2 text-ink"><MessageSquareWarning className="size-4 text-signal" aria-hidden /> {t.revisionSent}</p>
              <p className="mt-1 text-ink-muted">{clip.decision.reason && t.reasons[clip.decision.reason]}{clip.decision.note && `: ${clip.decision.note}`}</p>
            </div>
          )}

          {!revising && (
            <div className="mt-3 flex flex-wrap gap-2">
              {status !== 'approved' && (
                <button type="button" onClick={() => decide('approved')} disabled={busy} className="btn btn-sm btn-primary">
                  {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />} {t.approve}
                </button>
              )}
              {status !== 'revision' && (
                <button type="button" onClick={() => setRevising(true)} disabled={busy} className="btn btn-sm btn-quiet">{t.revise}</button>
              )}
              {status !== 'pending' && (
                <button type="button" onClick={() => decide('pending')} disabled={busy} className="btn btn-sm btn-quiet" title={t.change}>
                  <RotateCcw className="size-3.5" aria-hidden /> {t.change}
                </button>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <a href={downloadUrl(clip.url!)} download className="tap inline-flex items-center gap-1 text-ink underline underline-offset-4 decoration-rule"><Download className="size-3.5" aria-hidden /> {t.video}</a>
            {clip.thumbnail_url && <a href={downloadUrl(clip.thumbnail_url)} download className="tap inline-flex items-center gap-1 text-ink underline underline-offset-4 decoration-rule"><ImageIcon className="size-3.5" aria-hidden /> {t.thumbnail}</a>}
            {clip.srt_url && <a href={downloadUrl(clip.srt_url)} download className="tap inline-flex items-center gap-1 text-ink underline underline-offset-4 decoration-rule"><Subtitles className="size-3.5" aria-hidden /> {t.srt}</a>}
          </div>
        </div>
      </div>

      {revising && (
        <div className="mt-4 rounded-lg border border-rule p-4 text-sm">
          <p className="text-ink">{t.reasonQ}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t.reasonQ}>
            {reasons.map(r => (
              <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}
                className={`tap rounded-full border px-3 py-2 text-xs ${reason === r ? 'border-signal text-ink' : 'border-rule text-ink-muted hover:text-ink'}`}>
                {t.reasons[r]}
              </button>
            ))}
          </div>
          <label htmlFor={`note-${clip.video_id}-${clip.key}`} className="mt-3 block text-ink-muted">{t.note}</label>
          <textarea id={`note-${clip.video_id}-${clip.key}`} value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={3} placeholder={t.notePh}
            className="mt-1 w-full rounded-md border border-rule bg-bay px-3 py-2 text-ink focus:border-signal focus:outline-none" />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => decide('revision')} disabled={busy} className="btn btn-sm btn-primary">
              {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />} {t.send}
            </button>
            <button type="button" onClick={() => setRevising(false)} className="btn btn-sm btn-quiet">{t.cancel}</button>
          </div>
        </div>
      )}

      {clip.upload && (
        <details className="mt-4 rounded-lg border border-rule bg-bay/40 px-4 py-3 text-sm" open={status === 'approved'}>
          <summary className="cursor-pointer font-semibold text-ink">{t.uploadKit}</summary>
          <p className="mt-3 text-ink-muted">{t.titles}</p>
          <ul className="mt-1 space-y-1.5">
            {clip.upload.titles.map((title, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-rule px-3 py-2">
                <span className="min-w-0 text-ink">{title}</span>
                <CopyText text={title} t={t} />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-ink-muted">{t.description}</p>
            <CopyText text={clip.upload.description_full} t={t} />
          </div>
          <p className="mt-1 whitespace-pre-line rounded-md border border-rule bg-bay p-3 text-ink/90">{clip.upload.description_full}</p>
        </details>
      )}

      <div className="mt-4 text-sm">
        <label htmlFor={`pub-${clip.video_id}-${clip.key}`} className="text-ink-muted">{t.published}</label>
        {clip.publish.length > 0 && (
          <ul className="mt-1 space-y-1">
            {clip.publish.map(p => (
              <li key={p.url} className="flex items-center gap-2 text-ink"><Link2 className="size-3.5 text-teal" aria-hidden />
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="tap inline-flex items-center truncate underline underline-offset-4 decoration-rule">{p.url}</a>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex gap-2">
          <input id={`pub-${clip.video_id}-${clip.key}`} type="url" inputMode="url" value={link} onChange={e => { setLink(e.target.value); setLinkError(null) }}
            onBlur={e => checkLink(e.target.value)} aria-invalid={!!linkError}
            placeholder={t.publishPh}
            className="h-9 min-w-0 flex-1 rounded-md border border-rule bg-bay px-3 text-ink focus:border-signal focus:outline-none" />
          <button type="button" onClick={savePublish} disabled={busy} className="btn btn-sm btn-quiet">{t.save}</button>
        </div>
        {linkError ? <p role="alert" className="mt-1 text-xs text-tally">{linkError}</p> : <p className="mt-1 text-xs text-ink-faint">{t.publishHint}</p>}
      </div>
    </li>
  )
}
