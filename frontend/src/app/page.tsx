import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import Band from '@/components/marketing/Band'
import ClipFrame from '@/components/marketing/ClipFrame'
import ClipGallery from '@/components/marketing/ClipGallery'
import ContactBand from '@/components/marketing/ContactBand'
import ContactButtons, { ContactNote } from '@/components/marketing/ContactButtons'
import MotionGallery from '@/components/marketing/MotionGallery'
import Reveal from '@/components/marketing/Reveal'
import ScrubHero from '@/components/marketing/ScrubHero'
import Steps from '@/components/marketing/Steps'
import StoryboardFrame from '@/components/marketing/StoryboardFrame'
import Ticker from '@/components/marketing/Ticker'
import WaveDivider from '@/components/marketing/WaveDivider'
import { STARTING_PRICES } from '@/content/pricing'
import { getLocale } from '@/lib/locale-server'
import type { Locale } from '@/lib/i18n'
import { clipVideos, motionVideos } from '@/lib/portfolio'

const COPY: Record<Locale, {
  kicker: string; title: string; lead: string; cta: string; ctaWork: string; ctaServices: string; visualNote: string
  hint: string; story: [string, string, string, string]
  ticker: string[]
  servicesTitle: string
  clipping: { kicker: string; title: string; body: string; items: string[]; link: string }
  motion: { kicker: string; title: string; body: string; items: string[]; link: string }
  workTitle: string; workLead: string; workCta: string; workAllClips: string; workAllMotion: string
  stepsTitle: string; steps: { title: string; body: string }[]
  contactTitle: string; contactBody: string; message: string; subject: string
}> = {
  id: {
    kicker: 'Jasa clipping podcast & motion video SaaS',
    title: 'Podcast jadi klip. Produk SaaS jadi video peluncuran.',
    lead: 'Kamu fokus ke episode dan produkmu. Kami potong podcast jadi klip 9:16 siap unggah, dan buat motion video untuk peluncuran SaaS.',
    cta: 'Konsultasi gratis', ctaWork: 'Lihat contoh karya', ctaServices: 'Lihat layanan', visualNote: 'Ilustrasi format, bukan karya klien.',
    hint: 'Gulir untuk melihat prosesnya',
    story: [
      'Episodemu dua jam. Siapa yang sempat mencari momen terbaiknya?',
      'Kami yang mencari, dari bagian yang paling sering diputar ulang penonton.',
      'Lalu kami potong jadi klip 9:16, lengkap dengan hook dan caption.',
      'Mau meluncurkan produk SaaS? Kami buat video peluncurannya juga.',
    ],
    ticker: ['Klip 9:16', 'Hook pembuka', 'Caption', 'Thumbnail', 'Naskah', 'Storyboard', 'Launch video', 'Versi vertikal'],
    servicesTitle: 'Dua layanan, dikerjakan penuh untukmu',
    clipping: {
      kicker: 'Untuk podcaster', title: 'Jasa clipping podcast',
      body: 'Tidak perlu menonton ulang episode untuk mencari momennya. Kirim link atau file, kami pilih dari data tonton ulang YouTube, lalu dicek manusia.',
      items: ['Klip 9:16 yang mengikuti pembicara', 'Hook, caption, musik, dan thumbnail', 'Judul, deskripsi, dan hashtag siap unggah'],
      link: 'Lihat jasa clipping',
    },
    motion: {
      kicker: 'Untuk founder SaaS', title: 'Motion video peluncuran',
      body: 'Video pendek yang dibuka dengan produkmu, bukan animasi logo. Tersedia dari teaser sampai launch kit.',
      items: ['Teaser 15–30 detik atau video 45–60 detik', 'Naskah dan storyboard disepakati sebelum animasi', 'Potongan pendek dan versi vertikal di Launch kit'],
      link: 'Lihat motion video',
    },
    workTitle: 'Contoh karya', workLead: 'Klik video untuk menonton dengan suara.',
    workCta: 'Mau hasil seperti ini?', workAllClips: 'Lihat semua klip', workAllMotion: 'Lihat semua motion',
    stepsTitle: 'Tiga langkah, tanpa ribet',
    steps: [
      { title: 'Ceritakan kebutuhanmu', body: 'Konsultasi gratis lewat chat atau panggilan, untuk menentukan paket yang pas.' },
      { title: 'Kami kerjakan', body: 'Kamu kirim materinya, kami yang memotong, menyunting, atau menganimasikan.' },
      { title: 'Periksa, lalu terima', body: 'Hasil dan revisi dikirim lewat Google Drive dan chat, tanpa perlu membuat akun.' },
    ],
    contactTitle: 'Ceritakan yang sedang kamu kerjakan',
    contactBody: 'Podcast atau produk SaaS, ceritakan singkat saja. Kami bantu pilih paket yang pas.',
    message: 'Halo SlimerClip, saya ingin konsultasi. Yang sedang saya kerjakan: ', subject: 'Konsultasi SlimerClip',
  },
  en: {
    kicker: 'Podcast clipping & SaaS motion video',
    title: 'Podcasts into clips. SaaS products into launch videos.',
    lead: 'You focus on your episodes and your product. We cut podcasts into ready-to-post 9:16 clips, and make motion video for SaaS launches.',
    cta: 'Get a free consultation', ctaWork: 'See sample work', ctaServices: 'See services', visualNote: 'Format illustration, not client work.',
    hint: 'Scroll to see the process',
    story: [
      'Your episode runs two hours. Who has time to find the best moments?',
      'We find them, starting with the parts viewers replay the most.',
      'Then we cut them into 9:16 clips, with hooks and captions.',
      'Launching a SaaS product? We make the launch video too.',
    ],
    ticker: ['9:16 clips', 'Opening hooks', 'Captions', 'Thumbnails', 'Scripts', 'Storyboards', 'Launch videos', 'Vertical versions'],
    servicesTitle: 'Two services, done for you',
    clipping: {
      kicker: 'For podcasters', title: 'Podcast clipping',
      body: 'No more rewatching episodes to find the moments. Send a link or the file, we pick from YouTube replay data, then a human reviews it.',
      items: ['9:16 clips that follow the speaker', 'Hooks, captions, music, and thumbnails', 'Ready-to-post titles, descriptions, and hashtags'],
      link: 'See podcast clipping',
    },
    motion: {
      kicker: 'For SaaS founders', title: 'Launch motion video',
      body: 'Short videos that open with your product, not a logo animation. Available from a teaser to a full launch kit.',
      items: ['A 15–30 second teaser or a 45–60 second video', 'Script and storyboard agreed before animation', 'Short cutdowns and a vertical version in the Launch kit'],
      link: 'See motion video',
    },
    workTitle: 'Sample work', workLead: 'Click a video to watch with sound.',
    workCta: 'Want results like these?', workAllClips: 'See all clips', workAllMotion: 'See all motion',
    stepsTitle: 'Three simple steps',
    steps: [
      { title: 'Tell us what you need', body: 'A free consultation by email or call, to find the right package.' },
      { title: 'We do the work', body: 'You send the material; we cut, edit, or animate it.' },
      { title: 'Review, then receive', body: 'Files and revisions go through Google Drive and chat, with no account to create.' },
    ],
    contactTitle: 'Tell us what you are working on',
    contactBody: "A podcast or a SaaS product, a short note is enough. We'll help you pick the right package.",
    message: "Hi SlimerClip, I'd like a consultation. I'm working on: ", subject: 'SlimerClip consultation',
  },
}

export default async function Home() {
  const locale = await getLocale()
  const t = COPY[locale]
  const prices = STARTING_PRICES[locale]
  const clips = clipVideos().slice(0, 5)
  const motion = motionVideos().slice(0, 1)
  const hasWork = clips.length > 0 || motion.length > 0
  const services = [
    { ...t.clipping, n: '01', href: '/clipping', price: prices.clipping, tone: 'text-label-iris', panel: 'panel-pink' },
    { ...t.motion, n: '02', href: '/motion', price: prices.motion, tone: 'text-label-iris', panel: 'panel-teal' },
  ]

  return (
    <>
      <ScrubHero locale={locale} kicker={t.kicker} title={t.title} lead={t.lead} cta={t.cta} hint={t.hint} story={t.story}
        note={t.visualNote} message={t.message} subject={t.subject} />

      <Band tone="indigo" className="band-hero hero-static">
        <span className="gel gel-a" aria-hidden />
        <div className="relative grid items-center gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <p className="rise text-sm font-semibold uppercase tracking-[0.18em] text-label-iris">{t.kicker}</p>
            <h1 className="rise text-glow mt-5 type-display text-ink text-[clamp(2.7rem,6vw,5.2rem)]" style={{ animationDelay: '80ms' }}>{t.title}</h1>
            <p className="rise mt-7 max-w-[52ch] text-lg leading-relaxed text-ink-muted" style={{ animationDelay: '180ms' }}>{t.lead}</p>
            <div className="rise mt-9" style={{ animationDelay: '280ms' }}>
              <div className="flex flex-wrap gap-3">
                <ContactButtons locale={locale} message={t.message} subject={t.subject} primaryLabel={t.cta} primaryOnly />
                <a href={hasWork ? '#karya' : '#layanan'} className="btn btn-quiet cta-quiet h-12 px-6">{hasWork ? t.ctaWork : t.ctaServices}</a>
              </div>
              <ContactNote locale={locale} className="mt-3" />
            </div>
          </div>
          <figure className="rise" style={{ animationDelay: '320ms' }}>
            <div className="relative pb-14 pr-[20%] sm:pb-20" aria-hidden>
              <div className="hero-layer-a"><StoryboardFrame locale={locale} /></div>
              <div className="hero-layer-b absolute bottom-0 right-0 w-[26%] min-w-24 max-w-40">
                <ClipFrame locale={locale} compact />
              </div>
            </div>
            <figcaption className="mt-3 text-xs text-ink-muted">{t.visualNote}</figcaption>
          </figure>
        </div>
      </Band>

      <Ticker items={t.ticker} />

      <Band tone="noir" id="layanan" labelledBy="services-title">
        <Reveal><h2 id="services-title" className="type-display max-w-[20ch] text-ink text-[clamp(2.2rem,5vw,4rem)]">{t.servicesTitle}</h2></Reveal>
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {services.map((service, i) => (
            <Reveal key={service.href} delay={i * 120} className="flex">
              <article className={`service-panel ${service.panel} group relative flex w-full flex-col overflow-hidden rounded-2xl border border-rule p-7 sm:p-10`}>
                <span className="service-number type-display absolute right-6 top-3 text-[6rem] leading-none text-white/[0.07]" aria-hidden>{service.n}</span>
                <p className={`relative text-sm font-semibold ${service.tone}`}>{service.kicker}</p>
                <h3 className="relative mt-3 type-display text-3xl text-ink sm:text-4xl">{service.title}</h3>
                <p className="relative mt-4 max-w-[48ch] leading-relaxed text-ink-muted">{service.body}</p>
                <ul className="relative mb-8 mt-6 space-y-2.5 text-sm text-ink-muted">
                  {service.items.map(item => (
                    <li key={item} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-label-iris" aria-hidden />{item}</li>
                  ))}
                </ul>
                <div className="relative mt-auto border-t border-rule pt-6">
                  <p className="font-semibold text-ink">{service.price}</p>
                  <Link href={service.href} className="btn btn-quiet cta-quiet mt-4 h-12 px-6">
                    {service.link} <ArrowRight className="cta-arrow size-4" aria-hidden />
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Band>

      {hasWork && (
        <Band tone="violet" id="karya" labelledBy="work-title">
          <Reveal>
            <h2 id="work-title" className="type-display text-ink text-[clamp(2.2rem,5vw,4rem)]">{t.workTitle}</h2>
            <p className="mt-3 max-w-[56ch] text-ink-muted">{t.workLead}</p>
          </Reveal>
          {clips.length > 0 && (
            <div className="mt-12">
              <ClipGallery locale={locale} clips={clips} />
              <Link href="/clipping#karya" className="btn btn-quiet cta-quiet mt-8 h-12 px-6">{t.workAllClips} <ArrowRight className="cta-arrow size-4" aria-hidden /></Link>
            </div>
          )}
          {motion.length > 0 && (
            <div className="mt-16">
              <MotionGallery locale={locale} videos={motion} />
              <Link href="/motion#karya" className="btn btn-quiet cta-quiet mt-8 h-12 px-6">{t.workAllMotion} <ArrowRight className="cta-arrow size-4" aria-hidden /></Link>
            </div>
          )}
          <Reveal className="mt-16 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-rule bg-white/[0.04] p-6 sm:p-8">
            <p className="type-heading text-2xl text-ink">{t.workCta}</p>
            <ContactButtons locale={locale} message={t.message} subject={t.subject} primaryLabel={t.cta} primaryOnly />
          </Reveal>
        </Band>
      )}

      <WaveDivider />

      <Steps title={t.stepsTitle} steps={t.steps} />

      <ContactBand locale={locale} title={t.contactTitle} body={t.contactBody} message={t.message} subject={t.subject} />
    </>
  )
}
