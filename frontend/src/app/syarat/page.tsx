import type { Metadata } from 'next'
import LegalPage from '@/components/marketing/LegalPage'
import type { LegalSection } from '@/components/marketing/LegalPage'
import { getLocale } from '@/lib/locale-server'
import type { Locale } from '@/lib/i18n'

const COPY: Record<Locale, { meta: string; title: string; updated: string; intro: string; contact: string; sections: LegalSection[] }> = {
  id: {
    meta: 'Syarat layanan | SlimerClip',
    title: 'Syarat layanan',
    updated: 'Terakhir diperbarui: 3 November 2026',
    intro: 'Syarat ini berlaku saat kamu memesan jasa clipping atau motion video dari SlimerClip. Kalau penawaran tertulis untuk proyekmu berbeda, yang berlaku adalah penawaran itu.',
    contact: 'Pertanyaan soal syarat ini bisa dikirim ke',
    sections: [
      { title: 'Pesanan dan harga', body: [
        'Lingkup, harga akhir, dan jadwal ditetapkan dalam penawaran tertulis, lewat chat atau email. Pekerjaan dimulai setelah kamu menyetujui penawaran itu.',
      ] },
      { title: 'Pembayaran', body: [
        'Klien baru membayar DP 50% sebelum pekerjaan dimulai. Sisanya dibayar sesuai penawaran. File akhir bisa kami tahan sampai pembayaran lunas.',
      ] },
      { title: 'Revisi', body: [
        'Jumlah revisi mengikuti paket atau penawaran. Perubahan di luar lingkup yang disepakati bisa dikenai biaya tambahan, yang kami sampaikan lebih dulu.',
      ] },
      { title: 'Materi dan hak cipta', body: [
        'Kamu menjamin punya hak atau izin atas materi yang kamu kirim. Kamu bertanggung jawab atas klaim yang muncul dari materi tersebut.',
        'Setelah lunas, kamu boleh memakai hasil akhir untuk keperluanmu. Hak atas materi yang kamu kirim tetap milikmu.',
      ] },
      { title: 'Portofolio', body: [
        'Kami hanya menampilkan hasil pekerjaanmu sebagai portofolio kalau kamu mengizinkannya.',
      ] },
      { title: 'Hasil', body: [
        'Kami mengerjakan pesanan dengan sungguh-sungguh, tetapi tidak menjamin jumlah views, penjualan, atau hasil bisnis tertentu.',
      ] },
      { title: 'Pembatalan dan pengembalian dana', body: [
        'Kalau kamu membatalkan sebelum pekerjaan dimulai, DP dikembalikan penuh.',
        'Kalau kamu membatalkan setelah pekerjaan dimulai, DP tidak dikembalikan karena sudah dipakai untuk pekerjaan yang berjalan. Kamu tidak ditagih sisa pembayaran untuk bagian yang belum dikerjakan, dan hasil yang sudah dibayar tetap boleh kamu pakai.',
        'Kalau kami yang membatalkan atau tidak bisa menyelesaikan pekerjaan, uang untuk bagian yang belum kami kirim dikembalikan, termasuk DP.',
        'Paket bulanan bisa dihentikan untuk bulan berikutnya dengan memberi tahu kami sebelum bulan itu dimulai. Bulan yang sudah berjalan tidak dikembalikan.',
      ] },
    ],
  },
  en: {
    meta: 'Terms of service | SlimerClip',
    title: 'Terms of service',
    updated: 'Last updated: November 3, 2026',
    intro: 'These terms apply when you order clipping or motion video from SlimerClip. If the written quote for your project differs, the quote applies.',
    contact: 'Questions about these terms can be sent to',
    sections: [
      { title: 'Orders and pricing', body: [
        'Scope, final price, and schedule are set in a written quote, by chat or email. Work begins after you accept that quote.',
      ] },
      { title: 'Payment', body: [
        'New clients pay 50% upfront before work begins. The balance is paid as stated in the quote. We may hold final files until payment is complete.',
      ] },
      { title: 'Revisions', body: [
        'The number of revisions follows the plan or the quote. Changes outside the agreed scope may cost extra, and we will tell you first.',
      ] },
      { title: 'Materials and copyright', body: [
        'You confirm that you have the rights or permission for the material you send. You are responsible for claims arising from that material.',
        'Once paid in full, you may use the final work for your own purposes. Rights to the material you send stay with you.',
      ] },
      { title: 'Portfolio', body: [
        'We only show your project in our portfolio if you allow it.',
      ] },
      { title: 'Results', body: [
        'We do the work with care, but we do not guarantee a particular number of views, sales, or business results.',
      ] },
      { title: 'Cancellation and refunds', body: [
        'If you cancel before work begins, your deposit is refunded in full.',
        'If you cancel after work begins, the deposit is not refunded because it has gone toward the work in progress. You are not billed the balance for work not yet done, and you may keep using results you have paid for.',
        'If we cancel or cannot finish the work, we refund the money for anything we have not delivered, including the deposit.',
        'Monthly plans can be stopped for the next month by telling us before that month begins. A month already underway is not refunded.',
      ] },
    ],
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: COPY[await getLocale()].meta }
}

export default async function TermsPage() {
  const t = COPY[await getLocale()]
  return <LegalPage title={t.title} updated={t.updated} intro={t.intro} sections={t.sections} contactLabel={t.contact} />
}
