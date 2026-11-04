'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MotionBriefEditor from '@/components/motion/MotionBriefEditor'
import { getMotionProjects, saveMotionBrief } from '@/lib/api'
import type { MotionProject } from '@/lib/types'

export default function MotionBriefPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<MotionProject | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getMotionProjects().then(items => {
      if (cancelled) return
      const found = items.find(p => p.id === projectId)
      if (found) setProject(found)
      else setError('Proyek ini tidak ditemukan. Mungkin sudah dihapus.')
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Proyek gagal dimuat. Muat ulang halaman ini.') })
    return () => { cancelled = true }
  }, [projectId])

  if (error) {
    return (
      <div className="pt-12">
        <p role="alert" className="text-tally">{error}</p>
        <Link href="/proyek-motion" className="mt-2 inline-flex min-h-11 items-center text-sm text-ink-muted underline underline-offset-4 hover:text-ink">Kembali ke proyek motion</Link>
      </div>
    )
  }
  if (!project) return <div className="max-w-3xl space-y-4 pt-12" aria-hidden>{[0, 1, 2].map(i => <div key={i} className="skeleton h-24 rounded" />)}</div>
  return <MotionBriefEditor project={project} onSave={(product, brief) => saveMotionBrief(projectId, product, brief)} />
}
