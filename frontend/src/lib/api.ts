import { AnalysisResult, ClipGenerateOptions, Me, RenderJob, RenderedClip, Segment, UploadedFileInfo, VideoDetail, VideoSummary } from '@/lib/types'
import { accessToken } from '@/lib/supabase'

export const BACKEND_URL = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || 'http://127.0.0.1:5000'

/** Error dari backend, lengkap dengan kode (mis. "quota_exhausted") agar UI bisa memberi jalan keluar. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message)
  }
}

/** Event browser saat backend menolak sesi login (token kedaluwarsa/dicabut). */
export const AUTH_EXPIRED_EVENT = 'slimerclip:auth-expired'

async function authHeaders(): Promise<Record<string, string>> {
  const token = await accessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    const headers = { ...(init?.headers as Record<string, string> | undefined), ...(await authHeaders()) }
    response = await fetch(`${BACKEND_URL}${path}`, { ...init, headers })
  } catch {
    throw new Error('Backend tidak bisa dihubungi. Pastikan `python app.py` sedang berjalan.')
  }
  let data: unknown = null
  try { data = await response.json() } catch { /* bukan JSON */ }
  if (!response.ok) {
    const body = data as { error?: string; code?: string } | null
    if (response.status === 401 && body?.code === 'auth_required') window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    throw new ApiError(body?.error || `Backend membalas error ${response.status}.`, response.status, body?.code)
  }
  return data as T
}

// ── Akun ──
export const getMe = () => request<Me>('/me')

export const saveGeminiKey = (apiKey: string) =>
  request<Me>('/me/gemini-key', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  })

export const deleteGeminiKey = () => request<Me>('/me/gemini-key', { method: 'DELETE' })

export const deleteAccount = () => request<{ message: string }>('/me', { method: 'DELETE' })

export const youtubeUrlFor = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`

export const getVideos = () => request<{ items: VideoSummary[] }>('/videos').then(r => r.items)

export const getVideo = (videoId: string) => request<VideoDetail>(`/videos/${encodeURIComponent(videoId)}`)

export const getClips = (videoId: string) =>
  request<{ clips: RenderedClip[] }>(`/videos/${encodeURIComponent(videoId)}/clips`).then(r => r.clips)

export const deleteVideo = (videoId: string) =>
  request<{ message: string }>(`/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE' })

/** Analisis video. Jika sudah pernah dianalisis, hasil tersimpan dipakai (kecuali force). */
export const analyzeVideo = (youtubeUrl: string, force = false) =>
  request<AnalysisResult>('/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ youtube_url: youtubeUrl, force_refresh: force }),
  })

/** Mulai render di belakang layar; hasilnya job yang progresnya dipantau lewat getJobs. */
export const startRender = (youtubeUrl: string, segments: Segment[], options: ClipGenerateOptions) =>
  request<{ job: RenderJob }>('/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      youtube_url: options.local_video_path ? '' : youtubeUrl,
      local_video_path: options.local_video_path || null,
      video_id: options.video_id || undefined,
      segments,
      options,
    }),
  }).then(r => r.job)

/** Job render aktif & yang baru selesai (opsional untuk satu video). */
export const getJobs = (videoId?: string) =>
  request<{ jobs: RenderJob[] }>(videoId ? `/jobs?video_id=${encodeURIComponent(videoId)}` : '/jobs').then(r => r.jobs)

export const isJobActive = (job: RenderJob) => ['queued', 'downloading', 'running'].includes(job.status)

/** Event browser agar indikator render di header langsung memeriksa job baru. */
export const RENDER_STARTED_EVENT = 'slimerclip:render-started'

/** Tautan unduh untuk URL klip (memaksa browser menyimpan file, bukan memutarnya). */
export const downloadUrl = (url: string) => `${url}${url.includes('?') ? '&' : '?'}download=1`

export const ALLOWED_VIDEO_EXTS = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.m4v', '.flv']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/x-matroska', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-m4v', 'video/x-flv']

/** Ekstrak ID video YouTube dari berbagai format URL (watch, youtu.be, embed, shorts, live). */
export function extractVideoId(url: string): string | null {
  if (!url) return null
  const match = url.match(/(?:v=|\/v\/|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([0-9A-Za-z_-]{11})/)
  if (match) return match[1]
  const fallback = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)
  return fallback ? fallback[1] : null
}

/** ID sesi upload: ID video YouTube jika ada, kalau tidak `local_<timestamp>`. */
export function getUploadSessionId(youtubeUrl: string): string {
  return extractVideoId(youtubeUrl) ?? `local_${Date.now()}`
}

export function isAllowedVideoFile(file: File): boolean {
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  return ALLOWED_VIDEO_EXTS.includes(ext) || ALLOWED_VIDEO_TYPES.includes(file.type)
}

/** Upload video ke backend. Pakai XHR (bukan fetch) agar progress upload bisa dipantau. */
export async function uploadVideo(file: File, videoId: string, onProgress?: (percent: number) => void): Promise<UploadedFileInfo> {
  const formData = new FormData()
  formData.append('video', file)
  formData.append('video_id', videoId)
  const headers = await authHeaders()

  return new Promise<UploadedFileInfo>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BACKEND_URL}/upload-video`)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    })

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error('Respons upload tidak valid'))
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText)
          reject(new ApiError(err.error || `Upload gagal (${xhr.status})`, xhr.status, err.code))
        } catch {
          reject(new ApiError(`Upload gagal (${xhr.status})`, xhr.status))
        }
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Koneksi ke backend gagal. Pastikan backend berjalan.')))
    xhr.send(formData)
  })
}
