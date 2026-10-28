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
  /** Topik utama (backend/niche.py); tidak ada di analisis lama */
  category?: string
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

/** Profil analisis (admin): bahasa, tipe video, target jumlah & durasi klip */
export interface ClipProfile {
  /** kode ISO bahasa ucapan, atau 'auto' */
  source_language: string
  /** bahasa judul/hook/deskripsi: kode ISO, atau 'same' = ikut bahasa video */
  output_language: string
  /** bahasa subtitle: 'same' = bahasa ucapan, kode bahasa = diterjemahkan */
  subtitle_language: string
  video_type: string
  clip_count: 'auto' | number
  duration: string
}

/** Preset klien (admin): profil analisis + format edit yang biasa dipakai untuk klien itu */
export interface ClientPreset {
  id: string
  name: string
  profile: ClipProfile
  /** Format edit untuk "render semua"; '' = tidak ditentukan */
  template_id: string
  updated_at: number
}

export interface ClipProfileOptions {
  languages: { id: string; label: string }[]
  video_types: { id: string; label: string }[]
  durations: { id: string; label: string }[]
  clip_counts: ('auto' | number)[]
  default: ClipProfile
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
  /** Profil yang dipakai saat analisis + hasil deteksi (tipe video & bahasa ucapan) */
  profile?: ClipProfile
  video_type?: string
  language?: string | null
}

export interface ClipGenerateOptions {
  /** Sisi pendek video 9:16 (2160 = 4K) */
  resolution: '720' | '1080' | '2160'
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
export interface UploadKit {
  titles: string[]
  description: string
  hashtags: string[]
  /** Deskripsi + hashtag, siap tempel di kolom deskripsi */
  description_full: string
}

/** Laporan performa bulanan per klien */
export interface ReportClip {
  title: string
  url: string
  platform: 'youtube' | 'tiktok' | 'instagram'
  thumbnail_url?: string | null
  /** Views terakhir yang tercatat (total sejak diunggah) */
  views: number
  /** Views yang bertambah selama periode laporan */
  views_in_period: number
  likes?: number | null
  published?: string
  new_in_period: boolean
  /** Hanya di laporan operator: skor analisis, untuk membandingkan dengan views sungguhan */
  viral_score?: number | null
}

export interface PerformanceReport {
  client_name: string
  period: string
  is_current: boolean
  updated_at: number | null
  totals: {
    delivered: number
    approved: number
    revision: number
    published: number
    tracked: number
    unreadable: number
    views: number
    avg_views_new: number | null
  }
  previous: { period: string; views: number; published: number }
  views_change_pct: number | null
  platforms: Record<string, { clips: number; views: number }>
  subscribers: { name: string; start: number; end: number; change: number }[]
  top_clips: ReportClip[]
  periods: string[]
}

export interface PerformanceClient {
  key: string
  client_name: string
  reviews: number
  links: number
  totals: PerformanceReport['totals']
  views_change_pct: number | null
  updated_at: number | null
  top_clip: ReportClip | null
  token: string
}

/** Link review per klien (tanpa login) */
export type ReviewStatus = 'pending' | 'approved' | 'revision'
export type RevisionReason = 'momen' | 'kutipan' | 'gaya' | 'musik' | 'lainnya'

export interface ReviewDecision {
  status: ReviewStatus
  at?: number
  reason?: RevisionReason
  note?: string
}

export interface ReviewPublishLink {
  url: string
  platform: 'youtube' | 'tiktok' | 'instagram'
  at: number
}

export interface ReviewSummary {
  total: number
  approved: number
  revision: number
  pending: number
  published: number
  opened: number
  last_opened: number | null
}

/** Klip di halaman review klien */
export interface ReviewClip {
  video_id: string
  key: string
  decision: ReviewDecision
  publish: ReviewPublishLink[]
  /** Klip sudah dihapus / belum final */
  unavailable?: boolean
  title?: string
  url?: string
  thumbnail_url?: string | null
  srt_url?: string | null
  upload?: UploadKit
  duration?: number | null
}

export interface PublicReview {
  review: { client_name: string; title: string; note: string; created_at: number; expires_at: number }
  clips: ReviewClip[]
  summary: ReviewSummary
  reasons: RevisionReason[]
}

/** Link review di sisi operator */
export interface ReviewLink {
  id: string
  client_name: string
  title: string
  note: string
  created_at: number
  expires_at: number
  items: { video_id: string; key: string }[]
  summary: ReviewSummary
  revisions: { video_id: string; key: string; reason?: RevisionReason; note: string; at?: number }[]
  token: string
}

export interface RenderedClip {
  key: string
  /** Judul klip (nama file unduhan): diedit pengguna atau saran dari analisis */
  title?: string
  thumbnail_url?: string | null
  /** Subtitle SRT klip final (teks hasil edit) */
  srt_url?: string | null
  /** Judul, deskripsi & hashtag siap salin ke YouTube Studio (tidak ada untuk klip lama) */
  upload?: UploadKit
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
  /** Unduh semua klip final sebagai ZIP (ada jika minimal 2 klip final) */
  zip_url: string | null
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
  /** "longform" = video panjang (satu "segmen" untuk seluruh video) */
  mode?: 'preview' | 'final' | 'longform'
  video_id: string
  title: string
  status: 'queued' | 'downloading' | 'running' | 'done' | 'error'
  message: string | null
  created_at: number
  finished_at: number | null
  download: { status: string; progress: number }
  segments: Record<string, RenderJobSegment>
}

// ── Video panjang tanpa wajah (backend/longform.py) ──
export type StockProvider = 'pixabay' | 'pexels'

export interface StockVisual {
  provider: StockProvider
  id: number
  link: string
  thumb: string
  page: string
  credit: string
  credit_url: string
  duration: number
}

export interface LongformScene {
  id: string
  kind: 'narration' | 'quote'
  /** Diisi pada adegan pertama sebuah bab */
  chapter: string
  text: string
  /** Narasi: kata kunci pencarian video stok (bahasa Inggris) */
  query?: string
  visual?: StockVisual | null
  /** Kutipan: rentang detik di video podcast */
  start?: number
  end?: number
  audio?: { url: string; duration: number; source: 'tts' | 'record' }
  /** stale = teks/suara diubah setelah suara AI dibuat */
  audio_state?: 'missing' | 'stale' | 'ready'
}

export interface LongformVoice {
  voice: string
  style: string
}

export interface LongformOutput {
  url: string
  filename: string
  rendered_at: string
  duration: number
  chapters: { at: number; title: string }[]
  description: string
}

export interface NewsSource {
  title: string
  url: string
  source: string
  date: string
}

/** Ide video dari berita terbaru (backend/topics.py) */
export interface TopicIdea {
  title: string
  angle: string
  why: string
  sources: NewsSource[]
}

export interface TopicProjectSummary {
  id: string
  title: string
  topic: string
  created_at: string
  scenes: number
  rendered_at: string | null
  duration: number | null
}

/** Ciri khas channel: nama (disebut di naskah) + gaya & warna thumbnail */
export interface LongformBrand {
  channel: string
  accent: string
  style: string
}

export interface LongformThumbnail {
  url: string
  filename: string
  text: string
  style: string
  accent: string
  /** Adegan yang video stoknya jadi latar; null = latar polos */
  scene_id: string | null
}

export interface LongformProject {
  title: string
  summary: string
  /** Nama channel yang dipakai saat naskah ditulis */
  channel?: string
  /** Saran teks thumbnail dari AI (*kata* = aksen) */
  thumbnail_ideas?: string[]
  thumbnail?: LongformThumbnail | null
  /** Proyek dari topik: topik, sudut pandang, dan berita sumbernya */
  topic?: string
  angle?: string
  sources?: NewsSource[]
  voice: LongformVoice
  scenes: LongformScene[]
  created_at?: string
  output: LongformOutput | null
}

export interface LongformData {
  /** podcast = dari video yang dianalisis; topic = dari topik/isu trending */
  kind: 'podcast' | 'topic'
  project: LongformProject | null
  voices: { id: string; label: string }[]
  durations: number[]
  /** Penyedia video stok yang aktif (key diisi di backend/.env); null = latar polos */
  stock_provider: StockProvider | null
  /** File video podcast tersedia (untuk adegan kutipan) */
  source_ready: boolean
  brand: LongformBrand
  /** id warna → hex */
  thumb_accents: Record<string, string>
  thumb_styles: { id: string; label: string }[]
}

/** Niche channel: topik kosong = semua momen ditampilkan */
export interface NicheSetting {
  topics: string[]
  /** Momen lucu ikut ditampilkan sebagai selingan */
  comedy: boolean
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
  niche: NicheSetting
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
  /** Suara asli: volume (100 = normal) & penjernih suara */
  voice: { volume: number; clean: boolean }
  /** Filter video lebih jernih & tajam */
  enhance: { video: boolean }
}

export type HookStyle = 'spotlight' | 'tape' | 'poster' | 'light' | 'dark' | 'outline'
export type HookAnim = 'cut' | 'pop' | 'slide' | 'type' | 'fade'
export type HookAccent = 'pink' | 'yellow' | 'lime' | 'cyan' | 'white'

/**
 * Teks pembuka di atas video. duration 0 = sepanjang klip; position_y = tepi atas blok (% tinggi).
 * *kata* di teks diberi warna aksen; label = pil kecil opsional di atas teks (mis. "POV").
 */
export interface HookSettings {
  enabled: boolean
  text: string
  label: string
  duration: number
  style: HookStyle
  anim: HookAnim
  accent: HookAccent
  font: CaptionStyle['font']
  size: number
  position_y: number
  /** Kekuatan bayangan bawah selama hook tampil (0 = mati); memudar saat hook hilang */
  shade: number
}

export interface TranscriptWord { start: number; end: number; word: string }
export interface TranscriptSegment { start: number; end: number; text: string; words: TranscriptWord[] }

export interface EditorAsset {
  name: string
  label: string
  kind: 'image' | 'audio'
  size_mb: number
  url: string
  /** Musik: suasana (santai/semangat/tegang/lucu/dramatis/umum) dari tanda di editor ("tag") atau tebakan nama file ("name") */
  mood?: string | null
  mood_source?: 'tag' | 'name' | null
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
  thumbnail: ClipThumbnail | null
  /** Teks thumbnail saran dari analisis (atau ide hook pertama) */
  thumbnail_suggestion: string
  /** Efek suara bawaan per kategori (Transisi, Penekanan, Lucu, Notifikasi, Suasana) */
  sfx_library: { name: string; label: string; group: string; url: string }[]
  /** Musik latar bawaan per suasana (bebas hak cipta) */
  music_library: { name: string; label: string; mood: string; url: string }[]
  assets: EditorAsset[]
  templates: EditTemplate[]
  /** Resep edit otomatis untuk klip ini & ringkasannya */
  auto_edit: EditRecipe
  auto_summary: { mood: string; music: string; music_is_user: boolean; sfx: number; hook: string }
  /** true = klip belum pernah diedit, jadi editor dibuka dengan edit otomatis */
  auto_applied: boolean
}

/** Thumbnail klip (JPG 1080×1920). at = detik video sumber frame-nya. */
export interface ClipThumbnail {
  url: string
  text: string
  at: number | null
}

/** Format edit tersimpan: tampilan klip (tanpa rentang, teks hook & efek suara) + pengaturan caption & render. */
export interface EditTemplate {
  id: string
  name: string
  edit: Pick<EditRecipe, 'vignette' | 'marks' | 'music' | 'hook'>
  options: RenderOptions
  /** Teks sumber diisi otomatis dengan channel video tempat format dipakai */
  source_auto: boolean
  updated_at: number
}
