'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Download, Loader2, RotateCcw, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import CaptionStyleEditor, { Range, Row, Toggle } from '@/components/CaptionStyleEditor'
import AssetPicker from '@/components/editor/AssetPicker'
import { MarksPreview, VignettePreview } from '@/components/editor/EffectPreview'
import { HookOverlay, LiveCaption } from '@/components/editor/LiveOverlays'
import SfxPanel from '@/components/editor/SfxPanel'
import TranscriptEditor from '@/components/editor/TranscriptEditor'
import TrimBar from '@/components/editor/TrimBar'
import { downloadUrl, getEditor, getJob, renderEdit, RENDER_STARTED_EVENT } from '@/lib/api'
import { CAPTION_FONTS, CaptionFont, saveCaptionStyle } from '@/lib/caption-presets'
import type {
  EditRecipe, EditorData, HookSettings, HookStyle, MarkKind, RenderJob, RenderOptions, TranscriptSegment, VignetteShape, WatermarkMark,
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
const HOOK_STYLES: { id: HookStyle; label: string }[] = [
  { id: 'light', label: 'Kotak putih' }, { id: 'dark', label: 'Kotak gelap' }, { id: 'outline', label: 'Garis tepi' },
]
const HOOK_DURATIONS = [3, 5, 8, 0]
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
  const video = useRef<HTMLVideoElement>(null)

  const load = useCallback(() => {
    return getEditor(videoId, clipKey).then(d => {
      setData(d)
      setEdit(d.edit)
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
  const hookVisible = hookFocus || (clipTime >= 0 && (edit.hook.duration <= 0 || clipTime < edit.hook.duration))
  const finalUrl = data.clip.url
  const canDownload = !!finalUrl && !dirty && !rendering
  const outOfQuota = data.final_left === 0
  const logo = data.assets.find(a => a.name === edit.marks.logo.asset)
  const sourceDefault = data.channel ? `Sumber: ${data.channel} (YouTube)` : 'Sumber: YouTube'
  const music = data.assets.find(a => a.name === edit.music.asset)
  const ytThumb = /^[\w-]{11}$/.test(videoId) ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined

  return (
    <div className="pt-8 pb-28">
      <Link href={`/video/${videoId}/klip`} className="text-sm text-ink-muted underline underline-offset-4 decoration-rule hover:text-ink">
        Kembali ke klip tersimpan
      </Link>
      <h1 className="mt-3 type-display text-3xl sm:text-4xl text-ink">Edit klip</h1>
      <p className="mt-2 max-w-[68ch] text-ink-muted">{data.clip.topic || data.title}</p>

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
            />
            {vignetteChanged && <VignettePreview vignette={edit.vignette} />}
            {marksChanged && <MarksPreview marks={edit.marks} logoUrl={logo?.url} />}
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
            {clean && <HookOverlay hook={edit.hook} visible={hookVisible} onMove={position_y => setHook({ position_y })} onTap={focusHook} />}
          </div>
          <p className="text-xs text-ink-faint text-center max-w-[20rem] mx-auto">
            {clean
              ? 'Geser caption atau hook untuk memindahkannya. Klik caption untuk mengedit teksnya.'
              : 'Klip ini dibuat sebelum ada pratinjau, jadi caption baru terlihat setelah dirender.'}
          </p>
        </div>

        {/* Pengaturan */}
        <fieldset disabled={rendering} className="min-w-0 divide-y divide-rule border-y border-rule">
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
                <Row label="Gaya">
                  <div role="radiogroup" aria-label="Gaya hook" className="grid grid-cols-3 rounded-md border border-rule p-0.5 text-xs">
                    {HOOK_STYLES.map(h => (
                      <button key={h.id} type="button" role="radio" aria-checked={edit.hook.style === h.id} onClick={() => setHook({ style: h.id })}
                        className={`h-7 px-2 rounded-[5px] whitespace-nowrap ${edit.hook.style === h.id ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}>
                        {h.label}
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

          <Section title="Musik latar">
            <div className="space-y-4 text-sm">
              <AssetPicker kind="audio" assets={data.assets} value={edit.music.asset}
                onChange={asset => setMusic({ asset })} onAssetsChange={setAssets} />
              {music && (
                <>
                  <audio src={music.url} controls preload="none" className="w-full h-9" aria-label={`Dengarkan ${music.label}`} />
                  <Range label="Volume musik" value={edit.music.volume} min={0} max={100} step={5}
                    onChange={v => setMusic({ volume: v })} format={v => `${v}%`} />
                  <Toggle label="Pelankan musik saat ada yang bicara" checked={edit.music.ducking} onChange={v => setMusic({ ducking: v })} />
                  <button type="button" className="text-xs text-ink-muted underline underline-offset-4 decoration-rule hover:text-ink" onClick={() => setMusic({ asset: '' })}>
                    Tanpa musik
                  </button>
                </>
              )}
            </div>
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

          <Section title="Render">
            <div className="space-y-3 text-sm">
              <Row label="Resolusi">
                <div role="radiogroup" aria-label="Resolusi" className="grid grid-cols-2 rounded-md border border-rule p-0.5 text-xs">
                  {(['1080', '720'] as const).map(r => (
                    <button key={r} type="button" role="radio" aria-checked={options.resolution === r} onClick={() => setOptions({ ...options, resolution: r })}
                      className={`h-7 px-3 rounded-[5px] ${options.resolution === r ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}>
                      {r}p
                    </button>
                  ))}
                </div>
              </Row>
              <Toggle label="Ikuti pembicara" checked={options.smart_tracking} onChange={v => setOptions({ ...options, smart_tracking: v })} />
              {options.smart_tracking && (
                <Toggle label="Layar terbagi saat dua orang bergantian bicara" checked={options.split_screen} onChange={v => setOptions({ ...options, split_screen: v })} />
              )}
            </div>
          </Section>
        </fieldset>
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

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="py-6">
      <h2 className="type-heading text-lg text-ink">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink-muted max-w-[60ch]">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
