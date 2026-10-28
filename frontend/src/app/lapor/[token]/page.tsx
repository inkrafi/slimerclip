'use client'

import { use, useCallback, useEffect, useState } from 'react'
import ReportView, { ReportSkeleton } from '@/components/report/ReportView'
import { getPublicReport } from '@/lib/api'
import type { PerformanceReport } from '@/lib/types'

/** Laporan performa bulanan untuk klien jasa clipping: dibuka dari link, tanpa login. */
export default function PublicReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<{ report: PerformanceReport; refreshing: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((period?: string) => {
    getPublicReport(decodeURIComponent(token), period).then(setData).catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [token])
  useEffect(() => { load() }, [load])

  if (error) return <p role="alert" className="pt-16 max-w-lg border-l-2 border-tally pl-4 text-ink-muted">{error}</p>
  if (!data) return <ReportSkeleton />
  return <ReportView report={data.report} refreshing={data.refreshing} onPeriod={load} />
}
