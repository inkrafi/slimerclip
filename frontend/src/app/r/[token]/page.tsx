'use client'

import { use } from 'react'
import ClientReview from '@/components/review/ClientReview'

/** Halaman review untuk klien jasa clipping: dibuka dari link, tanpa login. */
export default function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  return <ClientReview token={decodeURIComponent(token)} />
}
