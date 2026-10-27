'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, ChevronDown, ExternalLink, Lightbulb, Loader2, RefreshCw, Search, Trash2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/AuthProvider'
import {
  createTopicProject, deleteTopicProject, getRecommendedIdeas, getTopicIdeas, listTopicProjects, saveLongformBrand,
} from '@/lib/api'
import { formatSpan } from '@/lib/clip-meta'
import type { TopicIdea, TopicProjectSummary } from '@/lib/types'

const DURATIONS = [5, 8, 12]

function ago(epochSeconds: number): string {
  const minutes = Math.max(0, Math.round((Date.now() / 1000 - epochSeconds) / 60))
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  return `${Math.round(minutes / 60)} jam lalu`
}

/** Tab video panjang dari topik/isu trending (khusus admin): pilih rekomendasi → editor. */
export default function TopicsHub() {
  const { me } = useAuth()
  if (me && !me.is_admin) {
    return <p role="alert" className="pt-16 border-l-2 border-tally pl-4 text-sm text-ink-muted">Fitur video panjang khusus admin.</p>
  }
  return <Hub />
}

interface IdeaCardProps {
  idea: TopicIdea
  project?: TopicProjectSummary
  creating: boolean
  disabled: boolean
  onPick: () => void
}

function IdeaCard({ idea, project, creating, disabled, onPick }: IdeaCardProps) {
  const [showSources, setShowSources] = useState(false)
  const [first, ...rest] = idea.sources
  return (
    <li className="flex flex-col rounded-lg border border-rule glass p-4">
      <p className="font-semibold leading-snug text-ink">{idea.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink/90">{idea.angle}</p>
      <p className="mt-2 flex gap-1.5 text-xs text-ink-muted"><Lightbulb className="mt-px size-3.5 shrink-0 text-signal" aria-hidden />{idea.why}</p>

      {first && (
        <div className="mt-3 text-xs">
          <a href={first.url} target="_blank" rel="noopener noreferrer" className="flex gap-1.5 text-ink-muted hover:text-ink">
            <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{first.source ? `${first.source}: ` : ''}{first.title}</span>
          </a>
          {rest.length > 0 && (
            <>
              <button type="button" onClick={() => setShowSources(v => !v)} className="mt-1 text-ink-faint hover:text-ink-muted">
                {showSources ? 'Sembunyikan sumber' : `+${rest.length} sumber lain`}
              </button>
              {showSources && rest.map(src => (
                <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer" className="mt-1 flex gap-1.5 text-ink-muted hover:text-ink">
                  <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">{src.source ? `${src.source}: ` : ''}{src.title}</span>
                </a>
              ))}
            </>
          )}
        </div>
      )}

      <div className="mt-auto pt-4">
        {project ? (
          <Link href={`/longform/${project.id}`} className="btn btn-sm btn-quiet w-full justify-center">
            Sudah jadi proyek, buka <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : (
          <button type="button" onClick={onPick} disabled={disabled} className="btn btn-sm btn-primary w-full justify-center">
            {creating
              ? <><Loader2 className="size-3.5 animate-spin" aria-hidden /> Menulis naskah… (±30 dtk)</>
              : <><Wand2 className="size-3.5" aria-hidden /> Pilih topik ini</>}
          </button>
        )}
      </div>
    </li>
  )
}

function IdeaSkeleton() {
  return (
    <li className="rounded-lg border border-rule glass p-4" aria-hidden>
      <div className="h-4 w-4/5 animate-pulse rounded bg-raised" />
      <div className="mt-3 h-3 w-full animate-pulse rounded bg-raised/70" />
      <div className="mt-1.5 h-3 w-2/3 animate-pulse rounded bg-raised/70" />
      <div className="mt-6 h-8 w-full animate-pulse rounded bg-raised/60" />
    </li>
  )
}

function Hub() {
  const router = useRouter()
  const params = useSearchParams()
  // Dari Ruang kerja dengan kata kunci: langsung cari topik itu
  const initialQuery = params.get('q')?.trim() ?? ''
  const [recommended, setRecommended] = useState<{ ideas: TopicIdea[]; generated_at: number; niche: string[] } | null>(null)
  const [recError, setRecError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<TopicIdea[] | null>(null)
  const [searching, setSearching] = useState(!!initialQuery)
  const [minutes, setMinutes] = useState(8)
  const [creating, setCreating] = useState<string | null>(null)
  const [ownTitle, setOwnTitle] = useState('')
  const [ownAngle, setOwnAngle] = useState('')
  const [projects, setProjects] = useState<TopicProjectSummary[] | null>(null)
  // Nama channel untuk sapaan pembuka & penutup naskah (tersimpan di server sebagai brand)
  const [channel, setChannel] = useState<string | null>(null)

  const loadProjects = useCallback(() => {
    listTopicProjects().then(res => {
      setProjects(res.projects)
      setChannel(prev => prev ?? res.brand.channel)
    }).catch(() => setProjects([]))
  }, [])
  useEffect(loadProjects, [loadProjects])

  // Rekomendasi langsung dimuat (dari simpanan server; dibuat baru jika sudah lama)
  useEffect(() => {
    getRecommendedIdeas()
      .then(setRecommended)
      .catch(e => setRecError(e instanceof Error ? e.message : 'Rekomendasi gagal dimuat.'))
  }, [])

  useEffect(() => {
    if (!initialQuery) return
    getTopicIdeas(initialQuery, false)
      .then(res => setResults(res.ideas))
      .catch(e => toast.error(e instanceof Error ? e.message : 'Topik gagal dicari.'))
      .finally(() => setSearching(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    setRefreshing(true)
    setRecError(null)
    try {
      setRecommended(await getRecommendedIdeas(true))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rekomendasi gagal dimuat.')
    } finally {
      setRefreshing(false)
    }
  }

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      setResults((await getTopicIdeas(query.trim(), false)).ideas)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Topik gagal dicari.')
    } finally {
      setSearching(false)
    }
  }

  const create = async (key: string, title: string, angle: string, sources: TopicIdea['sources']) => {
    setCreating(key)
    try {
      const res = await createTopicProject({ title, angle, sources, minutes, channel: channel ?? '' })
      toast.success('Naskah siap. Periksa dan edit sebelum membuat suara.')
      router.push(`/longform/${res.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Naskah gagal dibuat.')
      setCreating(null)
    }
  }

  const remove = async (p: TopicProjectSummary) => {
    if (!confirm(`Hapus proyek "${p.title}"? Naskah, suara, dan hasil render ikut terhapus.`)) return
    try {
      await deleteTopicProject(p.id)
      setProjects(prev => prev?.filter(x => x.id !== p.id) ?? null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Proyek gagal dihapus.')
    }
  }

  const busy = creating !== null
  const projectFor = (idea: TopicIdea) => projects?.find(p => p.topic === idea.title)
  const cards = (list: TopicIdea[], prefix: string) => (
    <ul className="mt-4 grid gap-4 md:grid-cols-2">
      {list.map((idea, i) => (
        <IdeaCard key={`${prefix}-${i}-${idea.title}`} idea={idea} project={projectFor(idea)} creating={creating === `${prefix}-${i}`}
          disabled={busy} onPick={() => create(`${prefix}-${i}`, idea.title, idea.angle, idea.sources)} />
      ))}
    </ul>
  )

  return (
    <div className="pt-10 pb-24">
      <h1 className="type-display text-4xl text-ink">Video panjang</h1>
      <p className="mt-2 max-w-[68ch] text-ink-muted">
        Pilih topik yang sedang ramai, naskahnya langsung ditulis dari berita sumbernya. Setelah itu tinggal buat suara,
        pilih visual, dan render video 16:9 tanpa wajah.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] items-start">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="rec-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="rec-title" className="type-heading text-2xl text-ink">Rekomendasi topik</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {recommended
                    ? <>Dari berita 7 hari terakhir{recommended.niche.length ? ` untuk ${recommended.niche.join(', ')}` : ''}. Diperbarui {ago(recommended.generated_at)}.</>
                    : 'Membaca berita terbaru dan Google Trends Indonesia…'}
                  {recommended && !recommended.niche.length && (
                    <> <Link href="/pengaturan" className="text-ink underline underline-offset-4">Atur niche</Link> agar lebih sesuai channelmu.</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div role="radiogroup" aria-label="Durasi video" className="inline-flex rounded-md border border-rule p-0.5 text-sm">
                  {DURATIONS.map(m => (
                    <button key={m} type="button" role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)}
                      className={`h-8 rounded-[5px] px-3 ${minutes === m ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'}`}>
                      ±{m} mnt
                    </button>
                  ))}
                </div>
                <button type="button" onClick={refresh} disabled={refreshing || !recommended || busy} className="btn btn-sm btn-quiet"
                  title="Cari rekomendasi baru dari berita terkini">
                  <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden /> Ganti
                </button>
              </div>
            </div>

            {recError ? (
              <div role="alert" className="mt-4 border-l-2 border-tally pl-4 text-sm text-ink-muted">
                {recError} <button type="button" onClick={refresh} className="text-ink underline underline-offset-4">Coba lagi</button>
              </div>
            ) : !recommended || refreshing ? (
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }, (_, i) => <IdeaSkeleton key={i} />)}
              </ul>
            ) : cards(recommended.ideas, 'rec')}
          </section>

          <details className="group rounded-lg border border-rule glass" open={!!initialQuery || undefined}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 text-ink">
              <span className="font-semibold">Cari topik lain</span>
              <ChevronDown className="size-4 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="space-y-6 border-t border-rule px-5 py-5">
              <div>
                <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
                  <label className="field h-11 flex-1">
                    <span className="sr-only">Kata kunci</span>
                    <input value={query} maxLength={100} onChange={e => setQuery(e.target.value)}
                      placeholder="Kata kunci, mis. saham, AI, PHK"
                      className="w-full bg-transparent text-ink placeholder:text-ink-faint outline-none" />
                  </label>
                  <button type="submit" disabled={searching || busy || !query.trim()} className="btn btn-primary h-11">
                    {searching ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Mencari…</> : <><Search className="size-4" aria-hidden /> Cari</>}
                  </button>
                </form>
                {searching && !results && (
                  <ul className="mt-4 grid gap-4 md:grid-cols-2">{Array.from({ length: 2 }, (_, i) => <IdeaSkeleton key={i} />)}</ul>
                )}
                {results && cards(results, 'cari')}
              </div>

              <div className="border-t border-rule pt-5">
                <p className="text-sm font-semibold text-ink">Tulis topik sendiri</p>
                <p className="mt-0.5 text-xs text-ink-muted">Berita terbaru tentang topik ini dicari otomatis sebagai sumber fakta.</p>
                <input value={ownTitle} maxLength={200} onChange={e => setOwnTitle(e.target.value)} aria-label="Topik"
                  placeholder="Mis. Dampak PHK massal ke ekonomi keluarga"
                  className="mt-3 h-10 w-full rounded-md border border-rule bg-bay px-3 text-ink focus:border-signal focus:outline-none" />
                <textarea value={ownAngle} maxLength={400} onChange={e => setOwnAngle(e.target.value)} aria-label="Sudut pandang"
                  placeholder="Sudut pandang (opsional), mis. apa yang bisa dilakukan pekerja muda"
                  className="field-sizing-content mt-2 min-h-14 w-full resize-none rounded-md border border-rule bg-bay px-3 py-2 text-sm text-ink focus:border-signal focus:outline-none" />
                <button type="button" onClick={() => create('own', ownTitle.trim(), ownAngle.trim(), [])} disabled={busy || !ownTitle.trim()}
                  className="btn btn-primary mt-3">
                  {creating === 'own' ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Mencari berita & menulis…</> : <><Wand2 className="size-4" aria-hidden /> Buat naskah</>}
                </button>
              </div>
            </div>
          </details>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <section className="rounded-lg border border-rule glass p-4">
            <label htmlFor="channel-name" className="font-semibold text-ink">Nama channel</label>
            <input id="channel-name" value={channel ?? ''} maxLength={40} placeholder="Mis. Klik Digital"
              onChange={e => setChannel(e.target.value)}
              onBlur={() => { saveLongformBrand({ channel: channel ?? '' }).catch(() => {}) }}
              className="mt-2 h-9 w-full rounded-md border border-rule bg-bay px-2 text-sm text-ink focus:border-signal focus:outline-none" />
            <p className="mt-1 text-xs text-ink-faint">Disebut di sapaan pembuka dan salam penutup naskah.</p>
          </section>
          <section className="rounded-lg border border-rule glass p-4">
            <h2 className="font-semibold text-ink">Proyekmu</h2>
            {projects === null ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Memuat…</p>
            ) : projects.length === 0 ? (
              <p className="mt-1 text-sm text-ink-muted">Belum ada. Pilih salah satu rekomendasi untuk memulai.</p>
            ) : (
              <ul className="mt-2 divide-y divide-rule">
                {projects.map(p => (
                  <li key={p.id} className="flex items-start gap-2 py-2.5">
                    <Link href={`/longform/${p.id}`} className="min-w-0 flex-1 group">
                      <span className="block text-sm font-semibold leading-snug text-ink group-hover:underline line-clamp-2">{p.title || p.topic}</span>
                      <span className="mt-0.5 block text-xs text-ink-muted">
                        {p.rendered_at ? <span className="text-teal">Dirender{p.duration ? `, ${formatSpan(p.duration)}` : ''}</span> : `${p.scenes} adegan, belum dirender`}
                      </span>
                    </Link>
                    <button type="button" onClick={() => remove(p)} aria-label={`Hapus proyek ${p.title}`} className="btn btn-sm btn-quiet px-1.5 hover:text-tally">
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 border-t border-rule pt-3 text-xs text-ink-faint">
              Dari podcast? Buka video yang sudah dianalisis di <Link href="/" className="underline underline-offset-4">Ruang kerja</Link>,
              lalu pilih <span className="text-ink-muted">Jadikan video panjang</span>.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
