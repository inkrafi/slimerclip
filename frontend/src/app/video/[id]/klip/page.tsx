'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Loader2, Pencil } from 'lucide-react'
import RequireAuth from '@/components/RequireAuth'
import { downloadUrl, getVideo } from '@/lib/api'
import { formatClock, formatSpan, toSeconds } from '@/lib/clip-meta'
import { VideoDetail } from '@/lib/types'

function layoutNote(layout: VideoDetail['clips'][number]['layout']) {
  if (!layout || layout.mode !== 'speaker') return layout?.mode === 'center' ? 'Potongan tengah' : null
  const parts = []
  if (layout.split) parts.push(`layar terbagi ${Math.round(layout.split)} dtk`)
  if (layout.zoom) parts.push(`zoom ke pembicara ${Math.round(layout.zoom)} dtk`)
  return parts.length ? `Ikuti pembicara: ${parts.join(', ')}` : 'Ikuti pembicara'
}

export default function ClipsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <RequireAuth>
      <Clips id={id} />
    </RequireAuth>
  )
}

function Clips({ id }: { id: string }) {
  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getVideo(id).then(setDetail).catch(e => setError(e.message))
  }, [id])

  const title = detail?.analysis?.video_metadata?.title || id

  return (
    <div className="pt-10">
      <Link href={`/video/${id}`} className="text-sm text-ink-muted underline underline-offset-4 decoration-rule hover:text-ink">
        Kembali ke momen video
      </Link>
      <h1 className="mt-3 type-display text-4xl text-ink">Klip tersimpan</h1>
      <p className="mt-2 max-w-[68ch] text-ink-muted">{title}</p>

      <div className="mt-10">
        {error ? (
          <p role="alert" className="border-l-2 border-tally pl-4 text-sm text-ink-muted">{error}</p>
        ) : !detail ? (
          <p className="flex items-center gap-2 text-ink-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Memuat…</p>
        ) : detail.clips.length === 0 ? (
          <div className="rounded-lg border border-dashed border-rule px-6 py-14 text-center">
            <p className="text-ink">Belum ada klip untuk video ini.</p>
            <p className="mt-1 text-sm text-ink-muted">
              Pilih momen lalu buat pratinjaunya dari <Link href={`/video/${id}`} className="underline underline-offset-4">halaman video</Link>.
            </p>
          </div>
        ) : (
          <ul className="grid gap-x-6 gap-y-10 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
            {detail.clips.map(clip => {
              const note = layoutNote(clip.layout)
              const isPreview = clip.status === 'preview'
              const editHref = `/video/${id}/klip/edit?key=${encodeURIComponent(clip.key)}`
              return (
                <li key={clip.key}>
                  <video
                    src={(clip.url ?? clip.preview_url) || undefined}
                    controls
                    preload="metadata"
                    playsInline
                    className="w-full aspect-[9/16] rounded-md border border-rule bg-black"
                  />
                  <p className="mt-3 font-semibold text-ink leading-snug line-clamp-2">
                    {clip.topic || (clip.legacy ? 'Klip lama' : 'Klip')}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-muted">
                    {clip.range
                      ? <span className="timecode">{formatClock(clip.range[0])}–{formatClock(clip.range[1])}</span>
                      : clip.start_time && clip.end_time && <span className="timecode">{clip.start_time}–{clip.end_time}</span>}
                    {clip.range
                      ? <span>{formatSpan(clip.range[1] - clip.range[0])}</span>
                      : clip.start_time && clip.end_time
                        ? <span>{formatSpan(toSeconds(clip.end_time) - toSeconds(clip.start_time))}</span>
                        : clip.duration_seconds != null && <span>{formatSpan(clip.duration_seconds)}</span>}
                    {isPreview ? <span className="text-label-iris">Pratinjau</span> : clip.edit && <span className="text-teal">Diedit</span>}
                    {clip.resolution && <span>{clip.resolution}p</span>}
                    <span>{clip.file_size_mb} MB</span>
                  </p>
                  {note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}
                  {clip.legacy && <p className="mt-1 text-xs text-ink-muted">Dirender dengan versi lama, sebelum klip dicatat per momen.</p>}
                  <p className="mt-1 text-xs text-ink-faint">Dirender {clip.rendered_at}</p>
                  {isPreview && (
                    <p className="mt-1 text-xs text-ink-muted">Belum ada caption. Edit lalu render final untuk mengunduh.</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    {clip.url && (
                      <a href={downloadUrl(clip.url)} download className="btn btn-sm btn-primary">
                        <Download className="size-3.5" aria-hidden /> Unduh
                      </a>
                    )}
                    {!clip.legacy && (
                      <Link href={editHref} className={`btn btn-sm ${isPreview ? 'btn-primary' : 'btn-quiet'}`}>
                        <Pencil className="size-3.5" aria-hidden /> {isPreview ? 'Edit & render final' : 'Edit'}
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
