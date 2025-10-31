// apps/web/app/dashboard/page.tsx
'use client'

import dynamic from 'next/dynamic'

// Avoid SSR for components that use window/map libs
const AiSearch = dynamic(() => import('@/components/search/ai-search'), { ssr: false })

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Discover</h1>
        <p className="text-sm opacity-70">
          Search places with AI and add them straight to your trip.
        </p>
      </header>

      {/* AI Search (search box + small map + results grid) */}
      <AiSearch />
    </div>
  )
}