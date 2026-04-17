'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'

const AiSearch = dynamic(() => import('@/components/search/ai-search'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[rgb(var(--bg))]">
      <div className="h-8 w-8 border-2 border-[rgb(var(--accent))] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const addToTripId = searchParams.get('addToTrip') ?? undefined

  return (
    <div className="-m-6 md:-m-8 relative overflow-hidden rounded-2xl" style={{ minHeight: 'calc(100dvh - 6rem)' }}>
      <AiSearch addToTripId={addToTripId} overlayMode />
    </div>
  )
}
