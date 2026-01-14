'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Sparkles, Compass, Heart, MapPin } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useDefaultTrip } from '@/lib/useDefaultTrip'
import { useGuest } from '@/lib/useGuest'
import { GoogleMap } from '@/components/map/google-map'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { api, API_BASE } from '@/lib/api'

type Place = {
  id: string
  name: string
  category?: string | null
  rating?: number | null
  lat?: number | null
  lng?: number | null
  photo_url?: string | null
  because?: string
  photo_credit?: string | null
}

const DUPLICATE_RE = /duplicate key/i

const PROMPTS = [
  '3 day foodie adventure in Tokyo',
  'Family friendly weekend in Barcelona',
  'Hidden art galleries in New York',
  'Nightlife hotspots in Berlin',
]

function resolveEmail(sessionEmail?: string | null): string | undefined {
  if (sessionEmail) return sessionEmail
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('st_email')
    if (stored) return stored
  }
  return undefined
}

function extractErrorMessage(raw: string, status: number) {
  if (!raw) return `HTTP ${status}`
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.message === 'string' && parsed.message.length) return parsed.message
    if (typeof parsed?.error === 'string' && parsed.error.length) return parsed.error
  } catch {
    // ignore
  }
  return raw
}

export default function AiSearch() {
  const { isGuest } = useGuest()
  const { defaultTripId, isLoading: tripLoading, error: tripError } = useDefaultTrip()
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const rawEmail = session?.user?.email
  const email = React.useMemo(() => resolveEmail(rawEmail), [rawEmail])
  const [q, setQ] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [items, setItems] = React.useState<Place[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [addingPlaceId, setAddingPlaceId] = React.useState<string | null>(null)
  const [favoritePlaceId, setFavoritePlaceId] = React.useState<string | null>(null)
  const [addedTripIds, setAddedTripIds] = React.useState<Record<string, boolean>>({})
  const [favoriteIds, setFavoriteIds] = React.useState<Record<string, boolean>>({})
  const locationRef = React.useRef<{ lat?: number; lng?: number }>({})
  const cacheRef = React.useRef<Map<string, Place[]>>(new Map())
  const fetchAbortRef = React.useRef<AbortController | null>(null)
  const [isPending, startTransition] = React.useTransition()

  React.useEffect(() => {
    if (email && typeof window !== 'undefined') {
      window.localStorage.setItem('st_email', email)
    }
  }, [email])

  React.useEffect(() => {
    let cancelled = false
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return
        locationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      },
      () => {
        if (!cancelled) locationRef.current = {}
      },
      { maximumAge: 60_000 }
    )

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!email || isGuest) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/favorites?user_email=${encodeURIComponent(email)}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { favorites?: { place_id: string }[] }
        if (cancelled) return
        const next: Record<string, boolean> = {}
        for (const fav of data.favorites ?? []) next[fav.place_id] = true
        setFavoriteIds(next)
      } catch (err) {
        console.warn('Could not load favorites', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [email, isGuest])

  React.useEffect(() => {
    return () => {
      fetchAbortRef.current?.abort()
    }
  }, [])

  async function runSearch(input?: string) {
    const query = (input ?? q).trim()
    if (!query) return
    setQ(query)
    setLoading(true)
    setError(null)
    const normalized = query.toLowerCase()

    const cached = cacheRef.current.get(normalized)
    if (cached) {
      startTransition(() => setItems(cached))
      setLoading(false)
      return
    }

    fetchAbortRef.current?.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller

    try {
      const loc = locationRef.current

      const r = await fetch(api('/v1/ai/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, lat: loc.lat, lng: loc.lng }),
        signal: controller.signal,
      })
      if (!r.ok) {
        const raw = await r.text()
        throw new Error(extractErrorMessage(raw, r.status))
      }
      const data = await r.json()
      const results = Array.isArray(data.items) ? data.items : []
      if (cacheRef.current.size > 8) {
        const iterator = cacheRef.current.keys().next()
        const oldestKey = iterator.value
        if (typeof oldestKey === 'string') {
          cacheRef.current.delete(oldestKey)
        }
      }
      cacheRef.current.set(normalized, results)
      startTransition(() => setItems(results))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not load places.')
    } finally {
      setLoading(false)
    }
  }

  function buildPlacePayload(place: Place) {
    return {
      id: place.id,
      name: place.name,
      category: place.category ?? 'poi',
      rating: place.rating ?? null,
      lat: place.lat ?? null,
      lng: place.lng ?? null,
      photo: (place as any)?.photo ?? place.photo_url ?? null,
      photo_credit: place.photo_credit ?? (place as any)?.photoCredit ?? null,
    }
  }

  async function addToTrip(place: Place) {
    if (addingPlaceId) return
    if (isGuest || !email) {
      toast('Sign in to Smart Travel to add places to trips.')
      return
    }
    if (tripLoading) {
      toast('Trips are still loading. Please wait a moment.')
      return
    }
    if (tripError) {
      toast.error('Could not load your trips. Refresh and try again.')
      return
    }
    if (!defaultTripId) {
      toast('Create or choose a trip first.')
      return
    }

    setAddingPlaceId(place.id)
    try {
      const res = await fetch(`${API_BASE}/v1/trips/${defaultTripId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': email,
        },
        body: JSON.stringify({
          place_id: place.id,
          day: 1,
          place: buildPlacePayload(place),
        }),
      })
      if (!res.ok) {
        const raw = await res.text()
        if (DUPLICATE_RE.test(raw)) {
          toast('Already in this trip', { description: place.name })
          setAddedTripIds((prev) => ({ ...prev, [place.id]: true }))
          return
        }
        throw new Error(extractErrorMessage(raw, res.status))
      }
      toast.success('Added to trip! ✨', { 
        description: place.name,
        duration: 3000,
      })
      setAddedTripIds((prev) => ({ ...prev, [place.id]: true }))
      queryClient.invalidateQueries({ queryKey: ['trip-items', defaultTripId] }).catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['trip', defaultTripId] }).catch(() => {})
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Request failed'
      toast.error('Could not add to trip', { description: message })
    } finally {
      setAddingPlaceId(null)
    }
  }

  async function toggleFavorite(place: Place) {
    if (favoritePlaceId) return
    if (isGuest || !email) {
      toast('Sign in to save favorites.')
      return
    }

    const currentlyFavorite = !!favoriteIds[place.id]
    const method = currentlyFavorite ? 'DELETE' : 'POST'

    setFavoritePlaceId(place.id)
    try {
      const payload: Record<string, unknown> = { place_id: place.id }
      if (!currentlyFavorite) payload.place = buildPlacePayload(place)

      const res = await fetch(`${API_BASE}/v1/favorites`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': email,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const raw = await res.text()
        if (!currentlyFavorite && DUPLICATE_RE.test(raw)) {
          toast('Already in favorites', { description: place.name })
          setFavoriteIds((prev) => ({ ...prev, [place.id]: true }))
          return
        }
        throw new Error(extractErrorMessage(raw, res.status))
      }
      if (currentlyFavorite) {
        toast.success('Removed from favorites', { description: place.name })
        setFavoriteIds((prev) => {
          const next = { ...prev }
          delete next[place.id]
          return next
        })
      } else {
        toast.success('Saved to favorites! ❤️', { 
          description: place.name,
          duration: 3000,
        })
        setFavoriteIds((prev) => ({ ...prev, [place.id]: true }))
      }
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Request failed'
      toast.error('Could not update favorites', { description: message })
    } finally {
      setFavoritePlaceId(null)
    }
  }

  const markers = items
    .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
    .map(p => ({ id: p.id, name: p.name, lat: p.lat!, lng: p.lng! }))

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        <div className="content-card group">
          <div className="flex items-start gap-4">
            <div className="ui-liquid-icon">
              <Sparkles className="h-5 w-5 text-[rgb(var(--accent))]" />
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <h2 className="text-2xl font-bold text-[rgb(var(--text))] mb-2">Discover with Google AI Studio</h2>
                <p className="text-sm leading-relaxed text-[color-mix(in_oklab,rgb(var(--text))_75%,rgb(var(--muted))_25%)]">
                  Ask for vibes, budget, or activities. We refine your idea, surface the best spots, and drop them on the map instantly.
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  runSearch()
                }}
                className="flex flex-col gap-3 md:flex-row"
              >
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder='Try "48 hours in Lisbon for foodies"'
                  className="min-h-[56px] flex-1 rounded-2xl text-base input-surface"
                />
                <Button
                  type="submit"
                  disabled={loading || isPending}
                  className="btn btn-primary min-h-[56px] rounded-2xl px-8 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-60"
                >
                  {loading || isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Searching…
                    </span>
                  ) : (
                    'Search'
                  )}
                </Button>
              </form>
              <div className="flex flex-wrap gap-2 text-xs">
                {PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => runSearch(prompt)}
                    className="group rounded-full border px-4 py-2 font-medium transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      borderColor: 'rgba(var(--border) / .5)',
                      background: 'linear-gradient(165deg, rgba(var(--surface) / .85), rgba(var(--surface-muted) / .7))',
                      color: 'color-mix(in oklab, rgb(var(--text)) 75%, rgb(var(--muted)) 25%)',
                      boxShadow: '0 2px 8px rgba(var(--shadow-color) / .05)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(var(--accent) / .4)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--accent) / .15)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(var(--border) / .5)'
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(var(--shadow-color) / .05)'
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-[rgb(var(--text))] mb-1">Curated results</h3>
              <p className="text-xs uppercase tracking-[0.3em] text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">Tap to enrich your itinerary</p>
            </div>
            <div className="hidden items-center gap-2 text-xs text-[color-mix(in_oklab,rgb(var(--text))_65%,rgb(var(--muted))_35%)] md:flex">
              <Compass className="h-4 w-4 text-[rgb(var(--accent))]" />
              Precision powered by Google Places
            </div>
          </header>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {!items.length && !loading && !isPending ? (
            <div className="content-card p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--accent) / .15), rgba(var(--accent) / .05))',
                  boxShadow: '0 4px 16px rgba(var(--accent) / .1)'
                }}
              >
                <Compass className="h-8 w-8 text-[rgb(var(--accent))]" />
              </div>
              <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
                Search for anywhere in the world and Smart Travel will craft a shortlist of must-see stops.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
              {items.map((p) => (
                <ResultCard
                  key={p.id}
                  place={p}
                  added={!!addedTripIds[p.id]}
                  favorite={!!favoriteIds[p.id]}
                  adding={addingPlaceId === p.id}
                  saving={favoritePlaceId === p.id}
                  onAdd={() => addToTrip(p)}
                  onFavorite={() => toggleFavorite(p)}
                  disableActions={isGuest || !email}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="content-card hidden p-4 xl:flex xl:flex-col">
        <div className="flex items-center gap-3 px-1 pb-3 text-[color-mix(in_oklab,rgb(var(--text))_80%,rgb(var(--muted))_20%)]">
          <MapPin className="h-5 w-5" />
          <div className="text-sm font-medium">Live Map Preview</div>
        </div>
        <GoogleMap markers={markers} />
        <p className="mt-4 text-xs text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
          Drag the map to explore nearby recommendations. Zoom to unlock hyper-local suggestions.
        </p>
      </aside>
    </div>
  )
}

function ResultCard({
  place,
  added,
  favorite,
  adding,
  saving,
  onAdd,
  onFavorite,
  disableActions,
}: {
  place: Place
  added: boolean
  favorite: boolean
  adding: boolean
  saving: boolean
  onAdd: () => void
  onFavorite: () => void
  disableActions: boolean
}) {
  const image =
    (place as any)?.photo ||
    place.photo_url ||
    `https://images.unsplash.com/placeholder-photos/extra-large.jpg?auto=format&fit=crop&w=900&q=80`

  return (
    <div className="group overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{
        borderColor: 'rgba(var(--border) / .5)',
        background: 'linear-gradient(165deg, rgba(var(--surface) / .95), rgba(var(--surface-muted) / .85))',
        boxShadow: '0 8px 24px rgba(var(--shadow-color) / .1)'
      }}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img
          src={image}
          alt={place.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(var(--shadow-color))]/80 via-[rgb(var(--shadow-color))]/20 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold leading-tight text-white mb-1">{place.name}</div>
            <div className="text-xs text-white/80">
              {place.category ?? 'Place'} {place.rating ? `• ★ ${place.rating.toFixed(1)}` : ''}
            </div>
          </div>
          {place.because && (
            <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
              Curated
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 p-5">
        {place.because && (
          <p className="text-sm leading-relaxed text-[color-mix(in_oklab,rgb(var(--text))_75%,rgb(var(--muted))_25%)]">
            {place.because}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={onAdd}
            disabled={disableActions || adding}
            className={cn(
              'btn btn-primary rounded-2xl px-4 py-2 text-xs font-semibold shadow-md hover:shadow-lg transition-all duration-200',
              disableActions && 'cursor-not-allowed opacity-60'
            )}
          >
            {adding ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Adding…
              </span>
            ) : added ? (
              '✓ Added to trip'
            ) : (
              'Add to trip'
            )}
          </Button>
          <Button
            onClick={onFavorite}
            disabled={disableActions || saving}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold transition-all duration-200',
              favorite 
                ? 'border-[rgb(var(--accent))]/40 bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] shadow-md' 
                : 'border-[rgb(var(--border))]/50 bg-[rgb(var(--surface-muted))]/50 text-[color-mix(in_oklab,rgb(var(--text))_75%,rgb(var(--muted))_25%)]',
              disableActions && 'cursor-not-allowed opacity-60'
            )}
          >
            <Heart className={cn('h-4 w-4 transition-all duration-200', favorite ? 'fill-current scale-110' : 'stroke-[1.5]')} />
            {saving ? 'Saving…' : favorite ? 'Favorited' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
