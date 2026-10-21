import type { CaptionStyle } from '@/lib/caption-presets'

export type { CaptionStyle }

export interface Hooks {
  hook_pertanyaan: string
  hook_pernyataan: string
  hook_teaser: string
}

/** Rincian skor viral dari backend (scoring.py). */
export interface ScoreBreakdown {
  ai: { total: number; hook?: number; emosi?: number; daya_tarik?: number; penutup?: number }
  /** Persentil "Most replayed" YouTube (0–100), null jika video belum punya data */
  penonton: number | null
  struktur: { skor: number; durasi_detik: number; kata_per_detik: number | null }
  bobot: { ai: number; penonton?: number; struktur: number }
}

export interface Segment {
  segment_number: number
  start_time: string
  end_time: string
  duration_seconds?: number
  topic: string
  why_viral: string
  emotion_trigger: string
  viral_score: number
  score_breakdown?: ScoreBreakdown
  speaker_quote?: string
  content_angle?: string
  hooks: Hooks
  caption_suggestion: string
}

export interface HeatmapPoint {
  start_time: number
  end_time: number
  value: number
}

export interface VideoMetadata {
  title: string
  channel: string
  duration: number
  view_count: number
  description: string
  tags: string[]
  thumbnail: string
  heatmap?: HeatmapPoint[]
}

export interface AnalysisResult {
  segments: Segment[]
  overall_video_summary: string
  best_segment_number: number
  total_clip_recommendations: number
  error?: string
  video_metadata?: VideoMetadata
  scoring_version?: number
  from_cache?: boolean
}

export interface ClipGenerateOptions {
  resolution: '1080' | '720'
  caption_enabled: boolean
  caption_style: CaptionStyle
  smart_tracking: boolean
  split_screen: boolean
  format: 'mp4'
  local_video_path?: string  // Referensi upload "<video_id>/<filename>" dari /upload-video (bukan path absolut)
  video_id?: string          // ID sesi untuk mode upload lokal
}

export interface ClipProgress {
  segment_number: number
  status: 'queued' | 'downloading' | 'cutting' | 'transcribing' | 'tracking' | 'rendering' | 'done' | 'error'
  progress: number
  output_path?: string
  url?: string
  error_message?: string
}

export interface UploadedFileInfo {
  filename: string
  local_video_path: string
  file_size_mb: number
  video_id: string
}

/** Klip yang sudah dirender dan tersimpan di backend (clips/<id>/manifest.json). */
export interface RenderedClip {
  key: string
  /** null untuk klip lama yang dibuat sebelum ada pencatatan (rentang waktunya tidak diketahui) */
  start_time: string | null
  end_time: string | null
  legacy?: boolean
  duration_seconds?: number | null
  topic: string
  segment_number?: number
  viral_score?: number
  filename: string
  rendered_at: string
  resolution?: string
  caption?: boolean
  layout?: { mode: string; full?: number; zoom?: number; split?: number; shots?: number } | null
  /** Rentang hasil render (detik video sumber); bisa berbeda dari momen jika diedit */
  range?: [number, number] | null
  edit?: EditRecipe | null
  /** "preview" = pratinjau tanpa caption (edit dulu, belum bisa diunduh); "final" = klip jadi */
  status?: 'preview' | 'final'
  /** Klip final (bisa diunduh); null selama masih pratinjau */
  url: string | null
  /** Pratinjau bersih untuk editor */
  preview_url?: string | null
  file_size_mb: number
}

export interface VideoDetail {
  video_id: string
  analysis: AnalysisResult | null
  analyzing: boolean
  clips: RenderedClip[]
  upload: UploadedFileInfo | null
}

export interface VideoSummary {
  video_id: string
  youtube_url: string
  analyzed_at: string
  title: string
  channel: string
  duration: number
  segment_count: number
  clip_count: number
}

/** Job render di belakang layar (backend/jobs.py). */
export interface RenderJobSegment {
  segment_number: number
  key: string
  start_time: string
  end_time: string
  topic: string
  status: ClipProgress['status']
  progress: number
  message: string | null
  url: string | null
}

export interface RenderJob {
  id: string
  video_id: string
  title: string
  status: 'queued' | 'downloading' | 'running' | 'done' | 'error'
  message: string | null
  created_at: number
  finished_at: number | null
  download: { status: string; progress: number }
  segments: Record<string, RenderJobSegment>
}

/** Akun yang sedang login (GET /me). Batas bernilai null = tanpa batas (admin). */
export interface Me {
  id: string
  email: string
  name: string
  avatar_url: string
  is_admin: boolean
  auth_enabled: boolean
  has_gemini_key: boolean
  gemini_key_hint: string | null
  free_analyses_limit: number | null
  free_analyses_left: number | null
  render_daily_limit: number | null
  renders_today: number | null
  preview_daily_limit: number | null
  previews_today: number | null
  upload_max_mb: number | null
  upload_max_minutes: number | null
}

// ── Editor klip (admin) ──
export type WatermarkPosition = 'tl' | 'tc' | 'tr' | 'bl' | 'br'

export type VignetteShape = 'bottom' | 'top' | 'both' | 'radial'
export type MarkKind = 'logo' | 'account' | 'source'

export interface WatermarkMark {
  enabled: boolean
  position: WatermarkPosition
  /** Logo: % lebar video; teks: ukuran huruf ÷ 3,2 */
  size: number
  opacity: number
  asset?: string
  text?: string
}

/** Resep edit satu klip (backend/clip_effects.py). Waktu dalam detik video sumber. */
export interface EditRecipe {
  start: number
  end: number
  vignette: { shape: VignetteShape; strength: number; height: number }
  marks: Record<MarkKind, WatermarkMark>
  music: { asset: string; volume: number; ducking: boolean }
  sfx: { asset: string; at: number; volume: number }[]
  hook: HookSettings
}

export type HookStyle = 'light' | 'dark' | 'outline'

/** Teks pembuka di atas video. duration 0 = sepanjang klip; position_y = tepi atas teks (% tinggi). */
export interface HookSettings {
  enabled: boolean
  text: string
  duration: number
  style: HookStyle
  font: CaptionStyle['font']
  size: number
  position_y: number
}

export interface TranscriptWord { start: number; end: number; word: string }
export interface TranscriptSegment { start: number; end: number; text: string; words: TranscriptWord[] }

export interface EditorAsset {
  name: string
  label: string
  kind: 'image' | 'audio'
  size_mb: number
  url: string
}

export type RenderOptions = Pick<ClipGenerateOptions, 'resolution' | 'caption_enabled' | 'smart_tracking' | 'split_screen' | 'caption_style'>

export interface EditorData {
  clip: RenderedClip
  title: string
  channel: string
  moment: { start: number; end: number }
  rendered_range: [number, number]
  /** true = video di editor adalah pratinjau bersih: caption, hook & efek ditampilkan langsung di atasnya */
  clean_preview: boolean
  video_duration: number | null
  edit: EditRecipe
  options: RenderOptions
  transcript: { range: [number, number]; segments: TranscriptSegment[] } | null
  source_ready: boolean
  /** Sisa jatah render final hari ini; null = tanpa batas */
  final_left: number | null
  hook_suggestions: string[]
  sfx_library: { name: string; label: string; url: string }[]
  assets: EditorAsset[]
}
