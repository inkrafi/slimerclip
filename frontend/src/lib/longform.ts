import type { LongformScene, StockProvider, StockVisual } from '@/lib/types'

export const STOCK_NAMES: Record<StockProvider, { name: string; url: string }> = {
  pixabay: { name: 'Pixabay', url: 'https://pixabay.com' },
  pexels: { name: 'Pexels', url: 'https://www.pexels.com' },
}

export const sameVisual = (a?: StockVisual | null, b?: StockVisual | null) => !!a && !!b && a.provider === b.provider && a.id === b.id

// Sama dengan backend/longform.py
const WORDS_PER_MINUTE = 115

/** Halaman editor video panjang: proyek topik di /longform/<id>, proyek podcast di /video/<id>/longform */
export const studioHref = (key: string) => (key.startsWith('topic_') ? `/longform/${key}` : `/video/${key}/longform`)

/** Perkiraan durasi narasi sebelum suaranya dibuat */
export function narrationSeconds(text: string): number {
  return (text.split(/\s+/).filter(Boolean).length / WORDS_PER_MINUTE) * 60
}

export function sceneSeconds(scene: LongformScene): number {
  if (scene.kind === 'quote') return (scene.end ?? 0) - (scene.start ?? 0)
  return scene.audio?.duration ?? narrationSeconds(scene.text)
}

/** ID adegan baru (cocok dengan SCENE_ID_RE di backend) */
export function newSceneId(): string {
  return 's' + Math.random().toString(36).slice(2, 10).padEnd(8, '0')
}

/** Jumlah bab seperti di deskripsi: bab pertama selalu mulai di 0:00 ("Pembuka" bila adegan pertama tanpa bab) */
export function chapterCount(scenes: LongformScene[]): number {
  let count = 0
  let last = ''
  for (const s of scenes) {
    if (s.chapter.trim() && s.chapter.trim() !== last) {
      count++
      last = s.chapter.trim()
    }
  }
  return count + (scenes[0]?.chapter.trim() ? 0 : 1)
}
