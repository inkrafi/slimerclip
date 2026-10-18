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
