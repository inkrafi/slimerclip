'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check, ChevronDown, Copy, Play } from 'lucide-react'
import { ScoreBreakdown, Segment } from '@/lib/types'
import { angleOf, emotionOf, formatSpan, toSeconds } from '@/lib/clip-meta'
import ScoreMeter from './ScoreMeter'

interface Props {
  segment: Segment
  isBest: boolean
  isOpen: boolean
  onToggle: () => void
  onPlayClip: (start: string, end: string) => void
  /** URL klip hasil render jika momen ini sudah pernah dirender */
  /** Link ke editor klip, jika momen ini sudah punya pratinjau/klip */
  editHref?: string
}

const HOOK_LABELS: Record<string, string> = {
  hook_pertanyaan: 'Pertanyaan',
  hook_pernyataan: 'Pernyataan',
  hook_teaser: 'Teaser',
}

function stripEmoji(text: string) {
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function Meter({ value }: { value: number }) {
  return (
    <span className="block h-1.5 w-full rounded-full bg-rule overflow-hidden" aria-hidden>
      <span className="block h-full bg-ink-muted" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  )
}

/** Rincian dari mana skor viral berasal (lihat backend/scoring.py). */
function ScoreDetails({ breakdown }: { breakdown: ScoreBreakdown }) {
  const { ai, penonton, struktur, bobot } = breakdown
  const pct = (w?: number) => (w ? `${Math.round(w * 100)}%` : '')
  const aiParts = [
    ai.hook != null && `hook ${ai.hook}/30`,
    ai.emosi != null && `emosi ${ai.emosi}/30`,
    ai.daya_tarik != null && `daya tarik ${ai.daya_tarik}/20`,
    ai.penutup != null && `penutup ${ai.penutup}/20`,
  ].filter(Boolean)

  return (
    <section>
      <h3 className="text-sm font-semibold text-ink-muted">Dari mana skornya</h3>
      <dl className="mt-2 grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:grid-cols-[10rem_6rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5 text-sm">
        <dt className="text-ink">Isi momen <span className="text-ink-faint">{pct(bobot.ai)}</span></dt>
        <dd className="hidden sm:block"><Meter value={ai.total} /></dd>
        <dd className="text-ink-muted">
          <span className="timecode text-ink">{ai.total}</span>/100 menurut AI{aiParts.length > 0 && <span className="block text-xs">{aiParts.join(', ')}</span>}
        </dd>

        <dt className="text-ink">Tonton ulang <span className="text-ink-faint">{pct(bobot.penonton)}</span></dt>
        <dd className="hidden sm:block">{penonton != null && <Meter value={penonton} />}</dd>
        <dd className="text-ink-muted">
          {penonton != null
            ? <>Bagian ini lebih sering diputar ulang daripada <span className="timecode text-ink">{Math.round(penonton)}%</span> bagian lain video</>
            : 'Video belum punya data tonton ulang dari YouTube'}
        </dd>

        <dt className="text-ink">Struktur <span className="text-ink-faint">{pct(bobot.struktur)}</span></dt>
        <dd className="hidden sm:block"><Meter value={struktur.skor} /></dd>
        <dd className="text-ink-muted">
          {formatSpan(struktur.durasi_detik)}
          {struktur.kata_per_detik != null && <>, {String(struktur.kata_per_detik).replace('.', ',')} kata per detik</>}
        </dd>
      </dl>
    </section>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      className={`btn btn-sm shrink-0 ${copied ? 'text-sage' : 'btn-quiet'}`}
      aria-label={copied ? 'Tersalin' : label}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? 'Tersalin' : 'Salin'}
    </button>
  )
}

/** Satu momen hasil analisis: baris ringkas yang bisa dibuka untuk melihat hook & caption. */
export default function SegmentCard({ segment: seg, isBest, isOpen, onToggle, onPlayClip, editHref }: Props) {
  const angle = angleOf(seg.content_angle)
  const emotion = emotionOf(seg.emotion_trigger)
  const length = toSeconds(seg.end_time) - toSeconds(seg.start_time)
  const caption = stripEmoji(seg.caption_suggestion || '')
  const bodyId = `moment-body-${seg.segment_number}`

  return (
    <article id={`moment-${seg.segment_number}`} className="relative border-b border-rule last:border-b-0 scroll-mt-24">
      {/* Strip warna label, seperti label klip di timeline */}
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: angle.color }} aria-hidden />

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        className="w-full text-left grid grid-cols-[2.25rem_1fr_auto] sm:grid-cols-[2.5rem_7.5rem_1fr_auto_1rem] items-start sm:items-center gap-x-4 gap-y-1 pl-5 pr-4 py-4 hover:bg-raised/50"
      >
        <span className={`timecode type-heading text-xl leading-none ${isBest ? 'text-signal' : 'text-ink-muted'}`}>
          {seg.segment_number}
        </span>

        <span className="timecode text-sm text-ink row-start-2 col-start-2 sm:row-start-auto sm:col-start-auto">
          {seg.start_time}–{seg.end_time}
          <span className="block text-xs text-ink-muted">{formatSpan(length)}</span>
        </span>

        <span className="min-w-0 col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto">
          <span className="block text-[15px] font-semibold text-ink leading-snug line-clamp-2">{seg.topic}</span>
          <span className="mt-1 block text-xs text-ink-muted">
            <span style={{ color: angle.color }}>{angle.label}</span>
            {emotion && <>, {emotion}</>}
            {editHref && <span className="text-sage">, klip tersimpan</span>}
          </span>
        </span>

        <span className="col-start-3 row-start-1 row-span-2 sm:col-start-auto sm:row-start-auto sm:row-span-1 self-center">
          <ScoreMeter score={seg.viral_score} />
        </span>

        <ChevronDown
          className={`hidden sm:block size-4 text-ink-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      <div
        id={bodyId}
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
        inert={!isOpen}
      >
        <div className="overflow-hidden">
          <div className="pl-5 sm:pl-[4.75rem] pr-4 pb-6 space-y-6 max-w-[72ch]">
            <section>
              <h3 className="text-sm font-semibold text-ink-muted">Kenapa layak dipotong</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink/90">{seg.why_viral}</p>
            </section>

            {seg.speaker_quote && (
              <section className="flex items-start gap-4">
                <blockquote className="type-heading flex-1 text-xl md:text-2xl text-ink border-l-2 border-signal pl-4">
                  {seg.speaker_quote}
                </blockquote>
                <CopyButton text={seg.speaker_quote} label="Salin kutipan" />
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold text-ink-muted">Hook pembuka</h3>
              <ul className="mt-2 divide-y divide-rule border-y border-rule">
                {Object.entries(seg.hooks || {}).map(([key, val]) => (
                  <li key={key} className="flex items-start gap-4 py-3">
                    <span className="w-24 shrink-0 text-xs text-ink-muted pt-0.5">{HOOK_LABELS[key] || key}</span>
                    <p className="flex-1 text-sm leading-relaxed text-ink">{val}</p>
                    <CopyButton text={val} label={`Salin hook ${HOOK_LABELS[key] || key}`} />
                  </li>
                ))}
              </ul>
            </section>

            {caption && (
              <section>
                <h3 className="text-sm font-semibold text-ink-muted">Caption</h3>
                <div className="mt-2 flex items-start gap-4">
                  <p className="flex-1 text-sm leading-relaxed text-ink whitespace-pre-line">{caption}</p>
                  <CopyButton text={caption} label="Salin caption" />
                </div>
              </section>
            )}

            {seg.score_breakdown && <ScoreDetails breakdown={seg.score_breakdown} />}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onPlayClip(seg.start_time, seg.end_time)} className="btn btn-quiet">
                <Play className="size-4" aria-hidden />
                Putar di YouTube
              </button>
              {editHref && (
                <Link href={editHref} className="btn btn-quiet">
                  Edit klip
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
