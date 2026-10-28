import { useSyncExternalStore } from 'react'
import type { ClientPreset, ClipProfile, ClipProfileOptions } from '@/lib/types'

/** Sama dengan clip_profile.DEFAULT_PROFILE di backend */
export const DEFAULT_PROFILE: ClipProfile = {
  source_language: 'auto',
  output_language: 'id',
  subtitle_language: 'same',
  video_type: 'auto',
  clip_count: 'auto',
  duration: 'medium',
}

const KEY = 'slimerclip.clipProfile'
const listeners = new Set<() => void>()
let memory = JSON.stringify(DEFAULT_PROFILE)

// Profil terakhir yang dipakai admin, diingat per browser (dipakai lagi untuk video berikutnya).
// Lewat useSyncExternalStore: render server selalu default, jadi tidak ada beda hasil saat hidrasi.
function read(): string {
  try {
    return localStorage.getItem(KEY) || memory
  } catch {
    return memory
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

const CLIP_COUNTS: ClipProfile['clip_count'][] = ['auto', 5, 10, 15, 20]

export function parseProfile(raw: string): ClipProfile {
  try {
    const p: ClipProfile = { ...DEFAULT_PROFILE, ...JSON.parse(raw) }
    // Pilihan jumlah lama (3/8/12) tidak berlaku lagi → otomatis
    return CLIP_COUNTS.includes(p.clip_count) ? p : { ...p, clip_count: 'auto' }
  } catch {
    return DEFAULT_PROFILE
  }
}

export function saveProfile(profile: ClipProfile) {
  memory = JSON.stringify(profile)
  try {
    localStorage.setItem(KEY, memory)
  } catch { /* penyimpanan browser tidak tersedia: cukup di memori */ }
  listeners.forEach(fn => fn())
}

export function useStoredProfile(): ClipProfile {
  const raw = useSyncExternalStore(subscribe, read, () => JSON.stringify(DEFAULT_PROFILE))
  return parseProfile(raw)
}

// Klien yang sedang dikerjakan (preset aktif): format edit-nya jadi pilihan awal "render semua"
const PRESET_KEY = 'slimerclip.activePreset'
let presetMemory = ''

function readPreset(): string {
  try {
    return localStorage.getItem(PRESET_KEY) ?? presetMemory
  } catch {
    return presetMemory
  }
}

export function setActivePreset(preset: ClientPreset | null) {
  presetMemory = preset ? JSON.stringify(preset) : ''
  try {
    if (preset) localStorage.setItem(PRESET_KEY, presetMemory)
    else localStorage.removeItem(PRESET_KEY)
  } catch { /* cukup di memori */ }
  if (preset) saveProfile({ ...DEFAULT_PROFILE, ...preset.profile })
  else listeners.forEach(fn => fn())
}

export function useActivePreset(): ClientPreset | null {
  const raw = useSyncExternalStore(subscribe, readPreset, () => '')
  try {
    return raw ? JSON.parse(raw) as ClientPreset : null
  } catch {
    return null
  }
}

/** Ringkasan satu baris, mis. "Podcast · Inggris → Indonesia · 30–60 detik · maks 5 klip" */
export function profileSummary(p: ClipProfile, opts: ClipProfileOptions | null, detectedType?: string, detectedLang?: string | null): string {
  const label = (list: { id: string; label: string }[] | undefined, id: string | null | undefined) =>
    list?.find(x => x.id === id)?.label ?? id ?? ''
  const typeId = p.video_type === 'auto' ? detectedType : p.video_type
  const type = typeId ? label(opts?.video_types, typeId).split(' (')[0] : 'Tipe otomatis'
  const srcId = p.source_language === 'auto' ? detectedLang : p.source_language
  const source = srcId ? label(opts?.languages, srcId) : 'bahasa otomatis'
  const output = p.output_language === 'same' ? source : label(opts?.languages, p.output_language)
  const lang = output && output !== source ? `${source} → ${output}` : source
  const count = p.clip_count === 'auto' ? 'jumlah otomatis' : `${p.clip_count} klip`
  const sub = p.subtitle_language !== 'same' ? `subtitle ${label(opts?.languages, p.subtitle_language)}` : ''
  return [type, lang, sub, label(opts?.durations, p.duration), count].filter(Boolean).join(' · ')
}

export const sameProfile = (a?: ClipProfile, b?: ClipProfile) =>
  !!a && !!b && (Object.keys(DEFAULT_PROFILE) as (keyof ClipProfile)[]).every(k => a[k] === b[k])
