import Reveal from '@/components/marketing/Reveal'
import VideoCard from '@/components/marketing/VideoCard'
import type { Locale } from '@/lib/i18n'
import type { WorkVideo } from '@/lib/portfolio'

const COPY: Record<Locale, { play: (n: number, title: string) => string; close: string; concept: string }> = {
  id: { play: (n, title) => `Putar video konsep ${n}${title ? `: ${title}` : ''}`, close: 'Tutup video', concept: 'Karya konsep' },
  en: { play: (n, title) => `Play concept video ${n}${title ? `: ${title}` : ''}`, close: 'Close video', concept: 'Concept piece' },
}

/** Showreel motion: video pertama besar, sisanya berdampingan. Semua berlabel karya konsep. */
export default function MotionGallery({ locale, videos }: { locale: Locale; videos: WorkVideo[] }) {
  const t = COPY[locale]
  return (
    <ul className="grid gap-5 md:grid-cols-2">
      {videos.map((video, i) => (
        <li key={video.file} className={i === 0 && videos.length !== 2 ? 'md:col-span-2' : ''}>
          <Reveal delay={i * 90}>
            <VideoCard src={video.src} poster={video.poster} aspect="landscape" label={t.play(i + 1, video.title)}
              title={video.title} meta={video.source} tag={t.concept} closeLabel={t.close} />
          </Reveal>
        </li>
      ))}
    </ul>
  )
}
