import { useEffect, useState } from 'react'
import { getClips, getVideos } from '@/lib/api'
import { RenderedClip, VideoSummary } from '@/lib/types'

export interface LandingMedia {
  videos: VideoSummary[]
  /** Satu klip hasil render untuk diputar di bingkai HP pada hero */
  showcase: (Omit<RenderedClip, 'url'> & { url: string; videoTitle: string; videoId: string }) | null
  loaded: boolean
}

/**
 * Gambar & klip asli dari pustaka pengguna untuk landing page (kosong jika belum login
 * atau belum ada riwayat; landing memakai ilustrasi sebagai gantinya).
 */
export function useLandingMedia(signedIn: boolean): LandingMedia {
  const [media, setMedia] = useState<LandingMedia>({ videos: [], showcase: null, loaded: false })

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    getVideos()
      .then(async videos => {
        const withClips = videos.find(v => v.clip_count > 0)
        let showcase: LandingMedia['showcase'] = null
        if (withClips) {
          const clips = await getClips(withClips.video_id).catch(() => [])
          // Utamakan klip final (sudah ada caption); pratinjau sebagai cadangan
          const pick = clips.find(c => c.url && !c.legacy) ?? clips.find(c => c.url) ?? clips[0]
          const url = pick?.url ?? pick?.preview_url
          if (pick && url) showcase = { ...pick, url, videoTitle: withClips.title, videoId: withClips.video_id }
        }
        if (!cancelled) setMedia({ videos, showcase, loaded: true })
      })
      .catch(() => {
        if (!cancelled) setMedia(m => ({ ...m, loaded: true }))
      })
    return () => { cancelled = true }
  }, [signedIn])

  return media
}

export const thumbUrl = (videoId: string, size: 'mq' | 'maxres' = 'mq') =>
  `https://img.youtube.com/vi/${videoId}/${size === 'maxres' ? 'maxresdefault' : 'mqdefault'}.jpg`
