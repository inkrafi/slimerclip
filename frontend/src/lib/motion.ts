import type { MotionPackage, MotionStatus } from '@/lib/types'

export const MOTION_PACKAGES: { id: MotionPackage; label: string }[] = [
  { id: 'teaser', label: 'Teaser' },
  { id: 'launch', label: 'Launch video' },
  { id: 'kit', label: 'Launch kit' },
  { id: 'custom', label: 'Custom' },
]

export const MOTION_STATUSES: { id: MotionStatus; label: string; tone: string }[] = [
  { id: 'konsultasi', label: 'Konsultasi', tone: 'text-label-iris' },
  { id: 'naskah', label: 'Naskah & storyboard', tone: 'text-label-cerulean' },
  { id: 'animasi', label: 'Animasi', tone: 'text-signal' },
  { id: 'revisi', label: 'Revisi', tone: 'text-label-rose' },
  { id: 'selesai', label: 'Selesai', tone: 'text-sage' },
  { id: 'batal', label: 'Batal', tone: 'text-ink-muted' },
]

export const packageLabel = (id: MotionPackage) => MOTION_PACKAGES.find(p => p.id === id)?.label ?? id
export const statusInfo = (id: MotionStatus) => MOTION_STATUSES.find(s => s.id === id) ?? MOTION_STATUSES[0]

/** Proyek yang masih berjalan: tenggatnya perlu diperhatikan */
export const isOpen = (status: MotionStatus) => status !== 'selesai' && status !== 'batal'

export function formatDeadline(deadline: string) {
  if (!deadline) return '—'
  return new Date(`${deadline}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const todayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
