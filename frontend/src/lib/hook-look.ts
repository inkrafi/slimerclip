import type { HookAccent, HookAnim, HookSettings, HookStyle } from '@/lib/types'

// Cermin dari backend/clip_effects.py (bagian Hook): angka di sini harus sama dengan di sana.

export const HOOK_ACCENTS: Record<HookAccent, string> = {
  pink: '#FF4D8D', yellow: '#FFD23F', lime: '#B6F23A', cyan: '#38D9F5', white: '#FFFFFF',
}

export const HOOK_STYLE_OPTIONS: { id: HookStyle; label: string; classic?: boolean }[] = [
  { id: 'spotlight', label: 'Sorot' },
  { id: 'tape', label: 'Selotip' },
  { id: 'poster', label: 'Poster' },
  { id: 'light', label: 'Kotak putih', classic: true },
  { id: 'dark', label: 'Kotak gelap', classic: true },
  { id: 'outline', label: 'Garis tepi', classic: true },
]

export const HOOK_ANIM_OPTIONS: { id: HookAnim; label: string }[] = [
  { id: 'cut', label: 'Langsung' }, { id: 'pop', label: 'Pop' }, { id: 'slide', label: 'Turun' }, { id: 'type', label: 'Per kata' }, { id: 'fade', label: 'Pudar' },
]

export interface HookLook {
  fill: string
  line: string
  /** 0 = garis/kotak buram penuh, 255 = transparan (alpha ASS) */
  lineAlpha: number
  box: boolean
  bord: number
  shadow: number
  blur: number
  rotate: number
  upper: boolean
  spacing: number
  back: string
  emph: string | null
  emphLine: string | null
  emphUnderline: boolean
  labelBox: string
  labelText: string
}

export const hookBoxPadding = (hook: HookSettings) =>
  Math.max(12, Math.floor(hook.size * (hook.style === 'tape' ? 0.22 : 0.28)))

/** [ukuran teks, padding kotak] label kecil di atas hook */
export function hookLabelMetrics(hook: HookSettings): [number, number] {
  const size = Math.max(34, Math.round(hook.size * 0.52))
  return [size, Math.max(10, Math.round(size * 0.34))]
}

const channels = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const luminance = (hex: string) => {
  const [r, g, b] = channels(hex).map(v => v / 255)
  return 0.299 * r + 0.587 * g + 0.114 * b
}
const darken = (hex: string, factor: number) =>
  '#' + channels(hex).map(v => Math.floor(v * factor).toString(16).padStart(2, '0').toUpperCase()).join('')

// Python round() membulatkan .5 ke genap; untuk ukuran hook (bilangan bulat) hasilnya hampir selalu sama
const round = Math.round

export function hookLook(hook: HookSettings): HookLook {
  const accent = HOOK_ACCENTS[hook.accent]
  const { size, style } = hook
  const pad = hookBoxPadding(hook)
  const look: HookLook = {
    fill: '#FFFFFF', line: '#000000', lineAlpha: 0, box: false, bord: 0, shadow: 0, blur: 0, rotate: 0, upper: false,
    spacing: 0, back: 'rgb(0 0 0 / 0.5)', emph: accent, emphLine: null, emphUnderline: false, labelBox: accent, labelText: '#141414',
  }
  if (style === 'spotlight') {
    Object.assign(look, { lineAlpha: 0x28, bord: Math.max(8, round(size * 0.18)), blur: Math.max(6, round(size * 0.18)) })
  } else if (style === 'tape') {
    Object.assign(look, {
      fill: '#141414', line: accent, box: true, bord: pad, rotate: 2.5, emph: null, emphUnderline: true,
      labelBox: '#141414', labelText: '#FFFFFF',
    })
  } else if (style === 'poster') {
    Object.assign(look, {
      fill: accent, line: '#141414', bord: Math.max(5, round(size * 0.1)), shadow: Math.max(5, round(size * 0.09)),
      upper: true, spacing: Math.max(1, round(size * 0.03)), back: '#141414', emph: '#FFFFFF',
    })
  } else if (style === 'light') {
    Object.assign(look, { fill: '#141414', line: '#FFFFFF', box: true, bord: pad, emph: luminance(accent) > 0.55 ? darken(accent, 0.55) : accent })
  } else if (style === 'dark') {
    Object.assign(look, { lineAlpha: 0x1a, box: true, bord: pad })
  } else {
    Object.assign(look, { bord: Math.max(4, Math.floor(size / 14)), shadow: 3 })
  }
  return look
}

export interface HookWord { text: string; emph: boolean }

/** Baris → kata. *kata* = ditekankan. */
export function hookTokens(text: string, upper: boolean): HookWord[][] {
  return text.split('\n').map(line => {
    const words: HookWord[] = []
    let pos = 0
    for (const m of [...line.matchAll(/\*([^*\n]+)\*/g), null]) {
      const plain = line.slice(pos, m ? m.index : line.length).replaceAll('*', '')
      const chunks = plain.split(/\s+/).filter(Boolean)
      if (chunks.length && words.length && !/^\s/.test(plain)) {
        // Tanda baca yang menempel setelah *kata* ("*kalah*?") tetap satu kata
        words[words.length - 1] = { ...words[words.length - 1], text: words[words.length - 1].text + chunks.shift() }
      }
      words.push(...chunks.map(w => ({ text: w, emph: false })))
      if (m) {
        words.push(...m[1].split(/\s+/).filter(Boolean).map(w => ({ text: w, emph: true })))
        pos = m.index + m[0].length
      }
    }
    return words.map(w => ({ ...w, text: upper ? w.text.toUpperCase() : w.text }))
  }).filter(line => line.length)
}

export const hookTypeStep = (nWords: number) => Math.min(90, Math.floor(900 / Math.max(1, nWords)))

/** Jarak (piksel 1080×1920) dari tepi atas blok ke tepi atas kotak teks utama, saat ada label. */
export function hookLabelOffset(hook: HookSettings): number {
  const [size, pad] = hookLabelMetrics(hook)
  return 2 * pad + size + round(hook.size * 0.18)
}

export interface HookFrame { opacity: number; scale: number; dy: number }

/** Keadaan animasi masuk/keluar pada detik t (sama dengan tag \fad, \t, \move di hook_ass). */
export function hookFrame(anim: HookAnim, t: number, end: number): HookFrame {
  const ms = t * 1000
  // Memudar di akhir: "cut" 0,5 dtk (bersama bayangan bawah), lainnya 0,2 dtk
  const out = Math.max(0, Math.min(1, (end - t) / (anim === 'cut' ? 0.5 : 0.2)))
  const fadeIn = (len: number) => (len <= 0 ? 1 : Math.max(0, Math.min(1, ms / len)))
  if (anim === 'pop') {
    const scale = ms < 160 ? 0.7 + 0.38 * (ms / 160) : ms < 280 ? 1.08 - 0.08 * ((ms - 160) / 120) : 1
    return { opacity: fadeIn(80) * out, scale: Math.max(0.7, scale), dy: 0 }
  }
  if (anim === 'slide') return { opacity: fadeIn(120) * out, scale: 1, dy: -80 * (1 - Math.min(1, Math.max(0, ms / 260))) }
  if (anim === 'cut') return { opacity: out, scale: 1, dy: 0 }
  if (anim === 'type') return { opacity: out, scale: 1, dy: 0 }
  return { opacity: fadeIn(150) * out, scale: 1, dy: 0 }
}

/** Opasitas kata ke-i saat animasi "per kata". */
export function hookWordOpacity(index: number, step: number, t: number): number {
  return Math.max(0, Math.min(1, (t * 1000 - index * step) / 60))
}
