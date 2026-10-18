'use client'

import Link from 'next/link'
import AnalyzeForm from '@/components/AnalyzeForm'
import { useInView } from '@/hooks/useInView'
import { LandingMedia } from '@/hooks/useLandingMedia'
import StudioImage from './StudioImage'

interface Props {
  media: LandingMedia
  onSubmit: (url: string) => string | void
}

export default function LibraryCta({ media, onSubmit }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2)
  const recent = media.videos.slice(0, 3)
  const marquee = media.videos.length ? media.videos.map(v => v.video_id) : [undefined, undefined, undefined, undefined]

  return (
    <>
      {recent.length > 0 && (
        <section aria-labelledby="library-title" className="py-24 border-t border-rule">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="library-title" className="type-display text-ink text-[clamp(2rem,4vw,3.25rem)]">Lanjutkan dari riwayat</h2>
            <Link href="/riwayat" className="text-ink-muted underline underline-offset-4 decoration-rule hover:text-ink">Semua riwayat</Link>
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
                <p className="mt-3 font-semibold text-ink leading-snug line-clamp-2 group-hover:text-signal">{v.title || 'Video tanpa judul'}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {v.segment_count} momen{v.clip_count > 0 && <span className="text-sage">, {v.clip_count} klip tersimpan</span>}
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
          Podcast berikutnya, tinggal tempel linknya.
        </h2>
        <div className="mt-10 max-w-2xl mx-auto text-left">
          <AnalyzeForm onSubmit={onSubmit} isLoading={false} size="lg" />
        </div>
      </section>
    </>
  )
}
