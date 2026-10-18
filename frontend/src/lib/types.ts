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

export interface CaptionStyle {
  font: string
  size: number
  color: string
  outline_color: string
  outline_width: number
  position: 'top' | 'center' | 'bottom'
  background_box: boolean
  highlight_mode: 'none' | 'word' | 'line'
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
  url: string
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
