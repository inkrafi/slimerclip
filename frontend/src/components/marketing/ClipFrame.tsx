import type { Locale } from '@/lib/i18n'

const COPY: Record<Locale, { hook: string; host: string; guest: string; caption: [string, string, string] }> = {
  id: { hook: 'Hook pembuka di sini', host: 'Host', guest: 'Tamu', caption: ['Caption', 'mengikuti', 'ucapan'] },
  en: { hook: 'Your opening hook here', host: 'Host', guest: 'Guest', caption: ['Captions', 'follow', 'speech'] },
}

function Speaker({ name, tone, active, compact }: { name: string; tone: string; active?: boolean; compact?: boolean }) {
  return (
    <div className={`relative flex-1 overflow-hidden ${tone}`}>
      {!compact && (
        <>
          <div className="absolute bottom-2 right-2 flex h-6 w-10 items-end justify-end gap-0.5" aria-hidden>
            {[40, 75, 55, 100, 65, 85, 45].map((h, i) => (
              <span key={i} className={`w-0.5 rounded-full ${active ? 'bg-white/90' : 'bg-white/35'}`} style={{ height: `${active ? h : h / 2.5}%` }} />
            ))}
          </div>
          <span className="absolute bottom-2 left-2 text-xs font-semibold text-white/90">{name}</span>
        </>
      )}
    </div>
  )
}

/** Tata letak klip 9:16 yang kami kirim (ilustrasi, bukan karya klien). Teksnya dekoratif; yang memakai menyembunyikannya dari pembaca layar bila perlu. */
export default function ClipFrame({ locale, className = '', compact, plain }: { locale: Locale; className?: string; compact?: boolean; plain?: boolean }) {
  const t = COPY[locale]
  return (
    <div className={`relative aspect-[9/16] overflow-hidden rounded-[1.75rem] border-[6px] border-[#0d0a24] bg-black shadow-[0_30px_80px_-20px_rgb(255_95_162/0.45)] ${className}`}>
      <div className="absolute inset-0 flex flex-col gap-0.5">
        <Speaker name={t.host} tone="bg-[radial-gradient(circle_at_30%_20%,#ff5fa2_0%,#3b2a8c_70%)]" active compact={compact || plain} />
        <Speaker name={t.guest} tone="bg-[radial-gradient(circle_at_70%_20%,#8f7bff_0%,#28246f_70%)]" compact={compact || plain} />
      </div>
      <p className={`absolute top-[9%] rounded bg-bay/90 text-center text-xs font-semibold leading-snug text-ink ${compact ? 'inset-x-2 px-1 py-1' : 'inset-x-3 px-2 py-1.5'}`}>{compact ? 'Hook' : plain ? t.hook.replace(/ (di sini|here)$/, '') : t.hook}</p>
      <p className={`absolute inset-x-2 top-1/2 -translate-y-1/2 text-center font-bold leading-tight text-white [text-shadow:0_1px_4px_rgb(0_0_0/0.8)] ${compact ? 'text-xs' : 'text-sm'}`}>
        {t.caption[0]} <span className="text-signal">{t.caption[1]}</span> {t.caption[2]}
      </p>
    </div>
  )
}
