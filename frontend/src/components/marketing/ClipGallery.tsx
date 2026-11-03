import Reveal from '@/components/marketing/Reveal'
import VideoCard from '@/components/marketing/VideoCard'
import type { Locale } from '@/lib/i18n'
import type { WorkVideo } from '@/lib/portfolio'

const COPY: Record<Locale, { play: (n: number, title: string) => string; close: string }> = {
  id: { play: (n, title) => `Putar klip ${n}${title ? `: ${title}` : ''}`, close: 'Tutup video' },
  en: { play: (n, title) => `Play clip ${n}${title ? `: ${title}` : ''}`, close: 'Close video' },
}

/** Dinding klip 9:16: kolom genap sedikit turun di layar lebar supaya tidak terasa seperti tabel. */
export default function ClipGallery({ locale, clips }: { locale: Locale; clips: WorkVideo[] }) {
  const t = COPY[locale]
  return (
    <ul className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-5 lg:pb-10">
      {clips.map((clip, i) => (
        <li key={clip.file} className="lg:even:translate-y-10">
          <Reveal delay={(i % 5) * 70}>
            <VideoCard src={clip.src} poster={clip.poster} aspect="portrait" label={t.play(i + 1, clip.title)}
              title={clip.title} meta={clip.source} closeLabel={t.close} />
          </Reveal>
        </li>
      ))}
    </ul>
  )
}
