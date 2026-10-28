'use client'

import { ArrowDownRight, ArrowUpRight, ExternalLink, Printer } from 'lucide-react'
import { useCopy, useLocale } from '@/components/LocaleProvider'
import type { PerformanceReport } from '@/lib/types'

const COPY = {
  id: {
    heading: (name: string) => `Laporan klip ${name}`,
    period: 'Periode', current: '(berjalan)', updated: (d: string) => `Angka diperbarui ${d}.`, refreshing: 'Angka sedang diperbarui, muat ulang beberapa menit lagi.',
    views: 'Views dari klip', viewsHint: 'bertambah selama periode ini', vsPrev: (m: string) => `dibanding ${m}`,
    published: 'Klip diunggah', publishedHint: 'link unggahan baru periode ini',
    avg: 'Rata-rata views', avgHint: 'per klip baru', delivered: 'Klip dikirim', deliveredHint: (a: number, r: number) => `${a} disetujui · ${r} revisi`,
    subs: 'Subscriber channel', top: 'Klip dengan views terbanyak', topEmpty: 'Belum ada klip dengan angka views di periode ini. Angka muncul setelah link klip yang sudah diunggah ditempel di halaman review.', prevMonth: 'Lihat bulan sebelumnya',
    platforms: 'Per platform', platform: 'Platform', clipsCol: 'Klip', clips: (n: number) => `${n} klip`, total: 'total', isNew: 'baru',
    unreadable: (n: number) => `${n} link belum bisa dibaca (mis. Instagram yang butuh login).`,
    print: 'Unduh PDF', score: 'skor', note: 'Views dihitung dari link Shorts/TikTok/Reels yang ditempel di halaman review. Angka platform bisa tertunda beberapa jam.',
  },
  en: {
    heading: (name: string) => `Clip report for ${name}`,
    period: 'Period', current: '(in progress)', updated: (d: string) => `Numbers updated ${d}.`, refreshing: 'Numbers are being refreshed, reload in a few minutes.',
    views: 'Views from clips', viewsHint: 'gained during this period', vsPrev: (m: string) => `vs ${m}`,
    published: 'Clips posted', publishedHint: 'new posted links this period',
    avg: 'Average views', avgHint: 'per new clip', delivered: 'Clips delivered', deliveredHint: (a: number, r: number) => `${a} approved · ${r} revised`,
    subs: 'Channel subscribers', top: 'Top clips by views', topEmpty: 'No clips with view counts in this period yet. Numbers appear once posted clip links are pasted on the review page.', prevMonth: 'See previous month',
    platforms: 'By platform', platform: 'Platform', clipsCol: 'Clips', clips: (n: number) => `${n} clip${n === 1 ? '' : 's'}`, total: 'total', isNew: 'new',
    unreadable: (n: number) => `${n} link${n === 1 ? '' : 's'} couldn't be read yet (e.g. Instagram requiring login).`,
    print: 'Download PDF', score: 'score', note: 'Views come from the Shorts/TikTok/Reels links pasted on the review page. Platform numbers can lag by a few hours.',
  },
}

const PLATFORM = { youtube: 'YouTube Shorts', tiktok: 'TikTok', instagram: 'Instagram Reels' } as Record<string, string>

function StatTile({ label, value, hint, extra }: { label: string; value: string; hint: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-rule glass p-4 print:border-black/20">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 type-display text-3xl text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{hint}</p>
      {extra}
    </div>
  )
}

/** Laporan performa bulanan satu klien. onPeriod = ganti bulan; showScores = tampilkan skor analisis (operator). */
export default function ReportView({ report, onPeriod, refreshing, showScores }: {
  report: PerformanceReport
  onPeriod: (period: string) => void
  refreshing?: boolean
  showScores?: boolean
}) {
  const t = useCopy(COPY)
  const { locale } = useLocale()
  const tag = locale === 'id' ? 'id-ID' : 'en-US'
  const num = (n: number) => new Intl.NumberFormat(tag, { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n)
  const month = (p: string) => new Date(`${p}-01T00:00:00Z`).toLocaleDateString(tag, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const tot = report.totals
  const change = report.views_change_pct
  const maxViews = Math.max(1, ...report.top_clips.map(c => c.views_in_period))
  const platforms = Object.entries(report.platforms).sort((a, b) => b[1].views - a[1].views)
  const topSub = [...report.subscribers].sort((a, b) => b.change - a.change)[0]
  const prevAvailable = report.periods.includes(report.previous.period)

  return (
    <article className="report-print pt-8 pb-16 print:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="type-display text-ink text-[clamp(1.8rem,5vw,2.6rem)]">{t.heading(report.client_name)}</h1>
          <p className="mt-1 text-ink-muted">{month(report.period)} {report.is_current && t.current}</p>
        </div>
        <button type="button" onClick={() => window.print()} className="btn btn-sm btn-quiet print:hidden"><Printer className="size-4" aria-hidden /> {t.print}</button>
      </div>

      {/* Periode = kontrol pertama dan selalu terlihat (pola Analytics) */}
      <div className="mt-6 flex items-center gap-2 print:hidden">
        <label htmlFor="report-period" className="text-sm text-ink-muted">{t.period}</label>
        <select id="report-period" value={report.period} onChange={e => onPeriod(e.target.value)}
          className="h-9 rounded-md border border-rule bg-bay px-2 text-sm text-ink">
          {report.periods.map(p => <option key={p} value={p}>{month(p)}</option>)}
        </select>
      </div>

      <section aria-label={t.views} className={`mt-6 grid grid-cols-2 gap-3 ${topSub ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <StatTile label={t.views} value={num(tot.views)} hint={t.viewsHint} extra={change !== null && (
          <p className={`mt-2 inline-flex items-center gap-1 text-xs ${change >= 0 ? 'text-teal' : 'text-tally'}`}>
            {change >= 0 ? <ArrowUpRight className="size-4" aria-hidden /> : <ArrowDownRight className="size-4" aria-hidden />}
            {change >= 0 ? '+' : ''}{change}% <span className="text-ink-muted">{t.vsPrev(month(report.previous.period))}</span>
          </p>
        )} />
        <StatTile label={t.published} value={num(tot.published)} hint={t.publishedHint} />
        <StatTile label={t.avg} value={tot.avg_views_new === null ? '–' : num(tot.avg_views_new)} hint={t.avgHint} />
        <StatTile label={t.delivered} value={num(tot.delivered)} hint={t.deliveredHint(tot.approved, tot.revision)} />
        {/* Maks 5 kartu: channel dengan pertambahan subscriber terbesar */}
        {topSub && (
          <StatTile label={t.subs} value={`${topSub.change >= 0 ? '+' : ''}${num(topSub.change)}`}
            hint={`${topSub.name}: ${num(topSub.start)} → ${num(topSub.end)}`} />
        )}
      </section>

      <section aria-labelledby="top-title" className="mt-10">
        <h2 id="top-title" className="type-heading text-xl text-ink">{t.top}</h2>
        {report.top_clips.length === 0 ? (
          <div className="mt-3 print:hidden">
            <p className="max-w-[60ch] text-ink-muted">{t.topEmpty}</p>
            {prevAvailable && (
              <button type="button" onClick={() => onPeriod(report.previous.period)} className="btn btn-sm btn-quiet mt-3">{t.prevMonth}</button>
            )}
          </div>
        ) : (
          <ol className="mt-4 divide-y divide-rule rounded-lg border border-rule bg-panel print:border-black/20">
            {report.top_clips.map((clip, i) => (
              <li key={`${clip.url}-${i}`} className="flex items-center gap-3 px-4 py-3">
                <span className="w-5 shrink-0 timecode text-sm text-ink-faint">{i + 1}</span>
                {clip.thumbnail_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={clip.thumbnail_url} alt="" className="h-14 w-8 shrink-0 rounded object-cover border border-rule" />
                  : <span className="h-14 w-8 shrink-0 rounded border border-rule bg-bay" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <a href={clip.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-ink hover:underline underline-offset-4">
                      {clip.title || clip.url} <ExternalLink className="inline size-3 text-ink-faint print:hidden" aria-hidden />
                    </a>
                    <span className="shrink-0 timecode text-sm text-ink tabular-nums">{num(clip.views_in_period)}</span>
                  </div>
                  {/* Batang tipis satu warna (besaran), ujung membulat 4px, menempel di garis awal */}
                  <div className="mt-2 h-2 rounded-r bg-rule/40" aria-hidden>
                    <div className="h-full rounded-r bg-signal" style={{ width: `${Math.max(2, (clip.views_in_period / maxViews) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {PLATFORM[clip.platform] ?? clip.platform} · {num(clip.views)} {t.total}
                    {clip.new_in_period && <> · <span className="text-ink">{t.isNew}</span></>}
                    {showScores && clip.viral_score != null && <> · {t.score} {clip.viral_score}</>}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {platforms.length > 0 && (
        <section aria-labelledby="platform-title" className="mt-10">
          <h2 id="platform-title" className="type-heading text-xl text-ink">{t.platforms}</h2>
          <div className="mt-3 max-w-md overflow-hidden rounded-lg border border-rule bg-panel">
            <table className="w-full text-sm">
              <thead className="border-b border-rule text-left text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">{t.platform}</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">{t.clipsCol}</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {platforms.map(([p, v]) => (
                  <tr key={p}>
                    <th scope="row" className="px-4 py-2 text-left font-normal text-ink">{PLATFORM[p] ?? p}</th>
                    <td className="px-4 py-2 text-right text-ink-muted">{v.clips}</td>
                    <td className="px-4 py-2 text-right timecode text-ink tabular-nums">{num(v.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="mt-12 space-y-1 text-xs text-ink-faint">
        {refreshing ? <p>{t.refreshing}</p>
          : report.updated_at && <p>{t.updated(new Date(report.updated_at * 1000).toLocaleString(tag, { dateStyle: 'medium', timeStyle: 'short' }))}</p>}
        {tot.unreadable > 0 && <p>{t.unreadable(tot.unreadable)}</p>}
        <p>{t.note}</p>
      </footer>
    </article>
  )
}

/** Kerangka laporan saat dimuat (bentuk sama dengan isinya, bukan spinner) */
export function ReportSkeleton() {
  return (
    <div className="pt-8" aria-busy="true" aria-label="Memuat laporan">
      <div className="skeleton h-10 w-2/3 max-w-md" />
      <div className="skeleton mt-6 h-9 w-48" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-28" />)}
      </div>
      <div className="mt-10 space-y-3">{[0, 1, 2].map(i => <div key={i} className="skeleton h-14" />)}</div>
    </div>
  )
}
