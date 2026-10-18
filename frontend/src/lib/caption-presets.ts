/**
 * Gaya caption. Preset dirancang dari pola caption yang paling banyak dipakai aplikasi klip
 * (huruf tebal, 1–3 kata per baris, kata aktif disorot warna/kotak, efek pop) dan tetap bisa
 * diubah per opsi. Backend (caption_styles.py) memvalidasi setiap nilainya.
 */

export type CaptionFont = 'montserrat' | 'poppins' | 'poppins-semibold' | 'anton' | 'bebas' | 'bangers'
export type HighlightStyle = 'color' | 'box' | 'none'

export interface CaptionStyle {
  font: CaptionFont
  /** Ukuran dalam satuan video 1080×1920 */
  size: number
  uppercase: boolean
  color: string
  highlight_color: string
  outline_color: string
  outline_width: number
  shadow: number
  highlight_style: HighlightStyle
  words_per_line: number
  /** Posisi tengah teks, % dari tinggi video */
  position_y: number
  animation: 'pop' | 'none'
  /** Kotak gelap transparan di belakang seluruh baris */
  background: boolean
}

export const CAPTION_FONTS: { id: CaptionFont; label: string }[] = [
  { id: 'montserrat', label: 'Montserrat Black' },
  { id: 'poppins', label: 'Poppins ExtraBold' },
  { id: 'poppins-semibold', label: 'Poppins SemiBold' },
  { id: 'anton', label: 'Anton' },
  { id: 'bebas', label: 'Bebas Neue' },
  { id: 'bangers', label: 'Bangers' },
]

const base: CaptionStyle = {
  font: 'montserrat',
  size: 110,
  uppercase: true,
  color: '#FFFFFF',
  highlight_color: '#3CFF8F',
  outline_color: '#000000',
  outline_width: 6,
  shadow: 0,
  highlight_style: 'color',
  words_per_line: 3,
  position_y: 70,
  animation: 'pop',
  background: false,
}

export interface CaptionPreset {
  id: string
  name: string
  description: string
  style: CaptionStyle
}

export const CAPTION_PRESETS: CaptionPreset[] = [
  { id: 'sorot', name: 'Sorot', description: 'Kapital tebal, kata aktif berwarna', style: base },
  {
    id: 'kotak', name: 'Kotak', description: 'Kata aktif di dalam kotak warna',
    style: { ...base, font: 'poppins', size: 100, uppercase: false, highlight_color: '#FF5FA2', outline_width: 0, shadow: 3, highlight_style: 'box' },
  },
  {
    id: 'tegas', name: 'Tegas', description: 'Dua kata besar, ramping',
    style: { ...base, font: 'anton', size: 130, highlight_color: '#FF8A3D', outline_width: 5, words_per_line: 2 },
  },
  {
    id: 'satu', name: 'Satu kata', description: 'Satu kata sekali tampil, paling cepat',
    style: { ...base, font: 'bebas', size: 170, highlight_style: 'none', shadow: 3, words_per_line: 1, position_y: 68 },
  },
  {
    id: 'komik', name: 'Komik', description: 'Huruf miring ceria, garis tebal',
    style: { ...base, font: 'bangers', size: 120, highlight_color: '#3DD6C6', outline_width: 8, shadow: 4 },
  },
  {
    id: 'bersih', name: 'Bersih', description: 'Subtitle kalimat dengan latar gelap',
    style: { ...base, font: 'poppins-semibold', size: 64, uppercase: false, outline_width: 0, highlight_style: 'none', words_per_line: 6, position_y: 80, animation: 'none', background: true },
  },
]

export const DEFAULT_CAPTION_STYLE = CAPTION_PRESETS[0].style

/** Warna cepat untuk sorotan (tetap bisa pilih warna bebas). */
export const HIGHLIGHT_SWATCHES = ['#3CFF8F', '#FF5FA2', '#3DD6C6', '#FF8A3D', '#B794FF', '#FFFFFF']

export const sameStyle = (a: CaptionStyle, b: CaptionStyle) =>
  (Object.keys(a) as (keyof CaptionStyle)[]).every(k => a[k] === b[k])

/** Preset yang cocok persis dengan gaya ini, jika ada. */
export const presetOf = (style: CaptionStyle) => CAPTION_PRESETS.find(p => sameStyle(p.style, style))

const STORAGE_KEY = 'slimerclip:caption-style'

/** Gaya terakhir yang dipakai pengguna (per browser), digabung dengan bawaan agar opsi baru tetap terisi. */
export function loadCaptionStyle(): CaptionStyle {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && typeof saved === 'object') return { ...DEFAULT_CAPTION_STYLE, ...saved }
  } catch { /* penyimpanan browser tidak tersedia */ }
  return DEFAULT_CAPTION_STYLE
}

export function saveCaptionStyle(style: CaptionStyle) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(style))
  } catch { /* abaikan */ }
}
