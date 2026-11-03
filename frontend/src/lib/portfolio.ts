import fs from 'node:fs'
import path from 'node:path'
import { CLIP_SLOTS, MOTION_SLOTS } from '@/content/service'
import type { WorkSlot } from '@/content/service'

export type WorkVideo = WorkSlot & { src: string; poster?: string }

const ROOT = path.join(process.cwd(), 'public', 'portfolio')

/** Slot yang filenya sudah ada di public/portfolio. Slot kosong tidak tampil ke pengunjung. */
function available(folder: 'clips' | 'motion', slots: WorkSlot[]): WorkVideo[] {
  return slots.flatMap(slot => {
    if (!fs.existsSync(path.join(ROOT, folder, `${slot.file}.mp4`))) return []
    const hasPoster = fs.existsSync(path.join(ROOT, folder, `${slot.file}.jpg`))
    return [{
      ...slot,
      src: `/portfolio/${folder}/${slot.file}.mp4`,
      poster: hasPoster ? `/portfolio/${folder}/${slot.file}.jpg` : undefined,
    }]
  })
}

export const clipVideos = () => available('clips', CLIP_SLOTS)
export const motionVideos = () => available('motion', MOTION_SLOTS)
