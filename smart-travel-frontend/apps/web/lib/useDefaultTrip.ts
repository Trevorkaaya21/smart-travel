'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { API_BASE } from './api'

async function getOrCreateDefaultTrip(email: string) {
  const res = await fetch(
    `${API_BASE}/v1/trips?owner_email=${encodeURIComponent(email)}`,
    { cache: 'no-store' }
  )
  if (!res.ok) throw new Error('trip_fetch_failed')
  return res.json() as Promise<{ defaultTripId: string }>
}

export function useDefaultTrip() {
  const { data: session } = useSession()
  const email = (session?.user as any)?.email as string | undefined

  const q = useQuery({
    queryKey: ['defaultTrip', email],
    queryFn: () => getOrCreateDefaultTrip(email!),
    enabled: !!email,
  })

  return {
    defaultTripId: (q.data as any)?.defaultTripId as string | undefined,
    isLoading: q.isLoading || (q.fetchStatus === 'fetching' && !q.data),
    isFetching: q.isFetching,
    error: q.error as unknown as Error | null,
  }
}

