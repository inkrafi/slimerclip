import { toast } from 'sonner'
import { VideoMetadata } from '@/lib/types'
import { formatClock } from '@/lib/clip-meta'

interface Props {
  summary: string
  metadata?: VideoMetadata
  youtubeUrl?: string
}

function formatViews(views: number) {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1).replace('.', ',')} jt`
  if (views >= 1_000) return `${(views / 1_000).toFixed(1).replace('.', ',')} rb`
  return views.toString()
}

function openYTDown(youtubeUrl: string) {
  navigator.clipboard.writeText(youtubeUrl).catch(() => {})
  toast.success('Link disalin. Tempel di YTDown untuk mengunduh videonya.', { duration: 4000 })
  window.open('https://app.ytdown.to/id29/', '_blank', 'noopener')
}

/** Kepala hasil analisis: video sumber + ringkasan isinya. */
export default function SummaryBar({ summary, metadata, youtubeUrl }: Props) {
  return (
    <header className="flex flex-col md:flex-row gap-5 md:gap-7">
      {metadata?.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={metadata.thumbnail}
          alt=""
          className="w-full md:w-60 self-start aspect-video object-cover rounded-md border border-rule shrink-0"
        />
      )}

      <div className="min-w-0 flex-1">
        {metadata && (
          <>
            <h1 className="type-heading text-2xl md:text-[1.75rem] text-ink text-balance">
              {metadata.title || 'Video tanpa judul'}
            </h1>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
              {metadata.channel && <span>{metadata.channel}</span>}
              {metadata.duration > 0 && <span className="timecode">{formatClock(metadata.duration)}</span>}
              {metadata.view_count > 0 && <span>{formatViews(metadata.view_count)} tayangan</span>}
            </p>
          </>
        )}

        {summary && <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-ink/85">{summary}</p>}

        {youtubeUrl && (
          <button type="button" onClick={() => openYTDown(youtubeUrl)} className="mt-4 text-sm text-ink-muted underline underline-offset-4 decoration-rule hover:text-ink hover:decoration-ink-muted">
            Unduh video sumber lewat YTDown
          </button>
        )}
      </div>
    </header>
  )
}
