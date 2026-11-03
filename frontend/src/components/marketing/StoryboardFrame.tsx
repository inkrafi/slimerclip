import type { Locale } from '@/lib/i18n'

const COPY: Record<Locale, {
  beats: { at: string; label: string }[]
  hook: string; problem: string; product: string; cta: string; button: string
}> = {
  id: {
    beats: [{ at: '0:00', label: 'Hook' }, { at: '0:08', label: 'Masalah' }, { at: '0:20', label: 'Produk' }, { at: '0:50', label: 'Ajakan' }],
    hook: 'Kalimat pembuka yang menahan orang', problem: 'Masalah yang dikenali pembelimu', product: 'Produkmu', cta: 'Nama produkmu', button: 'Coba sekarang',
  },
  en: {
    beats: [{ at: '0:00', label: 'Hook' }, { at: '0:08', label: 'Problem' }, { at: '0:20', label: 'Product' }, { at: '0:50', label: 'Call to action' }],
    hook: 'An opening line that makes people stay', problem: 'The problem your buyers recognize', product: 'Your product', cta: 'Your product name', button: 'Try it now',
  },
}

/**
 * Alur video peluncuran 60 detik sebagai animasi CSS 12 detik (ilustrasi, bukan karya klien).
 * Dengan prefers-reduced-motion hanya adegan pertama yang tampil diam (lihat .scene di globals.css).
 */
export default function StoryboardFrame({ locale, className = '' }: { locale: Locale; className?: string }) {
  const t = COPY[locale]
  return (
    <div className={`overflow-hidden rounded-lg border border-rule bg-[#120f33] shadow-[0_30px_80px_-30px_rgb(130_110_240/0.5)] ${className}`}>
      <div className="relative aspect-video overflow-hidden">
        <div className="scene absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgb(255_95_162/0.55),transparent_60%)] p-[8%]">
          <p className="type-display text-center text-ink text-[clamp(1rem,2.4vw,1.75rem)] max-w-[20ch]">{t.hook}</p>
        </div>
        <div className="scene absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_80%_20%,rgb(120_110_240/0.45),transparent_60%)] p-[8%]">
          <p className="type-display text-center text-ink text-[clamp(1rem,2.4vw,1.75rem)] max-w-[20ch]">{t.problem}</p>
        </div>
        <div className="scene absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_0%,rgb(108_120_255/0.55),transparent_65%)] p-[7%]">
          <div className="w-full max-w-[80%] rounded-md border border-rule bg-bay p-[3%]">
            <p className="text-xs font-semibold text-ink">{t.product}</p>
            <div className="mt-2 flex h-14 items-end gap-1.5 sm:h-20">
              {[35, 55, 45, 70, 60, 85, 100].map((h, i) => (
                <span key={i} className={`flex-1 rounded-t-sm ${i === 6 ? 'bg-signal' : 'bg-label-iris/40'}`} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
        <div className="scene absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_50%,rgb(255_95_162/0.4),transparent_65%)] p-[8%]">
          <p className="type-display text-center text-ink text-[clamp(1rem,2.4vw,1.75rem)]">{t.cta}</p>
          <span className="rounded-md bg-signal px-3 py-1.5 text-xs font-semibold text-[#1a1440]">{t.button}</span>
        </div>
      </div>
      <div className="border-t border-rule px-3 py-2.5">
        <div className="relative h-1 overflow-hidden rounded-full bg-rule">
          <span className="story-progress absolute inset-0 origin-left bg-signal" />
        </div>
        <ol className="mt-2 grid grid-cols-4 gap-1 text-xs">
          {t.beats.map(beat => (
            <li key={beat.at} className="min-w-0">
              <span className="timecode block text-ink-faint">{beat.at}</span>
              <span className="block truncate text-ink-muted">{beat.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
