import type { Metadata } from 'next'
import Band from '@/components/marketing/Band'
import ClipFrame from '@/components/marketing/ClipFrame'
import ClipGallery from '@/components/marketing/ClipGallery'
import ContactBand from '@/components/marketing/ContactBand'
import ContactButtons, { ContactNote } from '@/components/marketing/ContactButtons'
import Faq from '@/components/marketing/Faq'
import PlanGrid from '@/components/marketing/PlanGrid'
import ReplayScrubber from '@/components/marketing/ReplayScrubber'
import Reveal from '@/components/marketing/Reveal'
import Steps from '@/components/marketing/Steps'
import WaveDivider from '@/components/marketing/WaveDivider'
import { CLIPPING_PLANS } from '@/content/pricing'
import { getLocale } from '@/lib/locale-server'
import type { Locale } from '@/lib/i18n'
import { clipVideos } from '@/lib/portfolio'

const COPY: Record<Locale, {
  metaTitle: string; metaDesc: string
  kicker: string; title: string; lead: string; cta: string; ctaWork: string; ctaPlans: string; visualNote: string
  workTitle: string; workLead: string; workCta: string
  whyTitle: string; why: { title: string; body: string }[]; scrub: { label: string; normal: string; peak: string; note: string }
  stepsTitle: string; steps: { title: string; body: string }[]
  plansTitle: string; plansLead: string; plansNote: string; customTitle: string; customCta: string; customMessage: string; pick: string; choose: (name: string) => string; planMessage: (name: string) => string
  faqTitle: string; faq: { q: string; a: string }[]
  contactTitle: string; contactBody: string; message: string; subject: string
}> = {
  id: {
    metaTitle: 'Jasa clipping podcast: klip 9:16 siap unggah | SlimerClip',
    metaDesc: 'Jasa clipping podcast jadi Shorts, TikTok, dan Reels. Dipilih dari data tonton ulang YouTube, lengkap hook, caption, musik, dan thumbnail.',
    kicker: 'Jasa clipping podcast', title: 'Satu episode podcast, banyak klip siap unggah.',
    lead: 'Kirim link atau file videonya. Kami pilih momen terkuat dari data tonton ulang YouTube, lalu menyuntingnya lengkap dengan hook, caption, musik, efek suara, thumbnail, dan judul.',
    cta: 'Konsultasi gratis', ctaWork: 'Lihat contoh klip', ctaPlans: 'Lihat paket', visualNote: 'Ilustrasi tata letak, bukan karya klien.',
    workTitle: 'Contoh klip', workLead: 'Klik video untuk menonton dengan suara.', workCta: 'Pilih paket clipping',
    whyTitle: 'Bukan sekadar dipotong',
    scrub: { label: 'Geser untuk menjelajahi episode', normal: 'Bagian biasa. Geser terus untuk mencari puncaknya.', peak: 'Paling sering diputar ulang. Bagian ini yang kami potong.', note: 'Geser sendiri. Grafik ini hanya ilustrasi.' },
    why: [
      { title: 'Momen dipilih dari data penonton', body: 'Bagian yang paling sering diputar ulang di YouTube jadi prioritas, lalu dicek manusia.' },
      { title: 'Kamera mengikuti yang bicara', body: 'Wajah dilacak per detik. Saat dua orang bergantian bicara, layar dibagi otomatis.' },
      { title: 'Indonesia & Inggris', body: 'Klip Inggris dengan subtitle Indonesia, atau sebaliknya, untuk menjangkau penonton baru.' },
      { title: 'Siap unggah', body: 'Hook pembuka, caption, musik, efek suara, thumbnail, plus 3 pilihan judul, deskripsi, dan hashtag.' },
    ],
    stepsTitle: 'Cara kerjanya',
    steps: [
      { title: 'Kirim videonya', body: 'Link YouTube atau file asli, plus niche dan gaya yang kamu mau.' },
      { title: 'Kami pilih & sunting', body: 'Momen terkuat dipotong di jeda bicara, lalu diberi hook, caption, dan musik sesuai suasana.' },
      { title: 'Revisi lalu kirim', body: 'Klip, thumbnail, dan teks unggahan dikirim lewat Google Drive. Revisi sesuai paket.' },
    ],
    plansTitle: 'Pilih paket clipping', plansLead: 'Satuan untuk mencoba, paket bulanan untuk podcast yang rutin tayang.',
    plansNote: 'Pembayaran lewat transfer bank atau QRIS, DP 50% untuk klien baru.',
    customTitle: 'Butuh jumlah klip atau format lain?', customCta: 'Tanya paket custom', customMessage: 'Halo SlimerClip, saya butuh paket clipping custom. Kebutuhan saya: ',
    pick: 'Rekomendasi kami', choose: name => `Pilih ${name}`,
    planMessage: name => `Halo SlimerClip, saya tertarik paket clipping ${name}. Channel saya: `,
    faqTitle: 'Pertanyaan umum',
    faq: [
      { q: 'Kenapa tidak pakai alat AI saja?', a: 'Alat AI cepat, tetapi hasilnya tetap perlu kamu cek satu per satu. Di sini momennya dipilih dari data tonton ulang dan dicek manusia, jadi kamu tinggal mengunggah.' },
      { q: 'Berapa lama pengerjaannya?', a: 'Biasanya 1–3 hari kerja per episode, tergantung jumlah klip. Paket Growth dan Pro diprioritaskan.' },
      { q: 'Musiknya aman dari klaim hak cipta?', a: 'Kami pakai musik bebas royalti atau musik berlisensi milikmu. Lagu viral berhak cipta bisa membuat video di-mute, jadi tidak kami pakai tanpa izin.' },
      { q: 'Perlu kirim file asli?', a: 'Disarankan, karena gambarnya lebih tajam dan prosesnya lebih cepat. Link YouTube juga bisa untuk video milikmu.' },
    ],
    contactTitle: 'Ceritakan podcastmu', contactBody: 'Kirim link video dan niche channelmu. Kami bantu pilih paket yang pas.',
    message: 'Halo SlimerClip, saya tertarik jasa clipping. Channel saya: ', subject: 'Jasa clipping SlimerClip',
  },
  en: {
    metaTitle: 'Podcast clipping service: ready-to-post 9:16 clips | SlimerClip',
    metaDesc: 'Podcast clipping for Shorts, TikTok, and Reels. Picked from YouTube replay data, with hooks, captions, music, and thumbnails.',
    kicker: 'Podcast clipping service', title: 'One podcast episode, many ready-to-post clips.',
    lead: 'Send us a link or the video file. We pick the strongest moments from YouTube replay data, then edit them with hooks, captions, music, sound effects, thumbnails, and titles.',
    cta: 'Get a free consultation', ctaWork: 'See sample clips', ctaPlans: 'See pricing', visualNote: 'Layout illustration, not client work.',
    workTitle: 'Sample clips', workLead: 'Click a video to watch with sound.', workCta: 'Choose a clipping plan',
    whyTitle: 'More than cutting',
    scrub: { label: 'Slide to explore the episode', normal: 'An ordinary part. Keep sliding to find the peak.', peak: 'Most replayed. This is the part we cut.', note: 'Try the slider. This chart is an illustration.' },
    why: [
      { title: 'Moments picked from viewer data', body: 'The most replayed parts on YouTube come first, then a human reviews the picks.' },
      { title: 'The camera follows the speaker', body: 'Faces are tracked every second. When two people take turns, the screen splits automatically.' },
      { title: 'English & Indonesian', body: 'English clips with Indonesian subtitles, or the other way round, to reach new audiences.' },
      { title: 'Ready to post', body: 'Opening hook, captions, music, sound effects, thumbnail, plus 3 title options, a description, and hashtags.' },
    ],
    stepsTitle: 'How it works',
    steps: [
      { title: 'Send your video', body: 'A YouTube link or the original file, plus your niche and preferred style.' },
      { title: 'We pick & edit', body: 'The strongest moments are cut at speech pauses, with hooks, captions, and mood-matched music.' },
      { title: 'Review, then deliver', body: 'Clips, thumbnails, and upload copy delivered via Google Drive. Revisions included per plan.' },
    ],
    plansTitle: 'Choose a clipping plan', plansLead: 'Per clip to try it out, monthly plans for podcasts that publish regularly.',
    plansNote: 'Pay by Wise, PayPal, or Payoneer (USD invoice); 50% upfront for new clients.',
    customTitle: 'Need a different clip count or format?', customCta: 'Ask about a custom plan', customMessage: 'Hi SlimerClip, I need a custom clipping plan. What I need: ',
    pick: 'Our pick', choose: name => `Choose ${name}`,
    planMessage: name => `Hi SlimerClip, I'm interested in the ${name} clipping plan. My channel: `,
    faqTitle: 'FAQ',
    faq: [
      { q: 'Why not just use an AI tool?', a: 'AI tools are fast, but you still have to check every clip yourself. Here the moments are picked from replay data and reviewed by a human, so all you do is post.' },
      { q: 'How fast is delivery?', a: 'Usually 1–3 business days per episode, depending on the number of clips. Growth and Pro get priority.' },
      { q: 'Is the music safe from copyright claims?', a: "We use royalty-free music or licensed tracks you provide. Copyrighted viral songs can get videos muted, so we don't use them without permission." },
      { q: 'Should I send the original file?', a: 'Recommended, because it looks sharper and processes faster. A YouTube link works too for videos you own.' },
    ],
    contactTitle: 'Tell us about your podcast', contactBody: "Send your video link and niche. We'll help you pick the right plan.",
    message: "Hi, I'm interested in SlimerClip's clipping service. My channel: ", subject: 'SlimerClip clipping service',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  const t = COPY[await getLocale()]
  return { title: t.metaTitle, description: t.metaDesc }
}

export default async function ClippingPage() {
  const locale = await getLocale()
  const t = COPY[locale]
  const clips = clipVideos()

  return (
    <>
      <Band tone="indigo" className="band-hero">
        <span className="gel gel-a" aria-hidden />
        <div className="relative grid items-center gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div>
            <p className="rise text-sm font-semibold uppercase tracking-[0.18em] text-label-iris">{t.kicker}</p>
            <h1 className="rise text-glow mt-5 type-display text-ink text-[clamp(2.7rem,6vw,5.2rem)]" style={{ animationDelay: '80ms' }}>{t.title}</h1>
            <p className="rise mt-7 max-w-[56ch] text-lg leading-relaxed text-ink-muted" style={{ animationDelay: '180ms' }}>{t.lead}</p>
            <div className="rise mt-9" style={{ animationDelay: '280ms' }}>
              <div className="flex flex-wrap gap-3">
                <ContactButtons locale={locale} message={t.message} subject={t.subject} primaryLabel={t.cta} primaryOnly />
                <a href={clips.length ? '#karya' : '#paket'} className="btn btn-quiet cta-quiet h-12 px-6">{clips.length ? t.ctaWork : t.ctaPlans}</a>
              </div>
              <ContactNote locale={locale} className="mt-3" />
            </div>
          </div>
          <figure className="rise" style={{ animationDelay: '320ms' }}>
            <div className="clip-fan relative mx-auto h-[26rem] max-w-sm sm:h-[30rem]" aria-hidden>
              <div className="clip-fan-left absolute left-0 top-10 w-[42%]"><ClipFrame locale={locale} compact /></div>
              <div className="clip-fan-right absolute right-0 top-10 w-[42%]"><ClipFrame locale={locale} compact /></div>
              <div className="clip-fan-front absolute left-1/2 top-0 w-[54%] -translate-x-1/2"><ClipFrame locale={locale} /></div>
            </div>
            <figcaption className="mt-3 text-center text-xs text-ink-muted">{t.visualNote}</figcaption>
          </figure>
        </div>
      </Band>

      {clips.length > 0 && (
        <Band tone="noir" id="karya" labelledBy="work-title">
          <Reveal>
            <h2 id="work-title" className="type-display text-ink text-[clamp(2.2rem,5vw,4rem)]">{t.workTitle}</h2>
            <p className="mt-3 max-w-[56ch] text-ink-muted">{t.workLead}</p>
          </Reveal>
          <div className="mt-12"><ClipGallery locale={locale} clips={clips} /></div>
          <a href="#paket" className="btn btn-primary cta-lux mt-10 h-12 px-6">{t.workCta}</a>
        </Band>
      )}

      <Band tone="violet" labelledBy="why-title">
        <Reveal><h2 id="why-title" className="type-display text-ink text-[clamp(2.2rem,5vw,4rem)]">{t.whyTitle}</h2></Reveal>
        <ul className="mt-12 grid gap-5 lg:grid-cols-3">
          {t.why.map((item, i) => (
            <li key={item.title} className={i === 0 || i === 3 ? 'lg:col-span-2' : ''}>
              <Reveal delay={i * 70} className="h-full">
                <div className="bento-card h-full rounded-2xl border border-rule p-7">
                  <h3 className="type-heading text-2xl text-ink">{item.title}</h3>
                  <p className="mt-3 max-w-[56ch] leading-relaxed text-ink-muted">{item.body}</p>
                  {i === 0 && <ReplayScrubber {...t.scrub} />}
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </Band>

      <WaveDivider />

      <Steps title={t.stepsTitle} steps={t.steps} />

      <Band tone="plum" id="paket" labelledBy="plans-title">
        <Reveal>
          <h2 id="plans-title" className="type-display text-ink text-[clamp(2.2rem,5vw,4rem)]">{t.plansTitle}</h2>
          <p className="mt-3 max-w-[56ch] text-ink-muted">{t.plansLead}</p>
        </Reveal>
        <PlanGrid locale={locale} plans={CLIPPING_PLANS[locale]} pickLabel={t.pick} subject={t.subject} columns="sm:grid-cols-2 lg:grid-cols-4"
          ctaLabel={plan => t.choose(plan.name)} message={plan => t.planMessage(plan.name)} />
        <Reveal className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rule bg-white/[0.04] p-5">
          <p className="font-semibold text-ink">{t.customTitle}</p>
          <ContactButtons locale={locale} message={t.customMessage} subject={t.subject} primaryLabel={t.customCta} primaryOnly quiet />
        </Reveal>
        <p className="mt-4 text-sm text-ink-muted">{t.plansNote}</p>
      </Band>

      <Faq title={t.faqTitle} items={t.faq} />

      <ContactBand locale={locale} title={t.contactTitle} body={t.contactBody} message={t.message} subject={t.subject} />
    </>
  )
}
