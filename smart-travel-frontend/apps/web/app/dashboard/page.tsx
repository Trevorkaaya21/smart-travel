// apps/web/app/dashboard/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { useGuest } from '@/lib/useGuest'

const AiSearch = dynamic(() => import('@/components/search/ai-search'), { ssr: false })

export default function DashboardPage() {
  const { isGuest } = useGuest()

  return (
    <div className="flex h-full flex-col gap-8">
      <header className="content-header">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-[rgb(var(--muted))]">Discover</p>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl text-[rgb(var(--text))]">
              Find the next stop on your dream itinerary
            </h1>
            <p className="max-w-2xl text-sm text-[color-mix(in_oklab,rgb(var(--text))_78%,rgb(var(--muted))_22%)]">
              Smart Travel fuses Google Maps data with AI intent refinement to surface the right places faster. Pin them to trips, save favorites, or keep exploring the world in real time.
            </p>
          </div>
          <div className="content-subtle px-5 py-4 text-xs uppercase tracking-[0.3em] text-[rgb(var(--muted))]">
            {isGuest ? 'Guest mode · read only' : 'Signed in · full workspace'}
          </div>
        </div>
      </header>

      <AiSearch />
    </div>
  )
}
