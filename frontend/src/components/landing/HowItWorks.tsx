'use client'

import { Check } from 'lucide-react'
import CutMap from '@/components/CutMap'
import { useInView } from '@/hooks/useInView'
import { useCopy } from '@/components/LocaleProvider'

const SAMPLE = [
  { segment_number: 1, start_time: '38:12', end_time: '39:05', viral_score: 94, content_angle: 'KONTROVERSI' },
  { segment_number: 2, start_time: '71:40', end_time: '72:25', viral_score: 86, content_angle: 'EDUKASI' },
  { segment_number: 3, start_time: '12:03', end_time: '12:48', viral_score: 81, content_angle: 'HIBURAN' },
  { segment_number: 4, start_time: '95:10', end_time: '96:02', viral_score: 74, content_angle: 'INSPIRASI' },
  { segment_number: 5, start_time: '54:30', end_time: '55:20', viral_score: 66, content_angle: 'TUTORIAL' },
]

const COPY = {
  id: {
    title: 'Dari link ke klip siap unggah, tiga langkah.', find: 'Cari momen', mapLabel: 'Contoh peta potongan',
    s1: 'Tempel link podcast', s1b: 'Transkrip, metadata, dan grafik bagian yang paling sering diputar ulang diambil langsung dari YouTube.',
    s2: 'Pilih momen terkuat', s2b: 'Tiap momen punya skor, alasan kenapa layak dipotong, kutipan terkuat, tiga pilihan hook, dan caption.',
    s3: 'Render, lalu unduh', s3b: 'Render berjalan di belakang layar. Hasilnya tersimpan, jadi bisa diputar dan diunduh lagi kapan saja.',
    clip: 'Klip', saved: 'Tersimpan',
  },
  en: {
    title: 'From link to ready-to-post clips in three steps.', find: 'Find moments', mapLabel: 'Example cut map',
    s1: 'Paste a podcast link', s1b: 'The transcript, metadata, and most-replayed graph are pulled straight from YouTube.',
    s2: 'Pick the strongest moments', s2b: 'Each moment comes with a score, why it is worth clipping, its strongest quote, three hook options, and a caption.',
    s3: 'Render, then download', s3b: 'Rendering runs in the background. Results are saved, so you can play and download them again any time.',
    clip: 'Clip', saved: 'Saved',
  },
}

export default function HowItWorks() {
  const { ref, inView } = useInView<HTMLElement>(0.2)
  const t = useCopy(COPY)
  const step = (i: number) => ({ className: `reveal ${inView ? 'is-in' : ''}`, style: { transitionDelay: `${i * 140}ms` } })

  return (
    <section ref={ref} aria-labelledby="how-title" className="py-24 border-t border-rule">
      <h2 id="how-title" className="type-display text-ink text-[clamp(2rem,4vw,3.25rem)] max-w-[18ch]">
        {t.title}
      </h2>

      <ol className="mt-14 grid gap-6 md:grid-cols-3">
        <li {...step(0)}>
          <div className="h-44 rounded-lg border border-rule glass p-5 flex flex-col justify-center" aria-hidden>
            <div className="field h-11 text-sm text-ink">
              <span className="typing timecode">youtube.com/watch?v=JbkjRkhacss</span>
            </div>
            <div className="mt-3 self-end btn btn-primary btn-sm">{t.find}</div>
          </div>
          <h3 className="mt-5 type-heading text-xl text-ink"><span className="text-signal">1.</span> {t.s1}</h3>
          <p className="mt-2 text-ink-muted leading-relaxed">
            {t.s1b}
          </p>
        </li>

        <li {...step(1)}>
          <div className="h-44 rounded-lg border border-rule glass px-4 pt-1 flex items-center overflow-hidden" aria-hidden>
            {inView && <CutMap segments={SAMPLE} duration={6432} animate compact label={t.mapLabel} />}
          </div>
          <h3 className="mt-5 type-heading text-xl text-ink"><span className="text-signal">2.</span> {t.s2}</h3>
          <p className="mt-2 text-ink-muted leading-relaxed">
            {t.s2b}
          </p>
        </li>

        <li {...step(2)}>
          <div className="h-44 rounded-lg border border-rule glass p-5 flex items-center gap-5" aria-hidden>
            <div className="w-16 aspect-[9/16] rounded-lg border-[3px] border-[#0d0a24] overflow-hidden bg-gradient-to-b from-[#3a2f8a] to-[#ff5fa2]/60" />
            <div className="flex-1 space-y-3">
              {[100, 100, 64].map((w, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs text-ink-muted">
                    <span>{t.clip} {i + 1}</span>
                    {w === 100 ? <span className="text-sage inline-flex items-center gap-1"><Check className="size-3" />{t.saved}</span> : <span className="timecode">{w}%</span>}
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-rule overflow-hidden">
                    <div className="fill-bar h-full bg-signal" style={{ width: `${w}%`, transitionDelay: `${400 + i * 300}ms` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <h3 className="mt-5 type-heading text-xl text-ink"><span className="text-signal">3.</span> {t.s3}</h3>
          <p className="mt-2 text-ink-muted leading-relaxed">
            {t.s3b}
          </p>
        </li>
      </ol>
    </section>
  )
}
