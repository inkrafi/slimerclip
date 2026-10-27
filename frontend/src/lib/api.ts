import {
  AnalysisResult, ClipGenerateOptions, ClipThumbnail, EditRecipe, EditTemplate, EditorAsset, EditorData, LongformBrand, LongformData, LongformProject, Me, TopicIdea, TopicProjectSummary, NicheSetting, RenderJob, StockVisual, RenderOptions, RenderedClip, Segment,
  TranscriptSegment, UploadedFileInfo, VideoDetail, VideoSummary,
} from '@/lib/types'
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

export const saveNiche = (niche: NicheSetting) =>
  request<Me>('/me/niche', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(niche),
  })

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

// ── Editor klip (admin) ──
export const getEditor = (videoId: string, key: string) =>
  request<EditorData>(`/videos/${encodeURIComponent(videoId)}/editor?key=${encodeURIComponent(key)}`)

/** Render ulang satu klip dengan resep edit (dan teks caption yang diedit, jika ada). */
export const renderEdit = (videoId: string, key: string, edit: EditRecipe, options: RenderOptions, transcript: TranscriptSegment[] | null) =>
  request<{ job: RenderJob }>(`/videos/${encodeURIComponent(videoId)}/editor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, edit, options, transcript }),
  }).then(r => r.job)

// ── Video panjang ──
/** Proyek dari topik berawalan "topic_"; selain itu proyek dari video podcast */
export const isTopicKey = (key: string) => key.startsWith('topic_')
const longformPath = (key: string) =>
  isTopicKey(key) ? `/longform/topics/${encodeURIComponent(key)}` : `/videos/${encodeURIComponent(key)}/longform`
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})

export const getLongform = (videoId: string) => request<LongformData>(longformPath(videoId))

export const createLongformScript = (videoId: string, minutes: number, focus: string, channel: string) =>
  request<LongformData>(`${longformPath(videoId)}/script`, json('POST', { minutes, focus, channel }))

export const createLongformThumbnail = (videoId: string, body: { text: string; style: string; accent: string; scene_id: string }) =>
  request<LongformData>(`${longformPath(videoId)}/thumbnail`, json('POST', body))

export const saveLongformBrand = (brand: Partial<LongformBrand>) =>
  request<{ brand: LongformBrand }>('/longform/brand', json('PUT', brand)).then(r => r.brand)

export const saveLongform = (videoId: string, project: Pick<LongformProject, 'title' | 'summary' | 'voice' | 'scenes'>) =>
  request<LongformData>(longformPath(videoId), json('PUT', {
    title: project.title,
    summary: project.summary,
    voice: project.voice,
    // Audio milik server: tidak dikirim
    scenes: project.scenes.map(({ id, kind, chapter, text, query, visual, start, end }) => ({ id, kind, chapter, text, query, visual, start, end })),
  }))

export const longformTts = (videoId: string, sceneId: string) =>
  request<LongformData>(`${longformPath(videoId)}/scenes/${encodeURIComponent(sceneId)}/tts`, { method: 'POST' })

export const uploadLongformRecording = (videoId: string, sceneId: string, audio: Blob, filename: string) => {
  const form = new FormData()
  form.append('audio', audio, filename)
  return request<LongformData>(`${longformPath(videoId)}/scenes/${encodeURIComponent(sceneId)}/recording`, { method: 'POST', body: form })
}

export const deleteLongformAudio = (videoId: string, sceneId: string) =>
  request<LongformData>(`${longformPath(videoId)}/scenes/${encodeURIComponent(sceneId)}/audio`, { method: 'DELETE' })

export const autoLongformVisuals = (videoId: string) =>
  request<LongformData>(`${longformPath(videoId)}/visuals/auto`, { method: 'POST' })

export const searchStock = (query: string) =>
  request<{ results: StockVisual[] }>(`/longform/stock?q=${encodeURIComponent(query)}`).then(r => r.results)

export const getTopicIdeas = (query: string, useNiche: boolean) =>
  request<{ ideas: TopicIdea[]; headline_count: number }>('/longform/ideas', json('POST', { query, use_niche: useNiche }))

/** Rekomendasi topik sesuai niche (disimpan server beberapa jam); refresh = buat ulang sekarang */
export const getRecommendedIdeas = (refresh = false) =>
  request<{ ideas: TopicIdea[]; generated_at: number; niche: string[] }>(`/longform/ideas/recommended${refresh ? '?refresh=1' : ''}`)

export const listTopicProjects = () => request<{ projects: TopicProjectSummary[]; brand: LongformBrand }>('/longform/topics')

export const createTopicProject = (body: { title: string; angle: string; sources: TopicIdea['sources']; minutes: number; channel: string }) =>
  request<LongformData & { id: string }>('/longform/topics', json('POST', body))

export const deleteTopicProject = (id: string) =>
  request<{ message: string }>(`/longform/topics/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const renderLongform = (videoId: string) =>
  request<{ job: RenderJob }>(`${longformPath(videoId)}/render`, { method: 'POST' }).then(r => r.job)

export const getJob = (jobId: string) => request<{ job: RenderJob }>(`/jobs/${encodeURIComponent(jobId)}`).then(r => r.job)

export const uploadAsset = (file: File) => {
  const body = new FormData()
  body.append('file', file)
  return request<{ asset: EditorAsset }>('/assets', { method: 'POST', body }).then(r => r.asset)
}

export const deleteAsset = (name: string) =>
  request<{ message: string }>(`/assets/${encodeURIComponent(name)}`, { method: 'DELETE' })

/** Ubah judul klip (nama file unduhan) tanpa render ulang; kosong = kembali ke judul saran. */
export const saveClipTitle = (videoId: string, key: string, title: string) =>
  request<{ title: string }>(`/videos/${encodeURIComponent(videoId)}/clip-title`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, title }),
  }).then(r => r.title)

/** Simpan format edit (nama yang sama ditimpa). */
export const saveTemplate = (name: string, edit: EditRecipe, options: RenderOptions, sourceAuto: boolean) =>
  request<{ template: EditTemplate }>('/edit-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, edit, options, source_auto: sourceAuto }),
  }).then(r => r.template)

/** Buat thumbnail klip. at = detik video sumber (null = frame dengan wajah paling jelas). */
export const createThumbnail = (videoId: string, key: string, text: string, at: number | null,
  hook: Pick<EditRecipe['hook'], 'style' | 'accent' | 'font'>) =>
  request<{ thumbnail: ClipThumbnail }>(`/videos/${encodeURIComponent(videoId)}/thumbnail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, text, at, hook }),
  }).then(r => r.thumbnail)

export const getTemplates = () => request<{ templates: EditTemplate[] }>('/edit-templates').then(r => r.templates)

/** Render final semua klip satu video dengan satu format edit (satu job). */
export const renderAll = (videoId: string, templateId: string) =>
  request<{ job: RenderJob }>(`/videos/${encodeURIComponent(videoId)}/render-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: templateId }),
  }).then(r => r.job)

export const deleteTemplate = (id: string) =>
  request<{ message: string }>(`/edit-templates/${encodeURIComponent(id)}`, { method: 'DELETE' })

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
