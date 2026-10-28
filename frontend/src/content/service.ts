/**
 * Isi halaman Jasa clipping (/jasa) yang diatur pemilik: kontak & portofolio.
 * Kontak diambil dari env agar tidak tertulis di kode:
 *   NEXT_PUBLIC_CONTACT_WHATSAPP = nomor WA format internasional tanpa +, mis. 6281234567890 (dipakai pengunjung Indonesia)
 *   NEXT_PUBLIC_CONTACT_EMAIL    = email untuk klien luar negeri (dan cadangan jika WA kosong)
 */
export const CONTACT = {
  whatsapp: (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || '').replace(/\D/g, ''),
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '',
}

/** Channel dengan hasil klip (tautan "lihat semua hasil"). */
export const PORTFOLIO_CHANNEL = 'https://www.youtube.com/@klikdigital_id/shorts'

/**
 * Contoh hasil klip yang ditampilkan. youtubeId = ID video Shorts (bagian akhir link youtube.com/shorts/<ID>).
 * Pakai klip dari channel sendiri, atau klip klien yang sudah memberi izin untuk ditampilkan.
 */
export const PORTFOLIO: { youtubeId: string; title: string; views?: string }[] = [
  // { youtubeId: 'abcdEFGhijk', title: 'Gaji naik tapi tetap bokek?', views: '52 rb' },
]
