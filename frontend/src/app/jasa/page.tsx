import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, MessageCircle, Mail } from 'lucide-react'
import { CONTACT, PORTFOLIO, PORTFOLIO_CHANNEL } from '@/content/service'
import { getLocale } from '@/lib/locale-server'
import type { Locale } from '@/lib/i18n'

type Plan = { name: string; price: string; unit?: string; items: string[]; featured?: boolean }

const COPY: Record<Locale, {
  metaTitle: string; metaDesc: string
  kicker: string; title: string; lead: string; ctaPrimary: string; ctaSecondary: string
  whyTitle: string; why: { title: string; body: string }[]
  stepsTitle: string; steps: { title: string; body: string }[]
  plansTitle: string; plansNote: string; popular: string; plans: Plan[]
  portfolioTitle: string; portfolioEmpty: string; portfolioAll: string; views: string
  faqTitle: string; faq: { q: string; a: string }[]
  contactTitle: string; contactBody: string; contactWa: string; contactEmail: string; contactFallback: string
  waMessage: string; emailSubject: string
}> = {
  id: {
    metaTitle: 'Jasa clipping podcast: momen terbaik jadi klip 9:16 | SlimerClip',
    metaDesc: 'Jasa clipping podcast & video panjang jadi Shorts, TikTok, dan Reels. Dipilih dari data tonton ulang YouTube, lengkap hook, caption, musik, dan thumbnail.',
    kicker: 'Jasa clipping',
    title: 'Podcastmu jadi klip yang ditonton sampai habis.',
    lead: 'Kirim link atau file videonya. Kami pilih momen terkuat dari data tonton ulang YouTube, lalu menyuntingnya jadi klip 9:16 lengkap dengan hook, caption, musik, efek suara, thumbnail, dan judul siap upload.',
    ctaPrimary: 'Mulai konsultasi gratis', ctaSecondary: 'Lihat paket',
    whyTitle: 'Kenapa pakai kami',
    why: [
      { title: 'Momen dipilih dari data penonton', body: 'Bukan tebakan: bagian yang paling sering diputar ulang di YouTube jadi prioritas, lalu dicek manusia.' },
      { title: 'Kamera mengikuti yang bicara', body: 'Wajah dilacak per detik; dua orang bergantian bicara → layar dibagi otomatis. Tidak ada wajah terpotong.' },
      { title: 'Siap upload, bukan setengah jadi', body: 'Hook pembuka, caption, musik, efek suara, thumbnail, plus 3 pilihan judul, deskripsi, dan hashtag.' },
      { title: 'Indonesia & Inggris', body: 'Klip Inggris dengan subtitle Indonesia (atau sebaliknya) untuk menjangkau penonton baru.' },
    ],
    stepsTitle: 'Cara kerjanya',
    steps: [
      { title: 'Kirim videonya', body: 'Link YouTube atau file asli (kualitas terbaik), plus niche & gaya yang kamu mau.' },
      { title: 'Kami pilih & sunting', body: 'Momen terkuat dipotong rapi di jeda bicara, diberi hook, caption, dan musik sesuai suasana.' },
      { title: 'Revisi lalu kirim', body: 'Klip, thumbnail, dan teks upload dikirim lewat Google Drive. Revisi sesuai paket.' },
    ],
    plansTitle: 'Paket', plansNote: 'Harga per bulan kecuali disebut lain. Pembayaran lewat transfer bank atau QRIS, DP 50% untuk klien baru.',
    popular: 'Paling dipilih',
    plans: [
      { name: 'Coba gratis', price: 'Rp0', items: ['3 klip dari 1 episode', 'Hook, caption & thumbnail', 'Tanpa komitmen'] },
      { name: 'Satuan', price: 'Rp50 rb', unit: '/ klip', items: ['Minimal 5 klip', 'Hook, caption, musik, thumbnail', 'Judul, deskripsi & hashtag', '1× revisi'] },
      { name: 'Starter', price: 'Rp750 rb', unit: '/ bulan', items: ['20 klip per bulan', 'Semua fitur edit', '1× revisi per klip'] },
      { name: 'Growth', price: 'Rp1,4 jt', unit: '/ bulan', featured: true, items: ['40 klip per bulan', 'Subtitle terjemahan ID/EN', '2× revisi per klip', 'Prioritas pengerjaan'] },
      { name: 'Pro', price: 'Rp2,5 jt', unit: '/ bulan', items: ['60 klip per bulan', 'Format edit khas brand-mu', '2× revisi per klip', 'Laporan performa bulanan'] },
    ],
    portfolioTitle: 'Contoh hasil', portfolioEmpty: 'Contoh klip sedang disiapkan. Sementara itu, lihat hasil kami langsung di channel YouTube.',
    portfolioAll: 'Lihat semua hasil di YouTube', views: 'views',
    faqTitle: 'Pertanyaan umum',
    faq: [
      { q: 'Berapa lama pengerjaannya?', a: 'Biasanya 1–3 hari kerja per episode, tergantung jumlah klip. Paket Growth & Pro diprioritaskan.' },
      { q: 'Musiknya aman dari klaim hak cipta?', a: 'Kami pakai musik bebas royalti atau musik berlisensi milikmu. Lagu viral berhak cipta bisa membuat video di-mute, jadi tidak kami pakai tanpa izin.' },
      { q: 'Perlu kirim file asli?', a: 'Disarankan. File asli menghasilkan gambar lebih tajam dan proses lebih cepat. Link YouTube juga bisa untuk video milikmu.' },
      { q: 'Bisa untuk selain podcast?', a: 'Bisa: video edukasi satu orang, seminar/panggung, siaran streamer, dan streaming game (gameplay di atas, facecam di bawah).' },
    ],
    contactTitle: 'Ceritakan channelmu', contactBody: 'Kirim link video dan niche channelmu. Kami balas dengan contoh 3 klip gratis.',
    contactWa: 'Chat WhatsApp', contactEmail: 'Kirim email', contactFallback: 'Coba sendiri gratis',
    waMessage: 'Halo, saya tertarik jasa clipping SlimerClip. Channel saya: ', emailSubject: 'Jasa clipping SlimerClip',
  },
  en: {
    metaTitle: 'Podcast clipping service: your best moments as 9:16 clips | SlimerClip',
    metaDesc: 'Podcast and long-form video clipping for Shorts, TikTok, and Reels. Picked from YouTube replay data, with hooks, captions, music, and thumbnails.',
    kicker: 'Clipping service',
    title: 'Turn your podcast into clips people watch to the end.',
    lead: 'Send us a link or the video file. We pick the strongest moments from YouTube replay data, then edit them into 9:16 clips with hooks, captions, music, sound effects, thumbnails, and ready-to-post titles.',
    ctaPrimary: 'Get a free consultation', ctaSecondary: 'See pricing',
    whyTitle: 'Why work with us',
    why: [
      { title: 'Moments picked from viewer data', body: 'Not guesswork: the most replayed parts on YouTube come first, then a human reviews every pick.' },
      { title: 'The camera follows the speaker', body: "Faces are tracked every second; when two people take turns, the screen splits automatically. No cut-off faces." },
      { title: 'Ready to post, not half-done', body: 'Opening hook, captions, music, sound effects, thumbnail, plus 3 title options, a description, and hashtags.' },
      { title: 'English & Indonesian', body: 'English clips with Indonesian subtitles (or the other way round) to reach new audiences.' },
    ],
    stepsTitle: 'How it works',
    steps: [
      { title: 'Send your video', body: 'A YouTube link or the original file (best quality), plus your niche and preferred style.' },
      { title: 'We pick & edit', body: 'The strongest moments are cut cleanly at speech pauses, with hooks, captions, and mood-matched music.' },
      { title: 'Review, then deliver', body: 'Clips, thumbnails, and upload copy delivered via Google Drive. Revisions included per plan.' },
    ],
    plansTitle: 'Pricing', plansNote: 'Monthly unless stated. Pay by Wise, PayPal, or Payoneer (USD invoice); 50% upfront for new clients.',
    popular: 'Most popular',
    plans: [
      { name: 'Free trial', price: '$0', items: ['3 clips from 1 episode', 'Hook, captions & thumbnail', 'No commitment'] },
      { name: 'Per clip', price: '$20', unit: '/ clip', items: ['Minimum 5 clips', 'Hook, captions, music, thumbnail', 'Title, description & hashtags', '1 revision'] },
      { name: 'Starter', price: '$249', unit: '/ month', items: ['15 clips per month', 'All editing features', '1 revision per clip'] },
      { name: 'Growth', price: '$449', unit: '/ month', featured: true, items: ['30 clips per month', 'Translated subtitles (EN/ID)', '2 revisions per clip', 'Priority turnaround'] },
      { name: 'Pro', price: '$799', unit: '/ month', items: ['60 clips per month', 'Your own brand edit style', '2 revisions per clip', 'Monthly performance report'] },
    ],
    portfolioTitle: 'Sample work', portfolioEmpty: "Sample clips are on their way. In the meantime, see our results on our YouTube channel.",
    portfolioAll: 'See all results on YouTube', views: 'views',
    faqTitle: 'FAQ',
    faq: [
      { q: 'How fast is delivery?', a: 'Usually 1–3 business days per episode, depending on the number of clips. Growth & Pro get priority.' },
      { q: 'Is the music safe from copyright claims?', a: "We use royalty-free music or licensed tracks you provide. Copyrighted viral songs can get videos muted, so we don't use them without permission." },
      { q: 'Should I send the original file?', a: "Recommended. Original files look sharper and process faster. A YouTube link works too for videos you own." },
      { q: 'Do you clip more than podcasts?', a: 'Yes: solo educational videos, talks and stage events, streamers, and gaming streams (gameplay on top, facecam below).' },
    ],
    contactTitle: 'Tell us about your channel', contactBody: "Send your video link and niche. We'll reply with 3 free sample clips.",
    contactWa: 'Chat on WhatsApp', contactEmail: 'Email us', contactFallback: 'Try it yourself free',
    waMessage: "Hi, I'm interested in SlimerClip's clipping service. My channel: ", emailSubject: 'SlimerClip clipping service',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  const t = COPY[await getLocale()]
  return { title: t.metaTitle, description: t.metaDesc }
}

export default async function ServicePage() {
  const locale = await getLocale()
  const t = COPY[locale]
  // Indonesia → WhatsApp dulu; luar negeri → email dulu
  const wa = CONTACT.whatsapp && `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(t.waMessage)}`
  const mail = CONTACT.email && `mailto:${CONTACT.email}?subject=${encodeURIComponent(t.emailSubject)}`
  const contacts = [
    wa && { href: wa, label: t.contactWa, icon: MessageCircle },
    mail && { href: mail, label: t.contactEmail, icon: Mail },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Mail }[]
  if (locale === 'en') contacts.reverse()
  const primary = contacts[0]

  return (
    <div className="pb-8">
      <section className="pt-14 md:pt-20 pb-16">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-signal">{t.kicker}</p>
        <h1 className="mt-4 type-display text-ink text-[clamp(2.3rem,5vw,4rem)] max-w-[18ch]">{t.title}</h1>
        <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink-muted">{t.lead}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {primary
            ? <a href={primary.href} target="_blank" rel="noopener noreferrer" className="btn btn-primary h-12 px-6"><primary.icon className="size-4" aria-hidden /> {t.ctaPrimary}</a>
            : <Link href="/daftar" className="btn btn-primary h-12 px-6">{t.contactFallback}</Link>}
          <a href="#paket" className="btn btn-quiet h-12 px-6">{t.ctaSecondary}</a>
        </div>
      </section>

      <section aria-labelledby="why-title" className="py-16 border-t border-rule">
        <h2 id="why-title" className="type-display text-ink text-[clamp(1.8rem,3.4vw,2.6rem)]">{t.whyTitle}</h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2">
          {t.why.map(item => (
            <li key={item.title} className="rounded-lg border border-rule glass p-5">
              <h3 className="type-heading text-lg text-ink">{item.title}</h3>
              <p className="mt-2 text-ink-muted leading-relaxed">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="steps-title" className="py-16 border-t border-rule">
        <h2 id="steps-title" className="type-display text-ink text-[clamp(1.8rem,3.4vw,2.6rem)]">{t.stepsTitle}</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {t.steps.map((step, i) => (
            <li key={step.title}>
              <p className="timecode text-signal text-sm">0{i + 1}</p>
              <h3 className="mt-2 type-heading text-xl text-ink">{step.title}</h3>
              <p className="mt-2 text-ink-muted leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="portfolio-title" className="py-16 border-t border-rule">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="portfolio-title" className="type-display text-ink text-[clamp(1.8rem,3.4vw,2.6rem)]">{t.portfolioTitle}</h2>
          <a href={PORTFOLIO_CHANNEL} target="_blank" rel="noopener noreferrer" className="text-ink-muted underline underline-offset-4 decoration-rule hover:text-ink">{t.portfolioAll}</a>
        </div>
        {PORTFOLIO.length ? (
          <ul className="mt-10 grid gap-5 grid-cols-2 md:grid-cols-4">
            {PORTFOLIO.map(item => (
              <li key={item.youtubeId}>
                <div className="aspect-[9/16] overflow-hidden rounded-lg border border-rule bg-black">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.youtubeId)}`}
                    title={item.title}
                    loading="lazy"
                    allow="encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="size-full"
                  />
                </div>
                <p className="mt-2 text-sm text-ink line-clamp-2">{item.title}</p>
                {item.views && <p className="text-xs text-ink-muted">{item.views} {t.views}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 max-w-[60ch] text-ink-muted">{t.portfolioEmpty}</p>
        )}
      </section>

      <section id="paket" aria-labelledby="plans-title" className="py-16 border-t border-rule scroll-mt-20">
        <h2 id="plans-title" className="type-display text-ink text-[clamp(1.8rem,3.4vw,2.6rem)]">{t.plansTitle}</h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {t.plans.map(plan => (
            <li key={plan.name} className={`relative flex flex-col rounded-lg border p-5 ${plan.featured ? 'border-signal bg-signal/5' : 'border-rule glass'}`}>
              {plan.featured && <span className="absolute -top-3 left-5 rounded-full bg-signal px-3 py-1 text-xs font-semibold text-[#1a1440]">{t.popular}</span>}
              <h3 className="font-semibold text-ink">{plan.name}</h3>
              <p className="mt-3 text-ink">
                <span className="type-display text-3xl">{plan.price}</span>
                {plan.unit && <span className="ml-1 text-sm text-ink-muted">{plan.unit}</span>}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-ink-muted">
                {plan.items.map(item => (
                  <li key={item} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink-faint">{t.plansNote}</p>
      </section>

      <section aria-labelledby="faq-title" className="py-16 border-t border-rule">
        <h2 id="faq-title" className="type-display text-ink text-[clamp(1.8rem,3.4vw,2.6rem)]">{t.faqTitle}</h2>
        <dl className="mt-8 divide-y divide-rule border-y border-rule">
          {t.faq.map(item => (
            <div key={item.q} className="py-5">
              <dt className="font-semibold text-ink">{item.q}</dt>
              <dd className="mt-2 max-w-[70ch] text-ink-muted leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="contact-title" className="py-20 text-center">
        <h2 id="contact-title" className="type-display text-ink text-[clamp(2rem,4.5vw,3.4rem)] max-w-[18ch] mx-auto">{t.contactTitle}</h2>
        <p className="mt-4 text-lg text-ink-muted">{t.contactBody}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {contacts.map(c => (
            <a key={c.href} href={c.href} target="_blank" rel="noopener noreferrer" className={`btn h-12 px-6 ${c === primary ? 'btn-primary' : 'btn-quiet'}`}>
              <c.icon className="size-4" aria-hidden /> {c.label}
            </a>
          ))}
          {!contacts.length && <Link href="/daftar" className="btn btn-primary h-12 px-6">{t.contactFallback}</Link>}
        </div>
      </section>
    </div>
  )
}
