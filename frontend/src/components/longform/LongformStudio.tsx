'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AudioLines, Check, Copy, Download, FileText, Film, Image as ImageIcon, Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import SceneCard from '@/components/longform/SceneCard'
import ThumbnailPanel from '@/components/longform/ThumbnailPanel'
import { useAuth } from '@/components/AuthProvider'
import {
  autoLongformVisuals, createLongformScript, deleteLongformAudio, downloadUrl, getJob, getJobs, getLongform, isJobActive,
  longformTts, RENDER_STARTED_EVENT, renderLongform, saveLongform, uploadLongformRecording,
} from '@/lib/api'
import { formatClock, formatSpan } from '@/lib/clip-meta'
import { chapterCount, newSceneId, sceneSeconds, STOCK_NAMES } from '@/lib/longform'
import type { LongformData, LongformProject, LongformScene, RenderJob } from '@/lib/types'

type Busy = 'script' | 'save' | 'tts-all' | 'visuals' | 'render' | null

const POLL_MS = 2000
const TTS_PARALLEL = 2


function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button type="button" className="btn btn-sm btn-quiet" onClick={() => {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
        .catch(() => toast.error('Gagal menyalin.'))
    }}>
      {copied ? <Check className="size-3.5 text-teal" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {label}
    </button>
  )
}

/** Studio video panjang tanpa wajah (khusus admin): naskah → suara → visual → render. */
export default function LongformStudio({ videoId }: { videoId: string }) {
  const { me } = useAuth()
  if (me && !me.is_admin) {
    return <p role="alert" className="pt-16 border-l-2 border-tally pl-4 text-sm text-ink-muted">Fitur video panjang khusus admin.</p>
  }
  return <Studio videoId={videoId} />
}

function Studio({ videoId }: { videoId: string }) {
  const { refreshMe } = useAuth()
  const [data, setData] = useState<LongformData | null>(null)
  const [draft, setDraft] = useState<LongformProject | null>(null)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [working, setWorking] = useState<Set<string>>(new Set())
  const [ttsProgress, setTtsProgress] = useState<{ done: number; total: number } | null>(null)
  const [job, setJob] = useState<RenderJob | null>(null)
  const [minutes, setMinutes] = useState(8)
  const [focus, setFocus] = useState('')
  // Nama channel (disebut di pembuka & penutup naskah); null = belum dimuat dari brand tersimpan
  const [channel, setChannel] = useState<string | null>(null)
  const draftRef = useRef(draft)
  useEffect(() => { draftRef.current = draft }, [draft])
  const dirtyRef = useRef(dirty)
  useEffect(() => { dirtyRef.current = dirty }, [dirty])

  /** Data baru dari server menggantikan draf (dipakai setelah simpan / operasi yang mengubah seluruh proyek) */
  const apply = useCallback((next: LongformData) => {
    setData(next)
    setDraft(next.project)
    setDirty(false)
  }, [])

  /** Hasil operasi suara satu adegan: hanya audio yang diambil dari server, editan lain di draf tetap */
  const mergeAudio = useCallback((next: LongformData) => {
    setData(next)
    const server = new Map((next.project?.scenes ?? []).map(s => [s.id, s]))
    setDraft(prev => prev && {
      ...prev,
      output: next.project?.output ?? prev.output,
      scenes: prev.scenes.map(s => {
        const fresh = server.get(s.id)
        if (!fresh) return s
        const changed = fresh.text !== s.text && fresh.audio?.source === 'tts'
        return { ...s, audio: fresh.audio, audio_state: changed ? 'stale' : fresh.audio_state }
      }),
    })
  }, [])

  const load = useCallback(() => {
    getLongform(videoId).then(next => {
      apply(next)
      setChannel(prev => prev ?? next.brand.channel)
    }).catch(e => setError(e instanceof Error ? e.message : 'Gagal memuat.'))
  }, [videoId, apply])
  useEffect(load, [load])

  // Render yang masih berjalan (mis. halaman dimuat ulang)
  useEffect(() => {
    getJobs(videoId).then(list => {
      const running = list.find(j => j.mode === 'longform' && isJobActive(j))
      if (running) setJob(running)
    }).catch(() => {})
  }, [videoId])

  const jobId = job?.id
  const jobActive = job ? isJobActive(job) : false
  useEffect(() => {
    if (!jobId || !jobActive) return
    const timer = setInterval(() => {
      getJob(jobId).then(next => {
        setJob(next)
        if (!isJobActive(next)) {
          if (next.status === 'error') toast.error(next.message || 'Render gagal.')
          load()
          refreshMe()
        }
      }).catch(() => {})
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [jobId, jobActive, load, refreshMe])

  // Editan belum tersimpan → peringatkan sebelum meninggalkan halaman
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const edit = (fn: (p: LongformProject) => LongformProject) => {
    setDraft(prev => prev && fn(prev))
    setDirty(true)
  }
  const editScene = (id: string, patch: Partial<LongformScene>) =>
    edit(p => ({ ...p, scenes: p.scenes.map(s => (s.id === id ? { ...s, ...patch } : s)) }))

  const save = useCallback(async (): Promise<boolean> => {
    const current = draftRef.current
    if (!current || !dirtyRef.current) return true
    try {
      apply(await saveLongform(videoId, current))
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Naskah gagal disimpan.')
      return false
    }
  }, [videoId, apply])

  const run = async (kind: Busy, fn: () => Promise<void>) => {
    setBusy(kind)
    try {
      await fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setBusy(null)
    }
  }

  const createScript = (replace: boolean) => {
    if (replace && !confirm('Buat ulang naskah? Naskah, suara, dan visual yang sekarang akan diganti.')) return
    run('script', async () => {
      apply(await createLongformScript(videoId, minutes, focus, channel ?? ''))
      toast.success('Naskah siap. Periksa dan edit sebelum membuat suara.')
    })
  }

  const sceneOp = async (id: string, op: () => Promise<LongformData>) => {
    if (!(await save())) return
    setWorking(prev => new Set(prev).add(id))
    try {
      mergeAudio(await op())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Suara gagal diproses.')
    } finally {
      setWorking(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  const ttsAll = () => run('tts-all', async () => {
    if (!(await save())) return
    const queue = (draftRef.current?.scenes ?? []).filter(s => s.kind === 'narration' && s.audio_state !== 'ready').map(s => s.id)
    if (!queue.length) {
      toast.info('Semua adegan sudah punya suara.')
      return
    }
    let done = 0
    let failed = 0
    setTtsProgress({ done, total: queue.length })
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        setWorking(prev => new Set(prev).add(id!))
        try {
          mergeAudio(await longformTts(videoId, id))
        } catch (e) {
          failed++
          if (failed === 1) toast.error(e instanceof Error ? e.message : 'Suara gagal dibuat.')
        } finally {
          setWorking(prev => { const next = new Set(prev); next.delete(id!); return next })
          setTtsProgress({ done: ++done, total: done + queue.length })
        }
      }
    }
    await Promise.all(Array.from({ length: TTS_PARALLEL }, worker))
    setTtsProgress(null)
    if (!failed) toast.success('Semua suara selesai dibuat.')
  })

  const autoVisuals = () => run('visuals', async () => {
    if (!(await save())) return
    apply(await autoLongformVisuals(videoId))
  })

  const startRender = () => run('render', async () => {
    if (!(await save())) return
    setJob(await renderLongform(videoId))
    window.dispatchEvent(new Event(RENDER_STARTED_EVENT))
  })

  if (error) return <p role="alert" className="pt-16 border-l-2 border-tally pl-4 text-sm text-ink-muted">{error}</p>
  if (!data) return <p className="pt-16 flex items-center gap-2 text-ink-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Memuat…</p>

  const fromTopic = data.kind === 'topic'
  const header = (
    <>
      <Link href={fromTopic ? '/longform' : `/video/${videoId}`} className="text-sm text-ink-muted underline underline-offset-4 decoration-rule hover:text-ink">
        {fromTopic ? 'Kembali ke daftar video panjang' : 'Kembali ke momen video'}
      </Link>
      <h1 className="mt-3 type-display text-4xl text-ink">Video panjang</h1>
      <p className="mt-2 max-w-[68ch] text-ink-muted">
        {fromTopic
          ? `Video 16:9 tanpa wajah tentang "${draft?.topic || ''}", ditulis dari berita sumber di bawah.`
          : 'Video 16:9 tanpa wajah dari podcast ini: narasi rangkuman, video stok, dan kutipan asli narasumber, lengkap dengan bab.'}
      </p>
    </>
  )

  if (!draft) {
    return (
      <div className="pt-10 max-w-2xl">
        {header}
        <section className="mt-8 rounded-lg border border-rule glass p-5">
          <h2 className="font-semibold text-ink">Buat naskah</h2>
          <div className="mt-4">
            <p className="text-sm text-ink-muted">Durasi video</p>
            <div role="radiogroup" aria-label="Durasi video" className="mt-1 inline-grid grid-cols-3 rounded-md border border-rule p-0.5 text-sm">
              {data.durations.map(m => (
                <button key={m} type="button" role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)}
                  className={`h-8 px-4 rounded-[5px] ${minutes === m ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}>
                  ±{m} menit
                </button>
              ))}
            </div>
          </div>
          <label className="mt-4 block text-sm">
            <span className="text-ink-muted">Nama channel</span>
            <input value={channel ?? ''} maxLength={40} onChange={e => setChannel(e.target.value)} placeholder="Mis. Klik Digital"
              className="mt-1 h-10 w-full rounded-md border border-rule bg-bay px-3 text-ink focus:border-signal focus:outline-none" />
            <span className="mt-1 block text-xs text-ink-faint">Disebut di sapaan pembuka dan salam penutup. Diingat untuk video berikutnya.</span>
          </label>
          <label className="mt-4 block text-sm">
            <span className="text-ink-muted">Fokus atau sudut pandang (opsional)</span>
            <input value={focus} maxLength={200} onChange={e => setFocus(e.target.value)}
              placeholder="Mis. pelajaran investasi & mental menghadapi uang"
              className="mt-1 h-10 w-full rounded-md border border-rule bg-bay px-3 text-ink focus:border-signal focus:outline-none" />
          </label>
          <button type="button" onClick={() => createScript(false)} disabled={busy === 'script'} className="btn btn-primary mt-5">
            {busy === 'script' ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Menulis naskah… (±30–60 dtk)</> : <><Wand2 className="size-4" aria-hidden /> Buat naskah</>}
          </button>
          <p className="mt-2 text-xs text-ink-faint">Memakai kuota Gemini. Naskah bisa diedit sebelum suara dibuat.</p>
        </section>
      </div>
    )
  }

  const scenes = draft.scenes
  const narration = scenes.filter(s => s.kind === 'narration')
  const quotes = scenes.length - narration.length
  const missingAudio = narration.filter(s => s.audio_state !== 'ready').length
  const noVisual = narration.filter(s => !s.visual).length
  const total = scenes.reduce((sum, s) => sum + sceneSeconds(s), 0)
  const chapters = chapterCount(scenes)
  const locked = busy !== null || jobActive
  const voice = draft.voice
  const output = draft.output
  const renderBlocked = missingAudio > 0 || (quotes > 0 && !data.source_ready)

  const withVisual = narration.length - noVisual
  const steps = [
    { icon: FileText, label: 'Naskah', detail: `${scenes.length} adegan`, done: !dirty, hint: dirty ? 'Belum disimpan' : 'Tersimpan' },
    { icon: AudioLines, label: 'Suara', detail: `${narration.length - missingAudio}/${narration.length}`, done: missingAudio === 0,
      hint: missingAudio ? 'Buat suara AI atau rekam' : 'Siap' },
    { icon: ImageIcon, label: 'Visual', detail: `${withVisual}/${narration.length}`, done: noVisual === 0,
      hint: !data.stock_provider ? 'Latar polos (opsional)' : noVisual ? 'Isi otomatis atau pilih' : 'Siap' },
    { icon: Film, label: 'Render', detail: output ? formatSpan(output.duration) : '', done: !!output && !jobActive,
      hint: jobActive ? 'Sedang dirender' : output ? 'Selesai' : renderBlocked ? 'Lengkapi suara dulu' : 'Siap dirender' },
  ]

  return (
    <div className="pt-10 pb-24">
      {header}

      <ol aria-label="Progres" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map(({ icon: Icon, label, detail, done, hint }, i) => (
          <li key={label} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${done ? 'border-teal/40 bg-teal/5' : 'border-rule bg-bay/40'}`}>
            <span className={`grid size-8 shrink-0 place-items-center rounded-full ${done ? 'bg-teal/15 text-teal' : 'bg-raised text-ink-muted'}`}>
              {done ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">
                <span className="timecode text-ink-faint">{i + 1}.</span> {label} {detail && <span className="timecode font-normal text-ink-muted">{detail}</span>}
              </span>
              <span className="block truncate text-xs text-ink-muted">{hint}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <div className="min-w-0 space-y-6">
          <section className="space-y-3">
            <label className="block">
              <span className="text-sm text-ink-muted">Judul video</span>
              <input value={draft.title} maxLength={100} disabled={locked} onChange={e => edit(p => ({ ...p, title: e.target.value }))}
                className="mt-1 h-11 w-full rounded-md border border-rule bg-bay px-3 text-lg font-semibold text-ink focus:border-signal focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-sm text-ink-muted">Ringkasan (awal deskripsi YouTube)</span>
              <textarea value={draft.summary} maxLength={400} disabled={locked} onChange={e => edit(p => ({ ...p, summary: e.target.value }))}
                className="field-sizing-content mt-1 min-h-14 w-full resize-none rounded-md border border-rule bg-bay px-3 py-2 text-sm text-ink focus:border-signal focus:outline-none" />
            </label>
          </section>

          <section aria-labelledby="scenes-title">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="scenes-title" className="type-heading text-2xl text-ink">Naskah</h2>
              <p className="text-sm text-ink-muted">
                {scenes.length} adegan, {chapters} bab, ±{formatSpan(total)}
              </p>
            </div>
            <ol className="mt-4 space-y-5">
              {scenes.map((scene, i) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  index={i}
                  total={scenes.length}
                  locked={locked}
                  working={working.has(scene.id)}
                  stockProvider={data.stock_provider}
                  onChange={patch => editScene(scene.id, patch)}
                  onMove={dir => edit(p => {
                    const next = [...p.scenes]
                    const j = i + dir
                    ;[next[i], next[j]] = [next[j], next[i]]
                    return { ...p, scenes: next }
                  })}
                  onRemove={() => edit(p => ({ ...p, scenes: p.scenes.filter(s => s.id !== scene.id) }))}
                  onAddAfter={() => edit(p => {
                    const next = [...p.scenes]
                    next.splice(i + 1, 0, { id: newSceneId(), kind: 'narration', chapter: '', text: '', query: '', visual: null, audio_state: 'missing' })
                    return { ...p, scenes: next }
                  })}
                  onTts={() => sceneOp(scene.id, () => longformTts(videoId, scene.id))}
                  onAudio={(blob, name) => sceneOp(scene.id, () => uploadLongformRecording(videoId, scene.id, blob, name))}
                  onDeleteAudio={() => sceneOp(scene.id, () => deleteLongformAudio(videoId, scene.id))}
                />
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <section className="rounded-lg border border-rule glass p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-ink">Naskah</h2>
              {dirty
                ? <button type="button" onClick={() => run('save', async () => { await save() })} disabled={locked} className="btn btn-sm btn-primary">
                    {busy === 'save' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Simpan
                  </button>
                : <span className="text-xs text-ink-faint">Tersimpan</span>}
            </div>
            <label className="mt-3 block text-sm">
              <span className="text-ink-muted">Nama channel</span>
              <input value={channel ?? ''} maxLength={40} disabled={locked} onChange={e => setChannel(e.target.value)} placeholder="Mis. Klik Digital"
                className="mt-1 h-9 w-full rounded-md border border-rule bg-bay px-2 text-sm text-ink focus:border-signal focus:outline-none" />
            </label>
            {(channel ?? '').trim() !== (draft.channel ?? '') && (
              <p className="mt-1 text-xs text-ink-faint">Naskah ini ditulis {draft.channel ? <>untuk “{draft.channel}”</> : 'tanpa nama channel'}. Buat ulang naskah, atau edit adegan pembuka & penutup.</p>
            )}
            <button type="button" onClick={() => createScript(true)} disabled={locked} className="btn btn-sm btn-quiet mt-2 -ml-2">
              {busy === 'script' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />} Buat ulang naskah
            </button>
          </section>

          {fromTopic && !!draft.sources?.length && (
            <section className="rounded-lg border border-rule glass p-4">
              <h2 className="font-semibold text-ink">Sumber berita</h2>
              <p className="mt-1 text-xs text-ink-faint">Fakta & angka di naskah diambil dari sini. Cek ulang sebelum upload.</p>
              <ul className="mt-2 space-y-2 text-sm">
                {draft.sources.map(src => (
                  <li key={src.url}>
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-4 decoration-rule hover:decoration-ink-muted line-clamp-2">{src.title}</a>
                    <span className="block text-xs text-ink-muted">{src.source}{src.date && `, ${src.date}`}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-lg border border-rule glass p-4">
            <h2 className="font-semibold text-ink">Suara</h2>
            <label className="mt-3 block text-sm">
              <span className="text-ink-muted">Suara AI (Gemini)</span>
              <select value={voice.voice} disabled={locked} onChange={e => edit(p => ({ ...p, voice: { ...p.voice, voice: e.target.value } }))}
                className="mt-1 block h-9 w-full rounded-md border border-rule bg-bay px-2 text-ink">
                {data.voices.map(v => <option key={v.id} value={v.id}>{v.id}, {v.label.toLowerCase()}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-ink-muted">Gaya bicara</span>
              <input value={voice.style} maxLength={160} disabled={locked} onChange={e => edit(p => ({ ...p, voice: { ...p.voice, style: e.target.value } }))}
                className="mt-1 h-9 w-full rounded-md border border-rule bg-bay px-2 text-sm text-ink focus:border-signal focus:outline-none" />
            </label>
            <button type="button" onClick={ttsAll} disabled={locked || missingAudio === 0} className="btn btn-sm btn-quiet mt-3 -ml-2">
              {busy === 'tts-all' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
              {ttsProgress ? `Membuat suara ${ttsProgress.done}/${ttsProgress.total}…` : `Buat suara AI (${missingAudio} adegan)`}
            </button>
            <p className="mt-2 text-xs text-ink-faint">Bisa juga rekam suaramu sendiri per adegan. Suara asli biasanya lebih dipercaya penonton.</p>
          </section>

          <section className="rounded-lg border border-rule glass p-4">
            <h2 className="font-semibold text-ink">Visual</h2>
            {data.stock_provider ? (
              <>
                <p className="mt-1 text-sm text-ink-muted">
                  {noVisual ? `${noVisual} adegan belum punya video stok` : 'Semua adegan narasi punya video stok'} dari {STOCK_NAMES[data.stock_provider].name}.
                </p>
                <button type="button" onClick={autoVisuals} disabled={locked || noVisual === 0} className="btn btn-sm btn-quiet mt-2 -ml-2">
                  {busy === 'visuals' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Wand2 className="size-3.5" aria-hidden />} Isi visual otomatis
                </button>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">Isi <code className="timecode text-ink">PIXABAY_API_KEY</code> di backend/.env untuk video stok. Tanpa itu, adegan memakai latar polos.</p>
            )}
            {quotes > 0 && !data.source_ready && (
              <p className="mt-2 text-xs text-signal">
                {quotes} adegan kutipan butuh file video podcast. <Link href={`/video/${videoId}`} className="underline underline-offset-4">Upload videonya</Link>, atau hapus kutipannya.
              </p>
            )}
          </section>

          <section className="rounded-lg border border-rule glass p-4">
            <h2 className="font-semibold text-ink">Render</h2>
            <p className="mt-1 text-sm text-ink-muted">±{formatSpan(total)}, 1920×1080, subtitle & judul bab.</p>
            {missingAudio > 0 && <p className="mt-1 text-xs text-signal">{missingAudio} adegan belum punya suara terbaru.</p>}
            <button type="button" onClick={startRender} disabled={locked || renderBlocked} className="btn btn-primary mt-3 w-full">
              {jobActive || busy === 'render' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Film className="size-4" aria-hidden />}
              {jobActive ? 'Merender…' : output ? 'Render ulang' : 'Render video'}
            </button>
            {job && jobActive && (
              <p role="status" className="mt-2 text-xs text-ink-muted">
                {job.status === 'queued' ? 'Menunggu render lain selesai…'
                  : job.status === 'downloading' ? 'Mengunduh video podcast…'
                  : Object.values(job.segments)[0]?.message || 'Menyiapkan…'}
                {' '}Halaman ini boleh ditinggal.
              </p>
            )}
          </section>
        </aside>
      </div>

      <ThumbnailPanel
        key={draft.created_at}
        videoId={videoId}
        data={data}
        project={draft}
        locked={locked}
        save={save}
        onResult={next => {
          setData(next)
          setDraft(prev => prev && { ...prev, thumbnail: next.project?.thumbnail ?? null })
        }}
      />

      {output && (
        <section aria-labelledby="output-title" className="mt-12 border-t border-rule pt-8">
          <h2 id="output-title" className="type-heading text-2xl text-ink">Hasil render</h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div>
              <video src={output.url} controls preload="metadata" className="aspect-video w-full rounded-md border border-rule bg-black" />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a href={downloadUrl(output.url)} download className="btn btn-primary"><Download className="size-4" aria-hidden /> Unduh MP4</a>
                <span className="text-sm text-ink-muted">{formatSpan(output.duration)}, dirender {output.rendered_at}</span>
              </div>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-ink-muted">Judul</p>
                  <CopyButton text={draft.title} label="Salin" />
                </div>
                <p className="font-semibold text-ink">{draft.title}</p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-ink-muted">Deskripsi (bab & kredit)</p>
                  <CopyButton text={output.description} label="Salin" />
                </div>
                <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-rule bg-bay p-3 font-sans text-ink/90">{output.description}</pre>
              </div>
              <div>
                <p className="text-ink-muted">Bab</p>
                <ul className="mt-1 space-y-0.5">
                  {output.chapters.map(c => <li key={c.at}><span className="timecode text-ink-muted">{formatClock(c.at)}</span> {c.title}</li>)}
                </ul>
                {output.chapters.length < 3 && (
                  <p className="mt-1 text-xs text-ink-faint">YouTube baru menampilkan bab jika ada minimal 3 bab (masing-masing ≥10 detik).</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
