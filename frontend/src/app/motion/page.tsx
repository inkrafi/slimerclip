import type { Metadata } from 'next'
import Band from '@/components/marketing/Band'
import ContactBand from '@/components/marketing/ContactBand'
import ContactButtons, { ContactNote } from '@/components/marketing/ContactButtons'
import Faq from '@/components/marketing/Faq'
import MotionGallery from '@/components/marketing/MotionGallery'
import PlanGrid from '@/components/marketing/PlanGrid'
import Reveal from '@/components/marketing/Reveal'
import Steps from '@/components/marketing/Steps'
import WaveDivider from '@/components/marketing/WaveDivider'
import StoryboardFrame from '@/components/marketing/StoryboardFrame'
import { MOTION_PLANS } from '@/content/pricing'
import { getLocale } from '@/lib/locale-server'
import type { Locale } from '@/lib/i18n'
import { motionVideos } from '@/lib/portfolio'

const COPY: Record<Locale, {
  metaTitle: string; metaDesc: string
  kicker: string; title: string; lead: string; cta: string; ctaWork: string; ctaPlans: string; visualNote: string
  workTitle: string; workLead: string; workCta: string
  plansTitle: string; plansLead: string; plansNote: string; pick: string; choose: (name: string, custom: boolean) => string; planMessage: (name: string) => string
  stepsTitle: string; steps: { title: string; body: string }[]
  faqTitle: string; faq: { q: string; a: string }[]
  contactTitle: string; contactBody: string; message: string; subject: string
}> = {
  id: {
    metaTitle: 'Motion video peluncuran SaaS: teaser sampai launch kit | SlimerClip',
    metaDesc: 'Jasa motion video untuk peluncuran produk SaaS: teaser, launch video, dan launch kit dengan potongan pendek dan versi vertikal. Mulai dari konsultasi gratis.',
    kicker: 'Motion video peluncuran SaaS', title: 'Video motion untuk hari peluncuran produkmu.',
    lead: 'Dibuka dengan produkmu, bukan animasi logo. Dari teaser 15 detik sampai launch kit dengan potongan pendek dan versi vertikal.',
    cta: 'Konsultasi gratis', ctaWork: 'Lihat contoh video', ctaPlans: 'Lihat paket', visualNote: 'Ilustrasi alur video 60 detik, bukan karya klien.',
    workTitle: 'Contoh karya konsep', workLead: 'Video konsep untuk menunjukkan gaya kerja kami. Klik untuk menonton dengan suara.', workCta: 'Pilih paket motion',
    plansTitle: 'Pilih paket motion video',
    plansLead: 'Harga awal ini berlaku untuk lingkup standar. Harga pastinya kami tulis setelah konsultasi, sebelum pekerjaan dimulai.',
    plansNote: 'Pembayaran lewat transfer bank atau QRIS, DP 50% untuk klien baru.',
    pick: 'Rekomendasi kami', choose: (name, custom) => custom ? 'Mulai konsultasi' : `Pilih ${name}`,
    planMessage: name => `Halo SlimerClip, saya tertarik paket motion video ${name}. Produk saya: `,
    stepsTitle: 'Dari brief sampai video jadi',
    steps: [
      { title: 'Konsultasi gratis', body: 'Ceritakan produkmu, tanggal peluncuran, dan tempat video akan dipakai.' },
      { title: 'Naskah & storyboard', body: 'Alur dan isi video disepakati dulu supaya animasinya tidak salah arah.' },
      { title: 'Animasi', body: 'Storyboard yang sudah disepakati kami hidupkan jadi video.' },
      { title: 'Revisi lalu kirim', body: 'Kamu periksa hasilnya, lalu file akhir dikirim lewat Google Drive.' },
    ],
    faqTitle: 'Pertanyaan umum',
    faq: [
      { q: 'Kenapa harganya "mulai dari"?', a: 'Harga akhir bergantung pada naskah, jumlah tampilan produk yang dianimasikan, dan tenggat. Semua itu kita bahas saat konsultasi.' },
      { q: 'Tetap jelas kalau ditonton tanpa suara?', a: 'Ya, video kami rancang tetap bisa dipahami tanpa suara, karena banyak orang menonton di HP dengan suara mati.' },
      { q: 'Berapa lama pengerjaannya?', a: 'Jadwal kami sesuaikan dengan tanggal peluncuranmu dan disepakati saat konsultasi.' },
      { q: 'Berapa kali revisi?', a: 'Jumlah revisi ditulis di penawaran, sebelum pekerjaan dimulai.' },
      { q: 'Apa yang perlu saya siapkan?', a: 'Logo, warna brand, dan akses atau rekaman layar produk kalau ada. Sisanya kita bahas saat konsultasi.' },
    ],
    contactTitle: 'Ceritakan produk yang akan kamu luncurkan',
    contactBody: 'Kasih tahu produknya dan kapan peluncurannya. Kami bantu pilih paket yang pas.',
    message: 'Halo SlimerClip, saya ingin konsultasi motion video. Produk saya: ', subject: 'Motion video SlimerClip',
  },
  en: {
    metaTitle: 'SaaS launch motion video: teaser to launch kit | SlimerClip',
    metaDesc: 'Motion video for SaaS launches: teasers, launch videos, and a launch kit with short cutdowns and a vertical version. Start with a free consultation.',
    kicker: 'SaaS launch motion video', title: 'Motion video for your product launch day.',
    lead: 'It opens with your product, not a logo animation. From a 15 second teaser to a launch kit with short cutdowns and a vertical version.',
    cta: 'Get a free consultation', ctaWork: 'See sample videos', ctaPlans: 'See pricing', visualNote: 'Illustrated 60 second video outline, not client work.',
    workTitle: 'Concept work', workLead: 'Concept videos that show how we work. Click to watch with sound.', workCta: 'Choose a motion package',
    plansTitle: 'Choose a motion video package',
    plansLead: 'These starting prices cover a standard scope. We put the exact price in writing after the consultation, before work begins.',
    plansNote: 'Pay by Wise, PayPal, or Payoneer (USD invoice); 50% upfront for new clients.',
    pick: 'Our pick', choose: (name, custom) => custom ? 'Start a consultation' : `Choose ${name}`,
    planMessage: name => `Hi SlimerClip, I'm interested in the ${name} motion video package. My product: `,
    stepsTitle: 'From brief to finished video',
    steps: [
      { title: 'Free consultation', body: 'Tell us about your product, your launch date, and where the video will run.' },
      { title: 'Script & storyboard', body: 'We agree on the flow and content first, so the animation goes in the right direction.' },
      { title: 'Animation', body: 'We bring the agreed storyboard to life as video.' },
      { title: 'Review, then deliver', body: 'You review the result, then the final files arrive via Google Drive.' },
    ],
    faqTitle: 'FAQ',
    faq: [
      { q: 'Why "from" pricing?', a: 'The final price depends on the script, how many product views need animating, and the deadline. We cover all of that in the consultation.' },
      { q: 'Does it work with the sound off?', a: 'Yes, we design the video to make sense without sound, because many people watch on their phone with the sound off.' },
      { q: 'How long does it take?', a: 'We plan the schedule around your launch date and agree on it during the consultation.' },
      { q: 'How many revisions do I get?', a: 'The number of revisions is written in the quote, before work begins.' },
      { q: 'What do I need to prepare?', a: "Your logo, brand colors, and product access or screen recordings if you have them. We'll cover the rest in the consultation." },
    ],
    contactTitle: 'Tell us what you are launching',
    contactBody: "Share the product and the launch date. We'll help you pick the right package.",
    message: "Hi SlimerClip, I'd like a motion video consultation. My product: ", subject: 'SlimerClip motion video',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  const t = COPY[await getLocale()]
  return { title: t.metaTitle, description: t.metaDesc }
}

export default async function MotionPage() {
  const locale = await getLocale()
  const t = COPY[locale]
  const plans = MOTION_PLANS[locale]
  const customPlan = plans[plans.length - 1]
  const videos = motionVideos()

  return (
    <>
      <Band tone="teal" className="band-hero text-center">
        <span className="gel gel-b" aria-hidden />
        <p className="rise relative text-sm font-semibold uppercase tracking-[0.18em] text-label-iris">{t.kicker}</p>
        <h1 className="rise text-glow relative mx-auto mt-5 max-w-[17ch] type-display text-ink text-[clamp(2.7rem,6.6vw,5.6rem)]" style={{ animationDelay: '80ms' }}>{t.title}</h1>
        <p className="rise relative mx-auto mt-7 max-w-[56ch] text-lg leading-relaxed text-ink-muted" style={{ animationDelay: '180ms' }}>{t.lead}</p>
        <div className="rise relative mt-9" style={{ animationDelay: '280ms' }}>
          <div className="flex flex-wrap justify-center gap-3">
            <ContactButtons locale={locale} message={t.message} subject={t.subject} primaryLabel={t.cta} primaryOnly />
            <a href={videos.length ? '#karya' : '#paket'} className="btn btn-quiet cta-quiet h-12 px-6">{videos.length ? t.ctaWork : t.ctaPlans}</a>
          </div>
          <ContactNote locale={locale} className="mt-3" />
        </div>
        <figure className="rise relative mx-auto mt-14 max-w-4xl" style={{ animationDelay: '360ms' }}>
          <div className="scale-on-scroll text-left" aria-hidden><StoryboardFrame locale={locale} /></div>
          <figcaption className="mt-3 text-xs text-ink-muted">{t.visualNote}</figcaption>
        </figure>
      </Band>

      {videos.length > 0 && (
        <Band tone="noir" id="karya" labelledBy="work-title">
          <Reveal>
            <h2 id="work-title" className="type-display text-ink text-[clamp(2.2rem,5vw,4rem)]">{t.workTitle}</h2>
            <p className="mt-3 max-w-[56ch] text-ink-muted">{t.workLead}</p>
          </Reveal>
          <div className="mt-12"><MotionGallery locale={locale} videos={videos} /></div>
          <a href="#paket" className="btn btn-primary cta-lux mt-10 h-12 px-6">{t.workCta}</a>
        </Band>
      )}

      <Band tone="plum" id="paket" labelledBy="plans-title">
        <Reveal>
          <h2 id="plans-title" className="type-display text-ink text-[clamp(2.2rem,5vw,4rem)]">{t.plansTitle}</h2>
          <p className="mt-3 max-w-[60ch] leading-relaxed text-ink-muted">{t.plansLead}</p>
        </Reveal>
        <PlanGrid locale={locale} plans={plans} pickLabel={t.pick} subject={t.subject} columns="sm:grid-cols-2 lg:grid-cols-4"
          ctaLabel={plan => t.choose(plan.name, plan === customPlan)} message={plan => t.planMessage(plan.name)} />
        <p className="mt-6 text-sm text-ink-muted">{t.plansNote}</p>
      </Band>

      <WaveDivider />

      <Steps title={t.stepsTitle} steps={t.steps} columns="sm:grid-cols-2 lg:grid-cols-4" />

      <Faq title={t.faqTitle} items={t.faq} />

      <ContactBand locale={locale} title={t.contactTitle} body={t.contactBody} message={t.message} subject={t.subject} />
    </>
  )
}
