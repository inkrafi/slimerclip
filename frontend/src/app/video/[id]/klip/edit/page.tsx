'use client'

import { Suspense, use } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import RequireAuth from '@/components/RequireAuth'
import ClipEditor from '@/components/editor/ClipEditor'

export default function ClipEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <Editor id={id} />
      </Suspense>
    </RequireAuth>
  )
}

function Editor({ id }: { id: string }) {
  // Key klip berisi ":" (rentang waktu), jadi lewat query string, bukan segmen path
  const key = useSearchParams().get('key') || ''
  if (!key) {
    return (
      <div className="pt-10 max-w-lg">
        <h1 className="type-heading text-2xl text-ink">Klip tidak ditemukan</h1>
        <p className="mt-2 text-ink-muted">Buka klip dari halaman klip tersimpan.</p>
        <Link href={`/video/${id}/klip`} className="mt-6 btn btn-quiet">Kembali ke klip</Link>
      </div>
    )
  }
  return <ClipEditor key={key} videoId={id} clipKey={key} />
}
