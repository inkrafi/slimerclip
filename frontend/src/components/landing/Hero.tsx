'use client'

import AnalyzeForm from '@/components/AnalyzeForm'
import ScoreMeter from '@/components/ScoreMeter'
import { useScrollProgress } from '@/hooks/useScrollProgress'
import { LandingMedia } from '@/hooks/useLandingMedia'
import StudioImage from './StudioImage'

interface Props {
  media: LandingMedia
  onSubmit: (url: string) => string | void
}

/** Lapisan parallax: bergeser vertikal sebanyak `distance` px saat hero di-scroll keluar. */
const lift = (distance: number) => ({ transform: `translate3d(0, calc(var(--p, 0) * ${-distance}px), 0)` })

export default function Hero({ media, onSubmit }: Props) {
  const ref = useScrollProgress<HTMLElement>('pass')
  const ids = media.videos.map(v => v.video_id)
  // Pita thumbnail: video dari riwayat, atau ilustrasi jika riwayat masih kosong
  const strip = ids.length ? [...ids, ...ids, ...ids].slice(0, 8) : Array.from({ length: 8 }, () => undefined)
  const showcase = media.showcase

  return (
    <section ref={ref} className="relative grid gap-12 lg:gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] items-center pt-12 md:pt-16 pb-20">
      <div className="relative z-10">
        <h1 className="type-display text-ink text-[clamp(2.2rem,3.7vw,3.6rem)]">
          <span className="rise">Penonton sudah</span>
          <span className="rise" style={{ animationDelay: '140ms' }}>memilih momennya.</span>
          <span className="rise" style={{ animationDelay: '280ms' }}>Kamu tinggal unggah.</span>
        </h1>

        {/* Garis waktu di bawah judul: podcast 2 jam, dengan bagian yang paling sering diputar ulang */}
        <div className="rise mt-6 max-w-md" style={{ animationDelay: '420ms' }} aria-hidden>
          <div className="relative h-1.5 rounded-full bg-rule">
            <span className="absolute inset-y-0 left-[63%] w-[4%] rounded-full bg-signal shadow-[0_0_18px_var(--color-signal)]" />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-ink-faint timecode">
            <span>0:00</span>
            <span className="text-ink-muted">paling sering diputar ulang: 1:15:40–1:16:20</span>
            <span>2:00:00</span>
          </div>
        </div>

        <p className="rise mt-6 max-w-[54ch] text-lg leading-relaxed text-ink-muted" style={{ animationDelay: '520ms' }}>
          Aplikasi klip lain menebak pakai AI. SlimerClip membaca bagian yang benar-benar diputar ulang
          penonton YouTube, lalu memotongnya jadi klip 9:16 yang mengikuti siapa pun yang sedang bicara.
        </p>

        <div className="rise mt-8 max-w-2xl" style={{ animationDelay: '620ms' }}>
          <AnalyzeForm onSubmit={onSubmit} isLoading={false} size="lg" />
        </div>
      </div>

      {/* Visual: pita thumbnail, bingkai HP, kartu skor — tiap lapisan bergerak dengan kecepatan berbeda */}
      <div className="relative h-[460px] sm:h-[540px]" aria-hidden>
        {/* Pita dibatasi di kolom ini (memudar di tepi) agar tidak lewat di belakang judul */}
        <div className="absolute inset-0 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_18%,black_85%,transparent)]">
        <div className="absolute -left-[30%] -right-[30%] top-24 -rotate-6" style={lift(40)}>
          <div className="drift flex w-max gap-3">
            {[...strip, ...strip].map((id, i) => (
              <div key={i} className="w-44 sm:w-52 aspect-video shrink-0 overflow-hidden rounded-lg border border-rule opacity-80">
                <StudioImage videoId={id} variant={i} className="size-full" />
              </div>
            ))}
          </div>
          {/* Penanda momen di atas pita, seperti peta potongan */}
          <div className="relative mt-3 h-6">
            {[12, 31, 47, 66, 83].map((x, i) => (
              <span
                key={x}
                className="absolute bottom-0 w-1.5 rounded-t-sm"
                style={{ left: `${x}%`, height: `${40 + ((i * 37) % 60)}%`, background: ['var(--color-label-cerulean)', 'var(--color-signal)', 'var(--color-label-caribbean)', 'var(--color-label-iris)', 'var(--color-label-rose)'][i] }}
              />
            ))}
          </div>
        </div>
        </div>

        <div className="absolute right-[6%] top-0 w-[220px] sm:w-[250px]" style={lift(110)}>
          <div className="relative aspect-[9/16] overflow-hidden rounded-[2rem] border-[7px] border-[#0d0a24] bg-black shadow-[0_30px_80px_-20px_rgb(255_95_162/0.45)]">
            {/* Split dari thumbnail asli: terlihat selama video belum diputar (atau jika belum ada klip) */}
            <div className="absolute inset-0 flex flex-col">
              <StudioImage videoId={showcase?.videoId ?? ids[0]} variant={1} className="h-1/2 w-full object-[20%_40%]" />
              <StudioImage videoId={showcase?.videoId ?? ids[0]} variant={2} className="h-1/2 w-full object-[80%_40%]" />
            </div>
            {showcase && (
              <video src={showcase.url} autoPlay muted loop playsInline className="relative size-full object-cover" />
            )}
          </div>
          {showcase && (
            <p className="mt-3 text-xs text-ink-muted line-clamp-2">Klip asli dari pustakamu: {showcase.topic || showcase.videoTitle}</p>
          )}
        </div>

        <div className="absolute left-[4%] bottom-16 rounded-lg border border-rule glass px-4 py-3" style={lift(200)}>
          <p className="text-xs text-ink-muted">Momen terkuat</p>
          <div className="mt-1.5"><ScoreMeter score={92} /></div>
        </div>

        <div className="absolute left-0 top-4 max-w-[12rem] rounded-lg border border-rule glass px-3 py-2 text-xs text-ink" style={lift(160)}>
          <span className="timecode font-semibold">31:51–32:48</span>
          <span className="block text-ink-muted">paling sering diputar ulang</span>
        </div>
      </div>
    </section>
  )
}
