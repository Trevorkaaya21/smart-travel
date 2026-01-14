// apps/web/app/dashboard/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { useGuest } from '@/lib/useGuest'
import { Sparkles } from 'lucide-react'

const AiSearch = dynamic(() => import('@/components/search/ai-search'), { 
  ssr: false,
  loading: () => (
    <div className="content-card animate-pulse">
      <div className="h-32 bg-[rgb(var(--surface-muted))]/50 rounded-2xl" />
    </div>
  )
})

export default function DashboardPage() {
  const { isGuest } = useGuest()

  return (
    <div className="flex h-full flex-col gap-8 animate-fade-in">
      <header className="content-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="ui-liquid-icon">
                <Sparkles className="h-5 w-5 text-[rgb(var(--accent))]" />
              </div>
              <p className="text-xs uppercase tracking-[0.35em] text-[rgb(var(--accent))] font-semibold">Discover</p>
            </div>
            <h1 className="text-3xl font-bold leading-tight md:text-4xl bg-gradient-to-r from-[rgb(var(--accent))] via-[rgb(var(--accent-secondary))] to-[rgb(var(--accent-tertiary))] bg-clip-text text-transparent">
              Find the next stop on your dream itinerary
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[color-mix(in_oklab,rgb(var(--text))_75%,rgb(var(--muted))_25%)]">
              Smart Travel fuses Google Maps data with AI intent refinement to surface the right places faster. Pin them to trips, save favorites, or keep exploring the world in real time.
            </p>
          </div>
          <div className="content-subtle px-5 py-3 text-xs uppercase tracking-[0.3em] font-semibold animate-scale-in"
            style={{
              background: isGuest 
                ? 'linear-gradient(135deg, rgba(var(--warning) / .15), rgba(var(--warning) / .05))'
                : 'linear-gradient(135deg, rgba(var(--success) / .15), rgba(var(--success) / .05))',
              color: isGuest ? 'rgb(var(--warning))' : 'rgb(var(--success))',
              borderColor: isGuest ? 'rgba(var(--warning) / .3)' : 'rgba(var(--success) / .3)'
            }}
          >
            {isGuest ? 'Guest mode · read only' : 'Signed in · full workspace'}
          </div>
        </div>
      </header>

      <AiSearch />
    </div>
  )
}
