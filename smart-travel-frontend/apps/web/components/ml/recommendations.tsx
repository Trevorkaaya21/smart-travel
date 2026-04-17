'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, TrendingUp, MapPin, Star, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { API_BASE } from '@/lib/api'
import { cn } from '@/lib/utils'

type MLPlace = {
  id: string
  name: string
  category: string
  rating?: number | null
  lat?: number | null
  lng?: number | null
  photo?: string | null
  score: number
  reason?: string
  source: string
  trend_score?: number
}

async function fetchRecommendations(email: string): Promise<MLPlace[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/ml/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: email, limit: 8, strategy: 'hybrid' }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data?.recommendations ?? []
  } catch {
    return []
  }
}

async function fetchTrending(): Promise<MLPlace[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/ml/trending`)
    if (!res.ok) return []
    const data = await res.json()
    return data?.trending ?? []
  } catch {
    return []
  }
}

function PlaceCard({ place, type }: { place: MLPlace; type: 'recommend' | 'trending' }) {
  const mapsLink = place.lat && place.lng
    ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
    : null

  return (
    <div className="group flex-shrink-0 w-56 overflow-hidden rounded-xl border transition-all hover:translate-y-[-2px] hover:shadow-lg"
      style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}
    >
      <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-[rgb(var(--accent))]/20 to-[rgb(var(--accent-secondary))]/10">
        {place.photo ? (
          <img src={place.photo} alt={place.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <MapPin className="h-8 w-8 text-[rgb(var(--accent))]/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3">
          <p className="text-sm font-semibold text-white truncate">{place.name}</p>
          <p className="text-[10px] text-white/70 truncate">{place.category}</p>
        </div>
        {type === 'recommend' && place.reason && (
          <span className="absolute top-2 left-2 rounded-full bg-[rgb(var(--accent))]/90 px-2 py-0.5 text-[9px] font-medium text-white">
            <Sparkles className="inline h-3 w-3 mr-0.5" />For you
          </span>
        )}
        {type === 'trending' && (
          <span className="absolute top-2 left-2 rounded-full bg-orange-500/90 px-2 py-0.5 text-[9px] font-medium text-white">
            <TrendingUp className="inline h-3 w-3 mr-0.5" />Trending
          </span>
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1 text-xs text-[rgb(var(--muted))]">
          {place.rating && (
            <>
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
              <span>{place.rating}</span>
            </>
          )}
        </div>
        {mapsLink && (
          <a href={mapsLink} target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-[rgb(var(--accent))] hover:underline"
          >
            Map
          </a>
        )}
      </div>
    </div>
  )
}

export function MLRecommendations() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined

  const recQuery = useQuery({
    queryKey: ['ml-recommendations', email],
    queryFn: () => fetchRecommendations(email!),
    enabled: status === 'authenticated' && !!email,
    staleTime: 60_000,
    retry: false,
  })

  const trendQuery = useQuery({
    queryKey: ['ml-trending'],
    queryFn: fetchTrending,
    staleTime: 300_000,
    retry: false,
  })

  const recommendations = recQuery.data ?? []
  const trending = trendQuery.data ?? []

  // Don't render if ML service isn't available
  if (recommendations.length === 0 && trending.length === 0 && !recQuery.isLoading && !trendQuery.isLoading) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Personalized Recommendations */}
      {(recommendations.length > 0 || recQuery.isLoading) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[rgb(var(--accent))]" />
              <h2 className="text-sm font-semibold text-[rgb(var(--text))]">Recommended for you</h2>
              <span className="rounded-full bg-[rgb(var(--accent))]/10 px-2 py-0.5 text-[9px] font-medium text-[rgb(var(--accent))]">
                ML
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => recQuery.refetch()}
              className="h-7 text-xs text-[rgb(var(--muted))]"
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", recQuery.isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {recQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-44 w-56 flex-shrink-0 animate-pulse rounded-xl bg-slate-200 dark:bg-white/5" />
              ))
            ) : (
              recommendations.map(place => (
                <PlaceCard key={place.id} place={place} type="recommend" />
              ))
            )}
          </div>
        </section>
      )}

      {/* Trending Destinations */}
      {(trending.length > 0 || trendQuery.isLoading) && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-[rgb(var(--text))]">Trending destinations</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {trendQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-44 w-56 flex-shrink-0 animate-pulse rounded-xl bg-slate-200 dark:bg-white/5" />
              ))
            ) : (
              trending.map(place => (
                <PlaceCard key={place.id} place={place} type="trending" />
              ))
            )}
          </div>
        </section>
      )}
    </div>
  )
}
