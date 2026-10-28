'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Download, Loader2, RotateCcw, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import CaptionStyleEditor, { Range, Row, Toggle } from '@/components/CaptionStyleEditor'
import AssetPicker from '@/components/editor/AssetPicker'
import ClipTitleField from '@/components/editor/ClipTitleField'
import { HookShade, MarksPreview, VignettePreview } from '@/components/editor/EffectPreview'
import { HookOverlay, LiveCaption } from '@/components/editor/LiveOverlays'
import MusicPanel from '@/components/editor/MusicPanel'
import SfxPanel from '@/components/editor/SfxPanel'
import ThumbnailPanel from '@/components/editor/ThumbnailPanel'
import TemplatePanel from '@/components/editor/TemplatePanel'
import TranscriptEditor from '@/components/editor/TranscriptEditor'
import TrimBar from '@/components/editor/TrimBar'
import { deleteTemplate, downloadUrl, getEditor, getJob, renderEdit, RENDER_STARTED_EVENT, saveTemplate } from '@/lib/api'
import { CAPTION_FONTS, CaptionFont, saveCaptionStyle } from '@/lib/caption-presets'
import { HOOK_ACCENTS, HOOK_ANIM_OPTIONS, HOOK_STYLE_OPTIONS } from '@/lib/hook-look'
import type {
  EditRecipe, EditTemplate, EditorData, HookAccent, HookSettings, MarkKind, RenderJob, RenderOptions, TranscriptSegment, VignetteShape, WatermarkMark,
  WatermarkPosition,
} from '@/lib/types'

const EXTEND_SECONDS = 30
const STATUS_LABEL: Record<string, string> = {
  queued: 'Mengantre', downloading: 'Mengunduh video sumber', cutting: 'Menyiapkan', tracking: 'Mengikuti pembicara',
  transcribing: 'Menyiapkan caption', rendering: 'Merender', done: 'Selesai', error: 'Gagal',
}
const POSITIONS: { id: WatermarkPosition; label: string }[] = [
  { id: 'tl', label: 'Kiri atas' }, { id: 'tc', label: 'Tengah atas' }, { id: 'tr', label: 'Kanan atas' },
  { id: 'bl', label: 'Kiri bawah' }, { id: 'br', label: 'Kanan bawah' },
]
const VIGNETTE_SHAPES: { id: VignetteShape; label: string }[] = [
  { id: 'bottom', label: 'Bawah' }, { id: 'top', label: 'Atas' }, { id: 'both', label: 'Atas & bawah' }, { id: 'radial', label: 'Lingkaran' },
]
const HOOK_DURATIONS = [3, 4, 5, 0]
type Tab = 'teks' | 'audio' | 'visual' | 'thumbnail' | 'ekspor'
const TABS: { id: Tab; label: string }[] = [
  { id: 'teks', label: 'Teks & hook' },
  { id: 'audio', label: 'Audio' },
  { id: 'visual', label: 'Visual' },
  { id: 'thumbnail', label: 'Thumbnail' },
  { id: 'ekspor', label: 'Potong & ekspor' },
]
const RESOLUTIONS: { id: RenderOptions['resolution']; label: string; hint: string }[] = [
  { id: '720', label: '720p', hint: '720×1280. File kecil, untuk pratinjau atau kuota data terbatas.' },
  { id: '1080', label: '1080p', hint: '1080×1920. Standar TikTok, Reels & Shorts.' },
  { id: '2160', label: '4K', hint: '2160×3840. Shorts memberi bitrate lebih tinggi untuk upload 4K, jadi hasilnya lebih tajam. Render lebih lama & file lebih besar.' },
]
const MARKS: { kind: MarkKind; title: string; hint: string }[] = [
  { kind: 'source', title: 'Sumber video', hint: 'Kredit untuk kreator aslinya.' },
  { kind: 'account', title: 'Teks akun', hint: 'Nama akun atau @handle kamu.' },
  { kind: 'logo', title: 'Logo', hint: 'Gambar PNG transparan paling rapi.' },
]

interface Props {
  videoId: string
  clipKey: string
}

/**
 * Editor satu klip. Video yang diputar adalah pratinjau bersih; caption, hook, watermark & vignette
 * ditampilkan langsung di atasnya (caption & hook bisa digeser). "Render final" membuat klip yang bisa diunduh.
 */
export default function ClipEditor({ videoId, clipKey }: Props) {
  const [data, setData] = useState<EditorData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditRecipe | null>(null)
  const [options, setOptions] = useState<RenderOptions | null>(null)
  const [transcript, setTranscript] = useState<TranscriptSegment[] | null>(null)
  const [transcriptDirty, setTranscriptDirty] = useState(false)
  const [job, setJob] = useState<RenderJob | null>(null)
  const [playhead, setPlayhead] = useState<number | null>(null)
  const [hookFocus, setHookFocus] = useState(false)
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('teks')
  const [autoApplied, setAutoApplied] = useState(false)
  const video = useRef<HTMLVideoElement>(null)

  const load = useCallback(() => {
    return getEditor(videoId, clipKey).then(d => {
      setData(d)
      setEdit(d.edit)
      setAutoApplied(d.auto_applied)
      setOptions(d.options)
      setTranscript(d.transcript?.segments ?? null)
      setTranscriptDirty(false)
    })
  }, [videoId, clipKey])

  useEffect(() => {
    load().catch(e => setLoadError(e instanceof Error ? e.message : 'Klip gagal dimuat.'))
  }, [load])

  // Pantau job render ulang sampai selesai, lalu muat klip terbaru
  const jobId = job?.id
  useEffect(() => {
    if (!jobId) return
    let stopped = false
    const timer = setInterval(async () => {
      try {
        const next = await getJob(jobId)
        if (stopped) return
        setJob(next)
        if (next.status === 'done' || next.status === 'error') {
          clearInterval(timer)
          const seg = Object.values(next.segments)[0]
          if (next.status === 'done' && seg?.status === 'done') {
            await load()
            setJob(null)
            toast.success('Klip final siap diunduh')
          }
        }
      } catch { /* coba lagi di interval berikutnya */ }
    }, 1500)
    return () => { stopped = true; clearInterval(timer) }
  }, [jobId, load])

  // Kata contoh untuk pratinjau caption: ucapan di awal klip
  const spoken = (transcript ?? [])
    .filter(s => edit && s.end > edit.start && s.start < edit.end)
    .flatMap(s => s.words.map(w => w.word.trim()))
    .filter(Boolean)
  const sampleWords = (spoken.length ? spoken : (data?.clip.topic || 'Momen terbaik dari podcast ini').split(/\s+/)).slice(0, 12)

  if (loadError) {
    return (
      <div className="pt-10 max-w-lg">
        <p role="alert" className="border-l-2 border-tally pl-4 text-ink-muted">{loadError}</p>
        <Link href={`/video/${videoId}/klip`} className="mt-6 btn btn-quiet">Kembali ke klip</Link>
      </div>
    )
  }
  if (!data || !edit || !options) {
    return <p className="pt-10 flex items-center gap-2 text-ink-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Memuat editor…</p>
  }

  const rendered = data.rendered_range
  const bounds: [number, number] = [
    Math.max(0, Math.min(data.moment.start, rendered[0], edit.start) - EXTEND_SECONDS),
    Math.min(data.video_duration ?? Infinity, Math.max(data.moment.end, rendered[1], edit.end) + EXTEND_SECONDS),
  ]
  const baked = data.clip.edit
  const rendering = job !== null && job.status !== 'error'
  const jobSegment = job ? Object.values(job.segments)[0] : null
  const failed = job?.status === 'error' || jobSegment?.status === 'error'
  const dirty = transcriptDirty
    || JSON.stringify(edit) !== JSON.stringify(data.edit)
    || JSON.stringify(options) !== JSON.stringify(data.options)

  const setMark = (kind: MarkKind, patch: Partial<WatermarkMark>) =>
    setEdit({ ...edit, marks: { ...edit.marks, [kind]: { ...edit.marks[kind], ...patch } } })
  const setVignette = (patch: Partial<EditRecipe['vignette']>) => setEdit({ ...edit, vignette: { ...edit.vignette, ...patch } })
  const setMusic = (patch: Partial<EditRecipe['music']>) => setEdit({ ...edit, music: { ...edit.music, ...patch } })
  const setAssets = (assets: EditorData['assets']) => setData({ ...data, assets })
  const setHook = (patch: Partial<HookSettings>) => setEdit({ ...edit, hook: { ...edit.hook, ...patch } })

  // Klik caption di video → edit kalimatnya di daftar teks
  const pickSegment = (index: number) => {
    video.current?.pause()
    const field = document.getElementById(`caption-seg-${index}`) as HTMLTextAreaElement | null
    field?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    field?.focus({ preventScroll: true })
  }
  const focusHook = () => {
    video.current?.pause()
    const field = document.getElementById('hook-text')
    field?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    field?.focus({ preventScroll: true })
  }

  const seek = (sourceTime: number) => {
    const el = video.current
    if (!el || sourceTime < rendered[0] || sourceTime > rendered[1]) return
    el.currentTime = sourceTime - rendered[0]
    el.play().catch(() => {})
  }

  const submit = async () => {
    try {
      const started = await renderEdit(videoId, clipKey, edit, options, transcriptDirty ? transcript : null)
      setJob(started)
      // Gaya caption ini jadi bawaan untuk pratinjau klip berikutnya
      saveCaptionStyle(options.caption_style)
      window.dispatchEvent(new Event(RENDER_STARTED_EVENT))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Render ulang gagal dimulai.')
    }
  }

  const sourceDefault = data.channel ? `Sumber: ${data.channel} (YouTube)` : 'Sumber: YouTube'

  // Format edit: tampilan & pengaturan dari format tersimpan; rentang, teks caption & efek suara klip ini tetap
  const applyTemplate = (t: EditTemplate) => {
    const has = (name?: string) => !name || data.assets.some(a => a.name === name)
    const hookText = edit.hook.text || data.hook_suggestions[0] || ''
    setEdit({
      ...edit,
      vignette: t.edit.vignette,
      marks: {
        ...t.edit.marks,
        logo: { ...t.edit.marks.logo, ...(has(t.edit.marks.logo.asset) ? {} : { asset: '', enabled: false }) },
        source: { ...t.edit.marks.source, ...(t.source_auto ? { text: sourceDefault } : {}) },
      },
      music: has(t.edit.music.asset) ? t.edit.music : { ...t.edit.music, asset: '' },
      hook: { ...t.edit.hook, text: hookText, enabled: t.edit.hook.enabled && !!hookText },
    })
    setOptions({ ...options, ...t.options })
    setAppliedTemplate(t.id)
    toast.success(`Format "${t.name}" diterapkan. Cek pratinjau lalu render final.`)
  }

  const storeTemplate = async (name: string) => {
    try {
      const saved = await saveTemplate(name, edit, options, edit.marks.source.text === sourceDefault)
      setData({ ...data, templates: [saved, ...data.templates.filter(t => t.id !== saved.id)] })
      setAppliedTemplate(saved.id)
      toast.success(`Format "${saved.name}" disimpan`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Format gagal disimpan.')
    }
  }

  const removeTemplate = async (t: EditTemplate) => {
    try {
      await deleteTemplate(t.id)
      setData(d => d && { ...d, templates: d.templates.filter(x => x.id !== t.id) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Format gagal dihapus.')
    }
  }

  // Edit otomatis: hook, musik sesuai suasana, efek suara, suara jernih, HD. Rentang & watermark klip tetap.
  const applyAuto = () => {
    const auto = data.auto_edit
    const shift = edit.start - auto.start
    setEdit({
      ...edit,
      hook: auto.hook,
      music: auto.music,
      vignette: auto.vignette,
      voice: auto.voice,
      enhance: auto.enhance,
      sfx: auto.sfx.map(x => ({ ...x, at: Math.round((x.at + shift) * 100) / 100 })).filter(x => x.at < edit.end),
    })
    setAutoApplied(true)
    toast.success('Edit otomatis diterapkan. Sesuaikan lalu render.')
  }

  const clearEffects = () => {
    setEdit({ ...edit, hook: { ...edit.hook, enabled: false }, music: { ...edit.music, asset: '' }, sfx: [],
      voice: { volume: 100, clean: false }, enhance: { video: false } })
    setAutoApplied(false)
  }

  const reset = () => {
    setEdit(data.edit)
    setOptions(data.options)
    setTranscript(data.transcript?.segments ?? null)
    setTranscriptDirty(false)
  }

  // Pratinjau bersih: semua lapisan tampil langsung. Klip lama tanpa pratinjau: hanya efek yang berubah
  // (di atas video final yang sudah berisi efek sebelumnya)
  const clean = data.clean_preview
  const vignetteChanged = clean || JSON.stringify(edit.vignette) !== JSON.stringify(baked?.vignette ?? null)
  const marksChanged = clean || JSON.stringify(edit.marks) !== JSON.stringify(baked?.marks ?? null)
  const clipTime = playhead === null ? 0 : playhead - edit.start
  // Sebelum diputar atau saat teks hook diketik: tampilkan keadaan akhir (tanpa animasi)
  const hookSettled = hookFocus || playhead === null
  const hookWords = edit.hook.text.replaceAll('*', ' ').split(/\s+/).filter(Boolean).length
  const hookEnd = edit.hook.duration <= 0 ? edit.end - edit.start : Math.min(edit.end - edit.start, edit.hook.duration)
  const finalUrl = data.clip.url
  const canDownload = !!finalUrl && !dirty && !rendering
  const outOfQuota = data.final_left === 0
  const logo = data.assets.find(a => a.name === edit.marks.logo.asset)
  const ytThumb = /^[\w-]{11}$/.test(videoId) ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined

  return (
    <div className="pt-8 pb-28">
      <Link href={`/video/${videoId}/klip`} className="text-sm text-ink-muted underline underline-offset-4 decoration-rule hover:text-ink">
        Kembali ke klip tersimpan
      </Link>
      <h1 className="mt-3 type-display text-3xl sm:text-4xl text-ink">Edit klip</h1>
      <p className="mt-2 max-w-[68ch] text-ink-muted">{data.clip.topic || data.title}</p>
      <ClipTitleField videoId={videoId} clipKey={clipKey} initial={data.clip.title ?? ''} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        {/* Pratinjau */}
        <div className="lg:sticky lg:top-6 space-y-3">
          <div className="relative mx-auto w-full max-w-[20rem] aspect-[9/16] overflow-hidden rounded-lg border border-rule bg-black" style={{ containerType: 'inline-size' }}>
            <video
              ref={video}
              key={(clean ? data.clip.preview_url : finalUrl) ?? ''}
              src={(clean ? data.clip.preview_url : finalUrl) ?? undefined}
              controls
              playsInline
              preload="metadata"
              onTimeUpdate={e => setPlayhead(rendered[0] + e.currentTarget.currentTime)}
              className="absolute inset-0 size-full"
              style={edit.enhance.video && clean ? { filter: 'contrast(1.05) saturate(1.1)' } : undefined}
            />
            {vignetteChanged && <VignettePreview vignette={edit.vignette} />}
            {marksChanged && <MarksPreview marks={edit.marks} logoUrl={logo?.url} />}
            {clean && <HookShade hook={edit.hook} time={hookSettled ? Infinity : clipTime} end={hookSettled ? Infinity : hookEnd} clipEnd={edit.end - edit.start} />}
            {clean && options.caption_enabled && transcript && (
              <LiveCaption
                segments={transcript}
                style={options.caption_style}
                time={playhead ?? rendered[0]}
                range={[edit.start, edit.end]}
                onMove={position_y => setOptions({ ...options, caption_style: { ...options.caption_style, position_y } })}
                onPick={pickSegment}
              />
            )}
            {clean && <HookOverlay hook={edit.hook} time={hookSettled ? Infinity : clipTime} end={hookSettled ? Infinity : hookEnd} onMove={position_y => setHook({ position_y })} onTap={focusHook} />}
          </div>
          <p className="text-xs text-ink-faint text-center max-w-[20rem] mx-auto">
            {clean
              ? 'Geser caption atau hook untuk memindahkannya. Klik caption untuk mengedit teksnya.'
              : 'Klip ini dibuat sebelum ada pratinjau, jadi caption baru terlihat setelah dirender.'}
          </p>
        </div>

        {/* Pengaturan */}
        <div className="min-w-0">
          <AutoEditBanner
            applied={autoApplied}
            summary={data.auto_summary}
            disabled={rendering}
            onApply={applyAuto}
            onClear={clearEffects}
          />
          <div role="tablist" aria-label="Bagian editor" className="sticky top-0 z-10 -mx-1 mt-4 flex gap-1 overflow-x-auto bg-bay/90 px-1 py-2 backdrop-blur-md">
            {TABS.map(t => (
              <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`h-9 shrink-0 rounded-md px-3.5 text-sm ${tab === t.id ? 'bg-raised text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <fieldset disabled={rendering} className="min-w-0 border-b border-rule">
            <div role="tabpanel" id="panel-teks" aria-labelledby="tab-teks" hidden={tab !== 'teks'} className="divide-y divide-rule">
          <Section title="Hook" hint="Kalimat pembuka besar di awal video agar penonton berhenti scroll.">
            <Toggle label="Tampilkan hook" checked={edit.hook.enabled}
              onChange={v => setHook({ enabled: v, ...(v && !edit.hook.text && data.hook_suggestions[0] ? { text: data.hook_suggestions[0] } : {}) })} />
            {edit.hook.enabled && (
              <div className="mt-4 space-y-4 text-sm">
                <textarea
                  id="hook-text"
                  rows={2}
                  maxLength={120}
                  value={edit.hook.text}
                  placeholder="Tulis kalimat pembuka yang bikin penasaran"
                  aria-label="Teks hook"
                  onFocus={() => setHookFocus(true)}
                  onBlur={() => setHookFocus(false)}
                  onChange={e => setHook({ text: e.target.value })}
                  className="field-sizing-content min-h-16 w-full resize-none rounded-md border border-rule bg-bay px-3 py-2 text-ink focus:border-signal focus:outline-none"
                />
                <p className="-mt-2 text-xs text-ink-muted">
                  Pendek lebih kuat: 3–6 kata yang bikin penasaran tanpa membocorkan akhirnya.
                  {' '}<span className={hookWords > 8 ? 'text-signal' : ''}>{hookWords} kata.</span>
                  {' '}Apit kata dengan bintang, mis. <span className="font-mono text-ink">*selalu kalah*</span>, agar diberi warna aksen.
                </p>
                <Row label="Label">
                  <input
                    value={edit.hook.label}
                    maxLength={24}
                    placeholder="POV, FAKTA, PART 2…"
                    aria-label="Label kecil di atas hook"
                    onFocus={() => setHookFocus(true)}
                    onBlur={() => setHookFocus(false)}
                    onChange={e => setHook({ label: e.target.value })}
                    className="h-8 w-40 rounded-md border border-rule bg-bay px-2 text-ink focus:border-signal focus:outline-none"
                  />
                </Row>
                {data.hook_suggestions.length > 0 && (
                  <div>
                    <p className="text-xs text-ink-muted">Ide dari analisis momen ini:</p>
                    <ul className="mt-1.5 space-y-1">
                      {data.hook_suggestions.map(idea => (
                        <li key={idea}>
                          <button type="button" onClick={() => setHook({ text: idea })}
                            className="w-full rounded-md border border-rule px-2.5 py-1.5 text-left text-xs text-ink-muted hover:bg-raised hover:text-ink">
                            {idea}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Row label="Tampil">
                  <div role="radiogroup" aria-label="Lama hook tampil" className="grid grid-cols-4 rounded-md border border-rule p-0.5 text-xs">
                    {HOOK_DURATIONS.map(d => (
                      <button key={d} type="button" role="radio" aria-checked={edit.hook.duration === d} onClick={() => setHook({ duration: d })}
                        className={`h-7 px-2 rounded-[5px] whitespace-nowrap ${edit.hook.duration === d ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}>
                        {d === 0 ? 'Terus' : `${d} dtk`}
                      </button>
                    ))}
                  </div>
                </Row>
                <Range label="Bayangan bawah" value={edit.hook.shade} min={0} max={100} step={5}
                  onChange={v => setHook({ shade: v })} format={v => (v === 0 ? 'mati' : `${v}%`)} />
                <div>
                  <p className="text-ink-muted">Gaya</p>
                  <div role="radiogroup" aria-label="Gaya hook" className="mt-1.5 grid grid-cols-3 gap-y-0.5 rounded-md border border-rule p-0.5 text-xs">
                    {HOOK_STYLE_OPTIONS.map(h => (
                      <button key={h.id} type="button" role="radio" aria-checked={edit.hook.style === h.id} onClick={() => setHook({ style: h.id })}
                        className={`h-7 px-2 rounded-[5px] whitespace-nowrap ${edit.hook.style === h.id ? 'bg-raised text-ink' : h.classic ? 'text-ink-faint hover:text-ink' : 'text-ink-muted hover:text-ink'}`}>
                        {h.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">Baris kedua: gaya klasik.</p>
                </div>
                <Row label="Aksen">
                  <div role="radiogroup" aria-label="Warna aksen hook" className="flex gap-1.5">
                    {(Object.keys(HOOK_ACCENTS) as HookAccent[]).map(a => (
                      <button key={a} type="button" role="radio" aria-checked={edit.hook.accent === a} aria-label={a}
                        onClick={() => setHook({ accent: a })}
                        className={`size-7 rounded-full border-2 ${edit.hook.accent === a ? 'border-ink' : 'border-transparent'}`}
                        style={{ background: HOOK_ACCENTS[a], boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.25)' }} />
                    ))}
                  </div>
                </Row>
                <Row label="Animasi">
                  <div role="radiogroup" aria-label="Animasi hook" className="grid grid-cols-5 rounded-md border border-rule p-0.5 text-xs">
                    {HOOK_ANIM_OPTIONS.map(a => (
                      <button key={a.id} type="button" role="radio" aria-checked={edit.hook.anim === a.id}
                        onClick={() => { setHook({ anim: a.id }); seek(edit.start) }}
                        className={`h-7 px-2 rounded-[5px] whitespace-nowrap ${edit.hook.anim === a.id ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label="Font">
                  <select
                    className="rounded-md border border-rule bg-bay px-2 h-8 text-ink max-w-[10rem]"
                    value={edit.hook.font}
                    onChange={e => setHook({ font: e.target.value as CaptionFont })}
                  >
                    {CAPTION_FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </Row>
                <Range label="Ukuran" value={edit.hook.size} min={40} max={130} step={2} onChange={v => setHook({ size: v })} />
                <Range label="Posisi" value={edit.hook.position_y} min={5} max={80}
                  onChange={v => setHook({ position_y: v })} format={v => (v < 30 ? 'atas' : v > 55 ? 'bawah' : 'tengah')} />
              </div>
            )}
          </Section>

          <Section title="Caption">
            <Toggle label="Caption otomatis" checked={options.caption_enabled} onChange={v => setOptions({ ...options, caption_enabled: v })} />
            {options.caption_enabled && (
              <div className="mt-4 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Teks</h3>
                  <div className="mt-2">
                    {transcript ? (
                      <TranscriptEditor
                        segments={transcript}
                        range={[edit.start, edit.end]}
                        playhead={playhead}
                        onSeek={seek}
                        onChange={segs => { setTranscript(segs); setTranscriptDirty(true) }}
                      />
                    ) : (
                      <p className="text-sm text-ink-muted">
                        Klip ini dibuat sebelum teks caption disimpan. Render ulang sekali, setelah itu teksnya bisa diedit di sini.
                      </p>
                    )}
                  </div>
                  {transcript && (edit.start < data.transcript!.range[0] - 0.05 || edit.end > data.transcript!.range[1] + 0.05) && (
                    <p className="mt-2 text-xs text-ink-faint">Teks untuk bagian yang diperpanjang dibuat otomatis saat render.</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">Gaya</h3>
                  <div className="mt-2">
                    <CaptionStyleEditor
                      value={options.caption_style}
                      onChange={caption_style => setOptions({ ...options, caption_style })}
                      sampleWords={sampleWords}
                      backgroundUrl={ytThumb}
                    />
                  </div>
                </div>
              </div>
            )}
          </Section>

            </div>
            <div role="tabpanel" id="panel-audio" aria-labelledby="tab-audio" hidden={tab !== 'audio'} className="divide-y divide-rule">
          <Section title="Suara" hint="Suara pembicara sudah diratakan otomatis (yang pelan dikeraskan, yang keras dipelankan).">
            <div className="space-y-4 text-sm">
              <Range label="Volume suara" value={edit.voice.volume} min={0} max={200} step={5}
                onChange={v => setEdit({ ...edit, voice: { ...edit.voice, volume: v } })} format={v => (v === 100 ? 'normal' : `${v}%`)} />
              <Toggle label="Suara lebih jernih (kurangi dengung & desis, perjelas vokal)" checked={edit.voice.clean}
                onChange={v => setEdit({ ...edit, voice: { ...edit.voice, clean: v } })} />
            </div>
          </Section>

          <Section title="Musik latar" hint="Otomatis dipelankan saat ada yang bicara, jadi suara tetap jelas.">
            <MusicPanel music={edit.music} library={data.music_library} assets={data.assets}
              onChange={setMusic} onAssetsChange={setAssets} />
            {edit.music.asset && (
              <div className="mt-4 space-y-4 text-sm">
                <Range label="Volume musik" value={edit.music.volume} min={0} max={100} step={1}
                  onChange={v => setMusic({ volume: v })} format={v => `${v}%`} />
                <Toggle label="Pelankan musik saat ada yang bicara" checked={edit.music.ducking} onChange={v => setMusic({ ducking: v })} />
              </div>
            )}
          </Section>

          <Section title="Efek suara" hint="Tambahkan bunyi di momen tertentu, misalnya pop saat punchline atau whoosh saat ganti topik.">
            <SfxPanel
              sfx={edit.sfx}
              library={data.sfx_library}
              assets={data.assets}
              range={[edit.start, edit.end]}
              playhead={playhead}
              onChange={sfx => setEdit({ ...edit, sfx })}
              onAssetsChange={setAssets}
              onSeek={seek}
            />
          </Section>

            </div>
            <div role="tabpanel" id="panel-visual" aria-labelledby="tab-visual" hidden={tab !== 'visual'} className="divide-y divide-rule">
          <Section title="Kualitas video" hint="Kurangi noise, warna & kontras sedikit naik, dan penajaman. Paling terasa untuk video sumber yang buram.">
            <Toggle label="Video lebih jernih & tajam (HD)" checked={edit.enhance.video}
              onChange={v => setEdit({ ...edit, enhance: { video: v } })} />
          </Section>

          <Section title="Vignette" hint="Bayangan gelap di tepi video agar caption dan wajah lebih menonjol.">
            <div className="space-y-4 text-sm">
              <div role="radiogroup" aria-label="Bentuk vignette" className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-md border border-rule p-0.5 max-w-md">
                {VIGNETTE_SHAPES.map(v => (
                  <button key={v.id} type="button" role="radio" aria-checked={edit.vignette.shape === v.id}
                    onClick={() => setVignette({ shape: v.id, strength: edit.vignette.strength || 60 })}
                    className={`h-8 rounded-[5px] ${edit.vignette.shape === v.id ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}>
                    {v.label}
                  </button>
                ))}
              </div>
              <Range label="Kekuatan" value={edit.vignette.strength} min={0} max={100} step={5}
                onChange={v => setVignette({ strength: v })} format={v => (v === 0 ? 'mati' : `${v}%`)} />
              {edit.vignette.shape !== 'radial' && edit.vignette.strength > 0 && (
                <Range label="Tinggi bayangan" value={edit.vignette.height} min={10} max={100} step={5}
                  onChange={v => setVignette({ height: v })} format={v => `${v}% layar`} />
              )}
            </div>
          </Section>

          <Section title="Watermark" hint="Bisa dipakai bersamaan. Yang posisinya sama otomatis ditumpuk rapi.">
            <div className="space-y-3">
              {MARKS.map(({ kind, title, hint }) => {
                const mark = edit.marks[kind]
                return (
                  <div key={kind} className={`rounded-md border border-rule p-3 ${mark.enabled ? 'bg-panel' : ''}`}>
                    <label className="flex items-center justify-between gap-3">
                      <span>
                        <span className="block text-sm font-semibold text-ink">{title}</span>
                        <span className="block text-xs text-ink-muted">{hint}</span>
                      </span>
                      <input type="checkbox" className="size-4 accent-signal" checked={mark.enabled}
                        onChange={e => setMark(kind, {
                          enabled: e.target.checked,
                          ...(kind === 'source' && e.target.checked && !mark.text ? { text: sourceDefault } : {}),
                        })} />
                    </label>
                    {mark.enabled && (
                      <div className="mt-4 space-y-4 text-sm">
                        {kind === 'logo' ? (
                          <AssetPicker kind="image" assets={data.assets} value={mark.asset ?? ''}
                            onChange={asset => setMark('logo', { asset })} onAssetsChange={setAssets} />
                        ) : (
                          <input
                            value={mark.text ?? ''}
                            maxLength={60}
                            aria-label={title}
                            placeholder={kind === 'account' ? '@akunmu' : sourceDefault}
                            onChange={e => setMark(kind, { text: e.target.value })}
                            className="w-full rounded-md border border-rule bg-bay px-3 h-9 text-ink focus:border-signal focus:outline-none"
                          />
                        )}
                        <Row label="Posisi">
                          <div role="radiogroup" aria-label={`Posisi ${title.toLowerCase()}`} className="grid grid-cols-3 grid-rows-[1.5rem_1.25rem_1.5rem] gap-1 rounded-md border border-rule p-1 w-24">
                            {POSITIONS.map(p => (
                              <button key={p.id} type="button" role="radio" aria-checked={mark.position === p.id} aria-label={p.label}
                                title={p.label} onClick={() => setMark(kind, { position: p.id })}
                                className={`rounded-sm ${p.id === 'bl' ? 'row-start-3 col-start-1' : p.id === 'br' ? 'row-start-3 col-start-3' : ''} ${
                                  mark.position === p.id ? 'bg-signal' : 'bg-raised hover:bg-ink-faint'}`} />
                            ))}
                          </div>
                        </Row>
                        <Range label="Ukuran" value={mark.size} min={5} max={40} onChange={v => setMark(kind, { size: v })} />
                        <Range label="Kepekatan" value={mark.opacity} min={10} max={100} step={5}
                          onChange={v => setMark(kind, { opacity: v })} format={v => `${v}%`} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

            </div>
            <div role="tabpanel" id="panel-thumbnail" aria-labelledby="tab-thumbnail" hidden={tab !== 'thumbnail'} className="divide-y divide-rule">
          <Section title="Thumbnail" hint="Gambar cover 9:16 untuk Shorts, TikTok & Reels: wajah yang jelas dan teks besar.">
            <ThumbnailPanel videoId={videoId} clipKey={clipKey} initial={data.thumbnail} suggestion={data.thumbnail_suggestion}
              hook={edit.hook} playhead={playhead} autoCreate={data.source_ready && data.clean_preview} />
          </Section>
            </div>
            <div role="tabpanel" id="panel-ekspor" aria-labelledby="tab-ekspor" hidden={tab !== 'ekspor'} className="divide-y divide-rule">
          <Section title="Potong" hint="Geser pegangan untuk memajukan awal atau memperpanjang akhir klip, hingga 30 detik di luar momen.">
            <TrimBar
              start={edit.start}
              end={edit.end}
              min={bounds[0]}
              max={bounds[1]}
              rendered={rendered}
              moment={data.moment}
              markers={edit.sfx.map(s => s.at)}
              playhead={playhead}
              onChange={(start, end) => setEdit({ ...edit, start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10 })}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm btn-quiet" disabled={playhead === null}
                onClick={() => playhead !== null && playhead < edit.end - 3 && setEdit({ ...edit, start: Math.round(playhead * 10) / 10 })}>
                Mulai dari posisi video
              </button>
              <button type="button" className="btn btn-sm btn-quiet" disabled={playhead === null}
                onClick={() => playhead !== null && playhead > edit.start + 3 && setEdit({ ...edit, end: Math.round(playhead * 10) / 10 })}>
                Akhiri di posisi video
              </button>
            </div>
          </Section>

          <Section title="Format edit" hint="Pakai gaya yang pernah kamu simpan: caption, hook, watermark, vignette, musik & resolusi. Teks hook dan efek suara tetap milik klip ini.">
            <TemplatePanel templates={data.templates ?? []} appliedId={appliedTemplate}
              onApply={applyTemplate} onSave={storeTemplate} onDelete={removeTemplate} />
          </Section>
          <Section title="Render">
            <div className="space-y-3 text-sm">
              <Row label="Resolusi">
                <div role="radiogroup" aria-label="Resolusi" className="grid grid-cols-3 rounded-md border border-rule p-0.5 text-xs">
                  {RESOLUTIONS.map(r => (
                    <button key={r.id} type="button" role="radio" aria-checked={options.resolution === r.id} onClick={() => setOptions({ ...options, resolution: r.id })}
                      className={`h-7 px-3 rounded-[5px] whitespace-nowrap ${options.resolution === r.id ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </Row>
              <p className="text-xs text-ink-muted">
                {RESOLUTIONS.find(r => r.id === options.resolution)?.hint}
              </p>
              <Toggle label="Ikuti pembicara" checked={options.smart_tracking} onChange={v => setOptions({ ...options, smart_tracking: v })} />
              {options.smart_tracking && (
                <Toggle label="Layar terbagi saat dua orang bergantian bicara" checked={options.split_screen} onChange={v => setOptions({ ...options, split_screen: v })} />
              )}
            </div>
          </Section>
            </div>
          </fieldset>
        </div>
      </div>

      {/* Bilah aksi */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-bay/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 sm:px-6 h-16">
          <div className="min-w-0 flex-1 text-sm">
            {rendering && jobSegment ? (
              <span className="flex items-center gap-2 text-ink">
                <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                <span className="truncate">{STATUS_LABEL[jobSegment.status] ?? 'Merender'}… {Math.round(jobSegment.progress)}%</span>
              </span>
            ) : failed ? (
              <span className="flex items-center gap-2 text-tally">
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{jobSegment?.message || job?.message || 'Render gagal.'}</span>
              </span>
            ) : !data.source_ready ? (
              <span className="text-ink-muted">Video sumber tidak ada. Upload ulang videonya di halaman video.</span>
            ) : outOfQuota && (dirty || !finalUrl) ? (
              <span className="text-ink-muted">Jatah render final hari ini sudah habis. Coba lagi besok.</span>
            ) : (
              <span className="text-ink-muted">
                {!finalUrl ? 'Render final untuk membuat klip yang bisa diunduh.'
                  : dirty ? 'Ada perubahan. Render ulang agar ikut terunduh.' : 'Klip final sudah sesuai editan.'}
                {data.final_left !== null && (dirty || !finalUrl) && ` Sisa render final hari ini: ${data.final_left}.`}
              </span>
            )}
          </div>
          {dirty && !rendering && (
            <button type="button" onClick={reset} className="btn btn-quiet hidden sm:inline-flex">
              <RotateCcw className="size-4" aria-hidden /> Batalkan
            </button>
          )}
          {canDownload ? (
            <a href={downloadUrl(finalUrl)} download className="btn btn-primary">
              <Download className="size-4" aria-hidden /> Unduh
            </a>
          ) : (
            <button type="button" onClick={submit} disabled={rendering || !data.source_ready || outOfQuota || (!!finalUrl && !dirty)}
              className="btn btn-primary">
              <Wand2 className="size-4" aria-hidden /> {finalUrl ? 'Render ulang' : 'Render final'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const MOOD_LABEL: Record<string, string> = {
  santai: 'santai', semangat: 'semangat', tegang: 'tegang', lucu: 'lucu', dramatis: 'dramatis',
}

/** Ringkasan edit otomatis + tombol terapkan ulang / kosongkan efek. */
function AutoEditBanner({ applied, summary, disabled, onApply, onClear }: {
  applied: boolean
  summary: EditorData['auto_summary']
  disabled: boolean
  onApply: () => void
  onClear: () => void
}) {
  const parts = [
    summary.hook && `hook “${summary.hook.replaceAll('*', '')}”`,
    `musik ${summary.music}`,
    `${summary.sfx} efek suara`,
    'suara jernih',
    'video HD',
  ].filter(Boolean)
  return (
    <section aria-label="Edit otomatis" className={`rounded-lg border px-4 py-3 text-sm ${applied ? 'border-signal/50 bg-signal/5' : 'border-rule bg-bay/40'}`}>
      <p className="flex items-center gap-2 font-semibold text-ink">
        <Sparkles className="size-4 text-signal" aria-hidden /> {applied ? 'Sudah diedit otomatis' : 'Edit otomatis'}
      </p>
      <p className="mt-1 text-ink-muted">
        {applied ? 'Diterapkan: ' : `Suasana ${MOOD_LABEL[summary.mood] ?? summary.mood}: `}{parts.join(', ')}.
        {applied ? ' Sesuaikan apa pun di tab di bawah, lalu render.' : ''}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={onApply} disabled={disabled} className={`btn btn-sm ${applied ? 'btn-quiet' : 'btn-primary'}`}>
          <Wand2 className="size-3.5" aria-hidden /> {applied ? 'Edit otomatis ulang' : 'Terapkan edit otomatis'}
        </button>
        {applied && <button type="button" onClick={onClear} disabled={disabled} className="btn btn-sm btn-quiet">Hapus semua efek</button>}
      </div>
    </section>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="py-6">
      <h2 className="type-heading text-lg text-ink">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink-muted max-w-[60ch]">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
