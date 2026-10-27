'use client'

import { Suspense } from 'react'
import TopicsHub from '@/components/longform/TopicsHub'
import RequireAuth from '@/components/RequireAuth'

export default function LongformHubPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <TopicsHub />
      </Suspense>
    </RequireAuth>
  )
}
