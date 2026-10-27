'use client'

import { useState } from 'react'
import { Check, Download, Image as ImageIcon, Loader2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { createLongformThumbnail, downloadUrl } from '@/lib/api'
import type { LongformData, LongformProject } from '@/lib/types'

interface Props {
  videoId: string
  data: LongformData
  project: LongformProject
  locked: boolean
  /** Simpan editan naskah dulu (latar thumbnail diambil dari visual adegan yang tersimpan) */
  save: () => Promise<boolean>
  onResult: (next: LongformData) => void
}

const STYLE_HINTS: Record<string, string> = {
  tajuk: 'Foto penuh, huruf kapital tebal, kata kunci di blok warna',
  panel: 'Panel gelap di kiri, foto di kanan, garis aksen',
  editorial: 'Foto duotone, serif besar gaya majalah',
}

/** Sketsa kecil tiap gaya, supaya pilihan bisa dibandingkan tanpa membuat thumbnail dulu */
function StyleSketch({ style, accent }: { style: string; accent: string }) {
  if (style === 'panel') {
    return (
      <span className="relative block aspect-video overflow-hidden rounded-[3px] bg-[#3a3f4a]">
        <span className="absolute inset-y-0 left-0 w-[44%] bg-[#101013]" />
        <span className="absolute inset-y-0 left-[44%] w-[3%]" style={{ background: accent }} />
        <span className="absolute left-[8%] top-[38%] h-[9%] w-[28%] bg-white" />
        <span className="absolute left-[8%] top-[52%] h-[9%] w-[20%]" style={{ background: accent }} />
      </span>
    )
  }
  if (style === 'editorial') {
    return (
      <span className="relative block aspect-video overflow-hidden rounded-[3px] bg-gradient-to-b from-[#2b2f2c] to-[#0e0e10]">
        <span className="absolute bottom-[14%] left-[8%] font-serif text-[0.95rem] leading-none text-white">
          Aa <i style={{ color: accent }}>aa</i>
        </span>
      </span>
    )
  }
  return (
    <span className="relative block aspect-video overflow-hidden rounded-[3px] bg-gradient-to-r from-[#0b0b0d] via-[#26292f] to-[#4a505a]">
      <span className="absolute left-[8%] top-[40%] h-[11%] w-[40%] bg-white" />
      <span className="absolute left-[8%] top-[58%] h-[13%] w-[26%]" style={{ background: accent }} />
    </span>
  )
}

/** Thumbnail YouTube 16:9 dari frame video stok adegan + tipografi dengan ciri khas channel. */
export default function ThumbnailPanel({ videoId, data, project, locked, save, onResult }: Props) {
  const current = project.thumbnail
  const ideas = project.thumbnail_ideas ?? []
  const visuals = project.scenes.filter(s => s.visual)
  const [text, setText] = useState(current?.text || ideas[0] || '')
  const [style, setStyle] = useState(current?.style || data.brand.style)
  const [accent, setAccent] = useState(current?.accent || data.brand.accent)
  // '' = otomatis (visual adegan pertama); 'none' = latar polos
  const [picked, setSceneId] = useState<string>(current ? current.scene_id ?? 'none' : '')
  const sceneId = picked || visuals[0]?.id || 'none'
  const [busy, setBusy] = useState(false)
  const accentHex = data.thumb_accents[accent] ?? '#FFD23F'

  const generate = async () => {
    if (!text.trim()) {
      toast.error('Isi teks thumbnail dulu.')
      return
    }
    setBusy(true)
    try {
      if (!(await save())) return
      onResult(await createLongformThumbnail(videoId, { text, style, accent, scene_id: sceneId }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Thumbnail gagal dibuat.')
    } finally {
      setBusy(false)
    }
  }

  const changed = !current || current.text !== text || current.style !== style || current.accent !== accent
    || (current.scene_id ?? 'none') !== sceneId

  return (
    <section aria-labelledby="thumb-title" className="mt-12 border-t border-rule pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="thumb-title" className="type-heading text-2xl text-ink">Thumbnail</h2>
        <p className="text-sm text-ink-muted">1280×720 JPG, siap upload ke YouTube</p>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.url} alt={`Thumbnail: ${current.text.replaceAll('*', '')}`}
              className={`aspect-video w-full rounded-md border border-rule bg-black object-cover ${busy ? 'opacity-60' : ''}`} />
          ) : (
            <div className="grid aspect-video w-full place-items-center rounded-md border border-dashed border-rule bg-bay/40 text-center">
              <span className="px-6 text-sm text-ink-muted">
                {busy ? <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden /> : <ImageIcon className="mx-auto mb-2 size-5" aria-hidden />}
                {busy ? 'Membuat thumbnail…' : 'Pilih teks & gaya, lalu buat thumbnail.'}
              </span>
            </div>
          )}
          {current && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a href={downloadUrl(current.url)} download className="btn btn-primary"><Download className="size-4" aria-hidden /> Unduh JPG</a>
              {changed && !busy && <span className="text-sm text-ink-muted">Pengaturan berubah, buat ulang untuk melihat hasilnya.</span>}
            </div>
          )}
        </div>

        <div className="space-y-5 text-sm">
          <div>
            <label htmlFor="thumb-text" className="text-ink-muted">Teks</label>
            <input id="thumb-text" value={text} maxLength={60} disabled={locked || busy} onChange={e => setText(e.target.value)}
              placeholder="Mis. Gaji Naik, Tetap *Bokek*?"
              className="mt-1 h-10 w-full rounded-md border border-rule bg-bay px-3 text-ink focus:border-signal focus:outline-none" />
            <p className="mt-1 text-xs text-ink-faint">2–5 kata. Apit kata kunci dengan *bintang* untuk warna aksen.</p>
            {ideas.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Saran teks dari naskah">
                {ideas.map(idea => (
                  <button key={idea} type="button" disabled={locked || busy} onClick={() => setText(idea)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${text === idea ? 'border-signal text-ink' : 'border-rule text-ink-muted hover:text-ink'}`}>
                    {idea.replaceAll('*', '')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <fieldset>
            <legend className="text-ink-muted">Gaya</legend>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {data.thumb_styles.map(s => (
                <button key={s.id} type="button" role="radio" aria-checked={style === s.id} disabled={locked || busy}
                  onClick={() => setStyle(s.id)} title={STYLE_HINTS[s.id]}
                  className={`rounded-md border p-1.5 text-left ${style === s.id ? 'border-signal bg-raised' : 'border-rule hover:border-ink-faint'}`}>
                  <StyleSketch style={s.id} accent={accentHex} />
                  <span className="mt-1 block text-xs font-semibold text-ink">{s.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-faint">{STYLE_HINTS[style]}</p>
          </fieldset>

          <fieldset>
            <legend className="text-ink-muted">Warna aksen</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(data.thumb_accents).map(([id, hex]) => (
                <button key={id} type="button" role="radio" aria-checked={accent === id} aria-label={id} title={id}
                  disabled={locked || busy} onClick={() => setAccent(id)}
                  className={`grid size-8 place-items-center rounded-full border-2 ${accent === id ? 'border-ink' : 'border-transparent'}`}
                  style={{ background: hex }}>
                  {accent === id && <Check className="size-4 text-black/80" aria-hidden />}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-faint">Gaya & warna diingat untuk video berikutnya, jadi semua thumbnail channelmu seragam.</p>
          </fieldset>

          <fieldset>
            <legend className="text-ink-muted">Latar</legend>
            <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
              <button type="button" role="radio" aria-checked={sceneId === 'none'} disabled={locked || busy} onClick={() => setSceneId('none')}
                className={`grid aspect-video w-24 shrink-0 place-items-center rounded-md border bg-[#141318] text-xs text-ink-muted ${sceneId === 'none' ? 'border-signal' : 'border-rule'}`}>
                Polos
              </button>
              {visuals.map(scene => (
                <button key={scene.id} type="button" role="radio" aria-checked={sceneId === scene.id} disabled={locked || busy}
                  onClick={() => setSceneId(scene.id)} title={scene.text.slice(0, 80)}
                  className={`aspect-video w-24 shrink-0 overflow-hidden rounded-md border ${sceneId === scene.id ? 'border-signal ring-1 ring-signal' : 'border-rule'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {scene.visual?.thumb ? <img src={scene.visual.thumb} alt="" className="size-full object-cover" /> : null}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              {visuals.length ? 'Diambil frame paling tajam dari video stok adegan itu.' : 'Isi visual adegan dulu agar bisa memakai foto sebagai latar.'}
            </p>
          </fieldset>

          <button type="button" onClick={generate} disabled={locked || busy || !text.trim()} className="btn btn-primary w-full">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Wand2 className="size-4" aria-hidden />}
            {busy ? 'Membuat…' : current ? 'Buat ulang thumbnail' : 'Buat thumbnail'}
          </button>
        </div>
      </div>
    </section>
  )
}
