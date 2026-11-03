import type { Metadata } from 'next'
import LegalPage from '@/components/marketing/LegalPage'
import type { LegalSection } from '@/components/marketing/LegalPage'
import { getLocale } from '@/lib/locale-server'
import type { Locale } from '@/lib/i18n'

const COPY: Record<Locale, { meta: string; title: string; updated: string; intro: string; contact: string; sections: LegalSection[] }> = {
  id: {
    meta: 'Kebijakan privasi | SlimerClip',
    title: 'Kebijakan privasi',
    updated: 'Terakhir diperbarui: 3 November 2026',
    intro: 'Halaman ini menjelaskan data apa yang kami terima saat kamu mengunjungi situs ini atau memakai jasa kami, dan untuk apa data itu dipakai.',
    contact: 'Pertanyaan soal privasi bisa dikirim ke',
    sections: [
      { title: 'Data yang kami terima', body: [
        'Saat menghubungi kami, kami menerima nama, kontak, dan isi pesan yang kamu kirim.',
        'Saat memakai jasa kami, kami menerima materi yang kamu kirim, seperti video, tautan, logo, atau rekaman layar.',
        'Saat membuka situs ini, server kami memproses data teknis seperti alamat IP dan jenis browser. Negara dari alamat IP dipakai untuk menampilkan bahasa dan konten yang sesuai wilayahmu.',
      ] },
      { title: 'Cara kami memakainya', body: [
        'Kami memakai data itu untuk membalas pesan, menyusun penawaran, mengerjakan pesanan, mengirim hasil, dan mengurus pembayaran.',
        'Kami tidak menjual data pribadimu.',
      ] },
      { title: 'Layanan pihak ketiga', body: [
        'Pekerjaan kami memakai layanan pihak ketiga, misalnya penyedia hosting, Google Drive untuk pengiriman file, serta aplikasi pesan dan pembayaran yang kita sepakati. Layanan itu memproses data sesuai kebijakannya sendiri.',
      ] },
      { title: 'Penyimpanan', body: [
        'Kami menyimpan data selama dibutuhkan untuk pekerjaan dan keperluan administrasi. Kamu bisa meminta materimu dihapus setelah pekerjaan selesai.',
      ] },
      { title: 'Hakmu', body: [
        'Kamu bisa meminta untuk melihat, memperbaiki, atau menghapus data pribadimu dengan menghubungi kami.',
      ] },
    ],
  },
  en: {
    meta: 'Privacy policy | SlimerClip',
    title: 'Privacy policy',
    updated: 'Last updated: November 3, 2026',
    intro: 'This page explains what data we receive when you visit this site or use our services, and what we use it for.',
    contact: 'Privacy questions can be sent to',
    sections: [
      { title: 'Data we receive', body: [
        'When you contact us, we receive your name, contact details, and the content of your message.',
        'When you use our services, we receive the material you send, such as videos, links, logos, or screen recordings.',
        'When you open this site, our server processes technical data such as your IP address and browser type. The country from your IP address is used to show the language and content for your region.',
      ] },
      { title: 'How we use it', body: [
        'We use this data to reply to messages, prepare quotes, do the work, deliver files, and handle payment.',
        'We do not sell your personal data.',
      ] },
      { title: 'Third-party services', body: [
        'Our work relies on third-party services, such as our hosting provider, Google Drive for file delivery, and the messaging and payment apps we agree on. Those services process data under their own policies.',
      ] },
      { title: 'Retention', body: [
        'We keep data for as long as the work and our records require. You can ask us to delete your material once the work is finished.',
      ] },
      { title: 'Your rights', body: [
        'You can ask to see, correct, or delete your personal data by contacting us.',
      ] },
    ],
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: COPY[await getLocale()].meta }
}

export default async function PrivacyPage() {
  const t = COPY[await getLocale()]
  return <LegalPage title={t.title} updated={t.updated} intro={t.intro} sections={t.sections} contactLabel={t.contact} />
}
