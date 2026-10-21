import { Anton, Bangers, Bebas_Neue, Montserrat, Poppins } from 'next/font/google'
import type { CaptionFont } from '@/lib/caption-presets'

// Font yang sama dengan backend/fonts, agar pratinjau caption mirip hasil render
const montserrat = Montserrat({ subsets: ['latin'], weight: ['900'] })
const poppins = Poppins({ subsets: ['latin'], weight: ['600', '800'] })
const anton = Anton({ subsets: ['latin'], weight: ['400'] })
const bebas = Bebas_Neue({ subsets: ['latin'], weight: ['400'] })
const bangers = Bangers({ subsets: ['latin'], weight: ['400'] })

export const CAPTION_FONT_CSS: Record<CaptionFont, { fontFamily: string; fontWeight: number }> = {
  montserrat: { fontFamily: montserrat.style.fontFamily, fontWeight: 900 },
  poppins: { fontFamily: poppins.style.fontFamily, fontWeight: 800 },
  'poppins-semibold': { fontFamily: poppins.style.fontFamily, fontWeight: 600 },
  anton: { fontFamily: anton.style.fontFamily, fontWeight: 400 },
  bebas: { fontFamily: bebas.style.fontFamily, fontWeight: 400 },
  bangers: { fontFamily: bangers.style.fontFamily, fontWeight: 400 },
}

/**
 * libass mengartikan ukuran font sebagai tinggi baris (usWinAscent + usWinDescent di tabel OS/2),
 * sedangkan CSS memakai em. Kalikan ukuran ASS dengan faktor ini agar pratinjau sama besar dengan render.
 */
export const ASS_EM_SCALE: Record<CaptionFont, number> = {
  montserrat: 1 / 1.562,
  poppins: 1 / 1.762,
  'poppins-semibold': 1 / 1.762,
  anton: 1 / 1.733,
  bebas: 1 / 1.3,
  bangers: 1 / 1.757,
}
