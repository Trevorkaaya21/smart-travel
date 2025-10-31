'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useDefaultTrip } from '@/lib/useDefaultTrip'

export default function CreateRedirectPage() {
  const router = useRouter()
  const { defaultTripId, isLoading } = useDefaultTrip()

  React.useEffect(() => {
    if (!isLoading && defaultTripId) router.replace(`/trip/${defaultTripId}`)
  }, [defaultTripId, isLoading, router])

  return <main className="p-6">Opening your trip…</main>
}