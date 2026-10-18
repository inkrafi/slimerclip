'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteVideo, getVideos, youtubeUrlFor } from '@/lib/api'
import { formatClock } from '@/lib/clip-meta'
import { VideoSummary } from '@/lib/types'

export default function HistoryPanel() {
  const [items, setItems] = useState<VideoSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getVideos().then(setItems).catch(e => setError(e.message))
  }, [])

  const handleDelete = async (video: VideoSummary) => {
    const clips = video.clip_count > 0 ? ` dan ${video.clip_count} klip yang sudah dirender` : ''
    if (!confirm(`Hapus analisis "${video.title || video.video_id}"${clips}? Ini tidak bisa dibatalkan.`)) return
    try {
      await deleteVideo(video.video_id)
      setItems(prev => prev?.filter(v => v.video_id !== video.video_id) ?? null)
      toast.success('Dihapus dari riwayat')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus')
    }
  }

  return (
    <section aria-labelledby="history-title">
      <h1 id="history-title" className="type-display text-4xl text-ink">Riwayat</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Semua video yang pernah dianalisis. Membukanya lagi tidak memakai kuota AI, dan klip yang sudah dirender tetap tersimpan.
      </p>

      <div className="mt-8">
        {error ? (
          <p role="alert" className="border-l-2 border-tally pl-4 text-sm text-ink-muted">{error}</p>
        ) : items === null ? (
          <div className="space-y-px" aria-busy="true" aria-label="Memuat riwayat">
            {[0, 1, 2].map(i => <div key={i} className="h-20 glass first:rounded-t-lg last:rounded-b-lg" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-rule px-6 py-14 text-center">
            <p className="text-ink">Belum ada video yang dianalisis.</p>
            <p className="mt-1 text-sm text-ink-muted">
              <Link href="/" className="underline underline-offset-4">Tempel link YouTube</Link> untuk memulai.
            </p>
          </div>
        ) : (
          <ul className="rounded-lg border border-rule glass divide-y divide-rule overflow-hidden">
            {items.map(v => (
              <li key={v.video_id} className="group flex items-center gap-4 pr-3 hover:bg-raised/50">
                <Link href={`/video/${v.video_id}`} className="flex flex-1 min-w-0 items-center gap-4 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg`}
                    alt=""
                    className="w-28 aspect-video object-cover rounded shrink-0 bg-raised"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink leading-snug line-clamp-2">{v.title || 'Video tanpa judul'}</span>
                    <span className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-muted">
                      {v.channel && <span>{v.channel}</span>}
                      {v.duration > 0 && <span className="timecode">{formatClock(v.duration)}</span>}
                      <span>{v.segment_count} momen</span>
                      {v.clip_count > 0 && <span className="text-sage">{v.clip_count} klip dirender</span>}
                      <span>{v.analyzed_at}</span>
                    </span>
                  </span>
                </Link>

                {v.clip_count > 0 && (
                  <Link href={`/video/${v.video_id}/klip`} className="btn btn-sm btn-quiet shrink-0">
                    Lihat {v.clip_count} klip
                  </Link>
                )}
                <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <a
                    href={v.youtube_url || youtubeUrlFor(v.video_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm px-2 text-ink-muted hover:text-ink"
                    aria-label={`Buka ${v.title || 'video'} di YouTube`}
                  >
                    <ExternalLink className="size-4" aria-hidden />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(v)}
                    className="btn btn-sm px-2 text-ink-muted hover:text-tally"
                    aria-label={`Hapus ${v.title || 'video'} dari riwayat`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
