import type { CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import ClipFrame from '@/components/marketing/ClipFrame'
import ContactButtons from '@/components/marketing/ContactButtons'
import ScrubDriver from '@/components/marketing/ScrubDriver'
import StoryboardFrame from '@/components/marketing/StoryboardFrame'
import type { Locale } from '@/lib/i18n'

interface Props {
  locale: Locale
  kicker: string
  title: string
  lead: string
  cta: string
  hint: string
  /** Tiga kalimat cerita, lalu kalimat penutup motion */
  story: [string, string, string, string]
  note: string
  message: string
  subject: string
}

const SPEAKERS: Record<Locale, { host: string; guest: string; replay: string }> = {
  id: { host: 'Host', guest: 'Tamu', replay: 'Grafik tonton ulang' },
  en: { host: 'Host', guest: 'Guest', replay: 'Replay graph' },
}

/** Grafik tonton ulang contoh; dua batang di sekitar 63% adalah puncaknya */
const BARS = Array.from({ length: 40 }, (_, i) => {
  if (i === 25 || i === 26) return i === 25 ? 100 : 90
  return Math.round(Math.max(12, 26 + 13 * Math.sin(i * 0.8) + 8 * Math.sin(i * 0.31 + 1)))
})

const band = (from: number, to: number): CSSProperties => ({ '--a': from, '--d': to, visibility: from < 0 ? 'visible' : 'hidden' } as CSSProperties)

/**
 * Elemen khas situs: satu layar di kanan yang berubah mengikuti scroll. Rekaman podcast 16:9 → grafik tonton ulang
 * menemukan puncaknya → bingkai menyempit jadi klip 9:16 → klip bergeser dan storyboard motion video masuk.
 */
export default function ScrubHero({ locale, kicker, title, lead, cta, hint, story, note, message, subject }: Props) {
  const t = SPEAKERS[locale]
  return (
    <ScrubDriver>
      <div className="scrub-stage">
        <div className="relative mx-auto h-full max-w-6xl px-6">
          <div className="scrub-band scrub-copy" data-band data-from={-1} data-to={0.15} style={band(-1, 0.15)}>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-label-iris">{kicker}</p>
            <h1 className="scrub-title text-glow mt-4 type-display text-ink">{title}</h1>
            <p className="mt-4 max-w-[46ch] leading-relaxed text-ink-muted">{lead}</p>
            <div className="mt-6"><ContactButtons locale={locale} message={message} subject={subject} primaryLabel={cta} primaryOnly /></div>
          </div>

          <p className="scrub-band scrub-copy scrub-line text-glow type-display text-ink" data-band data-from={0.17} data-to={0.37} style={band(0.17, 0.37)}>{story[0]}</p>
          <p className="scrub-band scrub-copy scrub-line text-glow type-display text-ink" data-band data-from={0.38} data-to={0.55} style={band(0.38, 0.55)}>{story[1]}</p>
          <p className="scrub-band scrub-copy scrub-line text-glow type-display text-ink" data-band data-from={0.56} data-to={0.75} style={band(0.56, 0.75)}>{story[2]}</p>

          <div className="scrub-band scrub-copy" data-band data-from={0.76} data-to={2} style={band(0.76, 2)}>
            <p className="scrub-line text-glow type-display text-ink">{story[3]}</p>
            <div className="mt-8"><ContactButtons locale={locale} message={message} subject={subject} primaryLabel={cta} primaryOnly /></div>
          </div>

          <div className="scrub-visual" aria-hidden>
            <div className="scrub-board"><StoryboardFrame locale={locale} /></div>

            <div className="scrub-screen">
              <div className="scrub-scene">
                <div className="absolute inset-0 grid grid-cols-2 gap-0.5 bg-black">
                  <div className="relative bg-[radial-gradient(circle_at_40%_25%,#ff5fa2_0%,#3b2a8c_72%)]">
                    <span className="absolute left-3 top-3 text-xs font-semibold text-white/90">{t.host}</span>
                  </div>
                  <div className="relative bg-[radial-gradient(circle_at_60%_25%,#8f7bff_0%,#28246f_72%)]">
                    <span className="absolute right-3 top-3 text-xs font-semibold text-white/90">{t.guest}</span>
                  </div>
                </div>
                <div className="scrub-graph absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-4 pb-3 pt-10">
                  <div className="mb-2 flex items-baseline justify-between text-xs text-white/85">
                    <span>{t.replay}</span>
                    <span className="timecode"><span className="font-semibold text-white" data-clock>00:00:00</span> / 02:00:00</span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-end gap-[3px]">
                      {BARS.map((height, i) => <span key={i} className="flex-1 rounded-t-sm bg-white/15" style={{ height: `${height}%` }} />)}
                    </div>
                    <div className="scrub-bars relative flex h-16 items-end gap-[3px]">
                      {BARS.map((height, i) => (
                        <span key={i} className={`flex-1 rounded-t-sm ${i === 25 || i === 26 ? 'scrub-peak' : 'bg-white/45'}`} style={{ height: `${height}%` }} />
                      ))}
                    </div>
                    <span className="scrub-playhead" />
                  </div>
                </div>
              </div>
              <div className="scrub-clip"><ClipFrame locale={locale} plain /></div>
            </div>
          </div>

          <p className="scrub-hint absolute bottom-[3vh] left-6 flex items-center gap-2 text-sm text-ink-muted"><ChevronDown className="size-4" aria-hidden /> {hint}</p>
          <p className="absolute bottom-[3vh] right-6 text-xs text-ink-muted">{note}</p>
        </div>
      </div>
    </ScrubDriver>
  )
}
