'use client'

import Link from 'next/link'
import AnalyzeForm from '@/components/AnalyzeForm'
import { useCopy } from '@/components/LocaleProvider'
import { useInView } from '@/hooks/useInView'
import { LandingMedia } from '@/hooks/useLandingMedia'
import StudioImage from './StudioImage'

interface Props {
  media: LandingMedia
  onSubmit: (url: string) => string | void
  /** Keterangan di bawah form (uji coba gratis / sisa jatah) */
  note?: string
}

const COPY = {
  id: {
    continue: 'Lanjutkan dari riwayat', all: 'Semua riwayat', untitled: 'Video tanpa judul',
    moments: (n: number) => `${n} momen`, saved: (n: number) => `, ${n} klip tersimpan`,
    cta: 'Podcast berikutnya, tinggal tempel linknya.',
  },
  en: {
    continue: 'Pick up where you left off', all: 'All history', untitled: 'Untitled video',
    moments: (n: number) => `${n} moment${n === 1 ? '' : 's'}`, saved: (n: number) => `, ${n} clip${n === 1 ? '' : 's'} saved`,
    cta: 'Your next podcast is one link away.',
  },
}

export default function LibraryCta({ media, onSubmit, note }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2)
  const t = useCopy(COPY)
  const recent = media.videos.slice(0, 3)
  const marquee = media.videos.length ? media.videos.map(v => v.video_id) : [undefined, undefined, undefined, undefined]

  return (
    <>
      {recent.length > 0 && (
        <section aria-labelledby="library-title" className="py-24 border-t border-rule">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="library-title" className="type-display text-ink text-[clamp(2rem,4vw,3.25rem)]">{t.continue}</h2>
            <Link href="/riwayat" className="text-ink-muted underline underline-offset-4 decoration-rule hover:text-ink">{t.all}</Link>
          </div>
          <div ref={ref} className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((v, i) => (
              <Link
                key={v.video_id}
                href={`/video/${v.video_id}`}
                className={`reveal ${inView ? 'is-in' : ''} group block`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="aspect-video overflow-hidden rounded-lg border border-rule">
                  <StudioImage videoId={v.video_id} className="size-full transition-transform duration-500 group-hover:scale-[1.04]" />
                </div>
                <p className="mt-3 font-semibold text-ink leading-snug line-clamp-2 group-hover:text-signal">{v.title || t.untitled}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {t.moments(v.segment_count)}{v.clip_count > 0 && <span className="text-sage">{t.saved(v.clip_count)}</span>}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Deretan thumbnail yang terus bergulir */}
      <div className="relative -mx-4 sm:-mx-6 overflow-hidden py-6 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]" aria-hidden>
        <div className="drift-slow flex w-max gap-4">
          {[...marquee, ...marquee, ...marquee, ...marquee].map((id, i) => (
            <div key={i} className="w-56 aspect-video shrink-0 overflow-hidden rounded-lg border border-rule opacity-70">
              <StudioImage videoId={id} variant={i} className="size-full" />
            </div>
          ))}
        </div>
      </div>

      <section aria-labelledby="cta-title" className="py-24 text-center">
        <h2 id="cta-title" className="type-display text-ink text-[clamp(2.2rem,5vw,4rem)] max-w-[18ch] mx-auto">
          {t.cta}
        </h2>
        <div className="mt-10 max-w-2xl mx-auto text-left">
          <AnalyzeForm onSubmit={onSubmit} isLoading={false} size="lg" />
          {note && <p className="mt-3 text-sm text-ink-muted">{note}</p>}
        </div>
      </section>
    </>
  )
}
