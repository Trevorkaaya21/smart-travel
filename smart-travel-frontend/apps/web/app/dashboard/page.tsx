// apps/web/app/dashboard/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useGuest } from '@/lib/useGuest'
import { Compass } from 'lucide-react'

const AiSearch = dynamic(() => import('@/components/search/ai-search'), {
  ssr: false,
  loading: () => (
    <div className="content-card animate-pulse">
      <div className="h-32 rounded-2xl bg-white/10" />
    </div>
  )
})

const MLRecommendations = dynamic(
  () => import('@/components/ml/recommendations').then(m => ({ default: m.MLRecommendations })),
  { ssr: false }
)

export default function DashboardPage() {
  const { isGuest } = useGuest()
  const searchParams = useSearchParams()
  const addToTripId = searchParams.get('addToTrip') ?? undefined

  return (
    <div className="flex h-full flex-col gap-8 animate-fade-in">
      <header className="content-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="ui-liquid-icon">
                <Compass className="h-5 w-5 text-[rgb(var(--accent))]" />
              </div>
              <p className="text-xs uppercase tracking-[0.35em] font-semibold text-[rgb(var(--accent))]">Discover</p>
            </div>
            <h1 className="text-3xl font-bold leading-tight text-[rgb(var(--text))] md:text-4xl">
              Find the next stop on your dream itinerary
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[rgb(var(--muted))]">
              ML-powered place discovery with semantic search. Find restaurants, clubs, hotels, and attractions anywhere.
            </p>
          </div>
          <div
            className="content-subtle inline-flex w-fit px-4 py-2 text-xs font-semibold uppercase tracking-wider animate-scale-in"
            style={{
              background: isGuest ? 'rgba(var(--warning) / 0.12)' : 'rgba(var(--success) / 0.12)',
              color: isGuest ? 'rgb(var(--warning))' : 'rgb(var(--success))',
              borderColor: isGuest ? 'rgba(var(--warning) / 0.35)' : 'rgba(var(--success) / 0.35)',
            }}
          >
            {isGuest ? 'Guest mode · read only' : 'Signed in · full workspace'}
          </div>
        </div>
      </header>

      {/* ML-Powered Recommendations & Trending */}
      <MLRecommendations />

      <AiSearch addToTripId={addToTripId} />
    </div>
  )
}
