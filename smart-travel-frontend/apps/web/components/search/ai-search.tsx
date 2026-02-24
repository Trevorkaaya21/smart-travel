'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Wand2, Compass, Heart, MapPin } from 'lucide-react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useDefaultTrip } from '@/lib/useDefaultTrip'
import { useGuest } from '@/lib/useGuest'
import dynamic from 'next/dynamic'

// Use free OpenStreetMap with Leaflet
const LeafletMap = dynamic(
  () => import('@/components/map/leaflet-map').then((m) => m.LeafletMap),
  { ssr: false }
)
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn, stringImageUrl } from '@/lib/utils'
import { api, API_BASE } from '@/lib/api'
import { TripSelector, useTripSelector } from '@/components/trip/trip-selector'
import { QuickTripCreator } from '@/components/trip/quick-trip-creator'
import { SearchFilters, DEFAULT_FILTERS } from '@/components/search/search-filters'

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

// Removed preset prompts - now using AI-powered autocomplete suggestions

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

type AiSearchProps = { addToTripId?: string }

export default function AiSearch({ addToTripId }: AiSearchProps = {}) {
  const { isGuest } = useGuest()
  const { defaultTripId, isLoading: tripLoading, error: tripError } = useDefaultTrip()
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const rawEmail = session?.user?.email
  const email = React.useMemo(() => resolveEmail(rawEmail), [rawEmail])
  const targetTripId = addToTripId ?? defaultTripId
  const [addToTripName, setAddToTripName] = React.useState<string | null>(null)
  
  // Trip selector state
  const tripSelector = useTripSelector()
  const [showQuickCreator, setShowQuickCreator] = React.useState(false)
  const [pendingPlace, setPendingPlace] = React.useState<Place | null>(null)
  
  // Fetch user trips for selector
  const { data: tripsData, isLoading: tripsLoading } = useQuery({
    queryKey: ['trips', email],
    queryFn: async () => {
      if (!email) return null
      const res = await fetch(`${API_BASE}/v1/trips?owner_email=${encodeURIComponent(email)}`, { 
        cache: 'no-store',
      })
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!email && !isGuest,
    staleTime: 0,
    gcTime: 0,
  })
  
  const userTrips = tripsData?.trips || []

  React.useEffect(() => {
    if (!addToTripId || !email) return
    let cancelled = false
    fetch(`${API_BASE}/v1/trips/${addToTripId}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { trip?: { name?: string } } | null) => {
        if (cancelled || !data?.trip?.name) return
        setAddToTripName(data.trip.name)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [addToTripId, email])
  const [q, setQ] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [items, setItems] = React.useState<Place[]>([])
  const [allItems, setAllItems] = React.useState<Place[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [addingPlaceId, setAddingPlaceId] = React.useState<string | null>(null)
  const [favoritePlaceId, setFavoritePlaceId] = React.useState<string | null>(null)
  const [addedTripIds, setAddedTripIds] = React.useState<Record<string, boolean>>({})
  const [favoriteIds, setFavoriteIds] = React.useState<Record<string, boolean>>({})
  const [filters, setFilters] = React.useState(DEFAULT_FILTERS)
  const locationRef = React.useRef<{ lat?: number; lng?: number }>({})
  const cacheRef = React.useRef<Map<string, Place[]>>(new Map())
  const fetchAbortRef = React.useRef<AbortController | null>(null)
  const [isPending, startTransition] = React.useTransition()
  
  // Autocomplete suggestions state
  const [suggestions, setSuggestions] = React.useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = React.useState(-1)
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(false)
  const suggestionsAbortRef = React.useRef<AbortController | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

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
      ; (async () => {
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
      suggestionsAbortRef.current?.abort()
    }
  }, [])

  // Debounced suggestions fetch
  React.useEffect(() => {
    const trimmed = q.trim()
    
    // Don't fetch suggestions if query is too short or user is selecting from dropdown
    if (trimmed.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    // Abort previous request
    suggestionsAbortRef.current?.abort()
    const controller = new AbortController()
    suggestionsAbortRef.current = controller

    // Debounce: wait 400ms after user stops typing
    const timeoutId = setTimeout(async () => {
      if (controller.signal.aborted) return
      
      setLoadingSuggestions(true)
      try {
        const loc = locationRef.current
        const res = await fetch(api('/v1/ai/search/suggestions'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: trimmed, lat: loc.lat, lng: loc.lng }),
          signal: controller.signal,
        })
        
        if (!res.ok || controller.signal.aborted) return
        
        const data = await res.json()
        if (controller.signal.aborted) return
        
        const suggestionsList = Array.isArray(data.suggestions) ? data.suggestions : []
        setSuggestions(suggestionsList)
        setShowSuggestions(suggestionsList.length > 0)
        setSelectedSuggestionIndex(-1)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.warn('Failed to fetch suggestions', err)
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSuggestions(false)
        }
      }
    }, 400)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [q])

  async function runSearch(input?: string) {
    const query = (input ?? q).trim()
    if (!query) return
    setQ(query)
    setShowSuggestions(false) // Hide suggestions when searching
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
      setAllItems(results)
      startTransition(() => setItems(results))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not load places.')
    } finally {
      setLoading(false)
    }
  }

  // Handle keyboard navigation for suggestions
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        runSearch()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
          runSearch(suggestions[selectedSuggestionIndex])
        } else {
          runSearch()
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  function handleSuggestionClick(suggestion: string) {
    runSearch(suggestion)
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

  // Apply filters to results
  React.useEffect(() => {
    let filtered = [...allItems]

    // Category filter
    if (filters.category.length > 0) {
      filtered = filtered.filter(place => 
        filters.category.some(cat => 
          place.category?.toLowerCase().includes(cat.toLowerCase())
        )
      )
    }

    // Rating filter
    if (filters.rating !== null) {
      filtered = filtered.filter(place => 
        place.rating !== null && place.rating !== undefined && place.rating >= filters.rating!
      )
    }

    // Has photos filter
    if (filters.hasPhotos) {
      filtered = filtered.filter(place => place.photo_url !== null && place.photo_url !== undefined)
    }

    // Sort
    switch (filters.sortBy) {
      case 'rating':
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0))
        break
      case 'distance':
        // Would need coordinates to implement distance sorting
        break
      case 'popular':
        // Could sort by rating count or other popularity metric
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0))
        break
      // 'relevance' is default order from API
    }

    setItems(filtered)
  }, [allItems, filters])

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS)
  }
  
  const handleApplyFilters = () => {
    // Force re-apply filters by triggering a search refresh
    if (allItems.length > 0) {
      toast.success('Filters applied', { description: `Showing ${items.length} of ${allItems.length} places` })
    }
  }

  async function addToTrip(place: Place) {
    if (addingPlaceId) return
    if (isGuest || !email) {
      toast('Sign in to Smart Travel to add places to trips.')
      return
    }
    
    // If there's a specific trip ID (from addToTripId prop), use it directly
    if (addToTripId) {
      await addPlaceToTrip(place, addToTripId)
      return
    }
    
    // Otherwise, show trip selector
    setPendingPlace(place)
    tripSelector.open(place)
  }
  
  async function addPlaceToTrip(place: Place, tripId: string) {
    if (addingPlaceId) return
    
    setAddingPlaceId(place.id)
    try {
      const res = await fetch(`${API_BASE}/v1/trips/${tripId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': email!,
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
      toast.success('Added to trip', {
        description: place.name,
        duration: 3000,
      })
      setAddedTripIds((prev) => ({ ...prev, [place.id]: true }))
      
      // Invalidate all trip-related queries to refresh data everywhere
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trip-items', tripId] }),
        queryClient.invalidateQueries({ queryKey: ['trip', tripId] }),
        queryClient.invalidateQueries({ queryKey: ['trips', email] }),
        queryClient.invalidateQueries({ queryKey: ['trips'] }), // Invalidate all trips queries
      ])
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Request failed'
      toast.error('Could not add to trip', { description: message })
    } finally {
      setAddingPlaceId(null)
    }
  }
  
  async function handleCreateNewTrip(tripData: { name: string; start_date?: string; end_date?: string }) {
    if (!email || !pendingPlace) return
    
    try {
      // Create the trip
      const res = await fetch(`${API_BASE}/v1/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': email,
        },
        body: JSON.stringify(tripData),
      })
      
      if (!res.ok) throw new Error('Failed to create trip')
      
      const { id: newTripId } = await res.json()
      
      // Add the place to the new trip
      await addPlaceToTrip(pendingPlace, newTripId)
      
      toast.success('Trip created!', {
        description: `${tripData.name} with ${pendingPlace.name}`,
      })
      
      setPendingPlace(null)
    } catch (error) {
      toast.error('Failed to create trip', {
        description: 'Please try again',
      })
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

  const suggestionsOpen = showSuggestions && suggestions.length > 0
  const DROPDOWN_MAX_H = 260

  return (
    <div className="space-y-6">
      {addToTripId && (
        <div
          className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
          style={{
            background: 'rgba(var(--accent) / 0.08)',
            borderColor: 'rgba(var(--accent) / 0.25)',
            color: 'rgb(var(--text))',
          }}
        >
          <span className="font-medium">Adding places to:</span>
          <span className="truncate">{addToTripName ?? '…'}</span>
        </div>
      )}
      
      {/* Trip Selector Modal */}
      {!addToTripId && (
        <>
          <TripSelector
            isOpen={tripSelector.isOpen}
            onClose={tripSelector.close}
            onSelectTrip={(tripId) => {
              if (pendingPlace) {
                addPlaceToTrip(pendingPlace, tripId)
                setPendingPlace(null)
              }
            }}
            onCreateNew={() => {
              tripSelector.close()
              setShowQuickCreator(true)
            }}
            trips={userTrips}
            placeName={pendingPlace?.name || ''}
            currentTripId={defaultTripId}
            isLoading={tripsLoading}
          />
          
          <QuickTripCreator
            isOpen={showQuickCreator}
            onClose={() => {
              setShowQuickCreator(false)
              setPendingPlace(null)
            }}
            onCreate={handleCreateNewTrip}
            placeName={pendingPlace?.name || ''}
            suggestedName={pendingPlace?.name ? `Trip to ${pendingPlace.name}` : undefined}
          />
        </>
      )}
      
      {/* Search Section - reserves space for dropdown so it never overlaps content below */}
      <div className="content-card">
        <div className="flex items-start gap-4">
          <div className="ui-liquid-icon">
            <Wand2 className="h-5 w-5 text-[rgb(var(--accent))]" />
          </div>
          <div className="space-y-4 flex-1 min-w-0">
            <div>
              <h2 className="text-2xl font-bold text-[rgb(var(--text))] mb-2">AI-Powered Travel Discovery</h2>
              <p className="text-sm leading-relaxed text-[rgb(var(--muted))]">
                Describe your perfect trip and our AI finds the best spots instantly. From hidden gems to must-see landmarks.
              </p>
            </div>
            {/* When suggestions are open, reserve space so dropdown stays inside card and Curated results stay below */}
            <div
              className="relative transition-[padding] duration-200 ease-out"
              style={{ paddingBottom: suggestionsOpen ? DROPDOWN_MAX_H : 0 }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  runSearch()
                }}
                className="flex flex-col gap-3 md:flex-row"
              >
                <div className="relative flex-1 min-w-0">
                  <Input
                    ref={inputRef}
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value)
                      setShowSuggestions(true)
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true)
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowSuggestions(false), 200)
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder='Search for anything: "clubs in Miami", "sushi tokyo", "beach resorts bali"'
                    className="min-h-[56px] flex-1 rounded-2xl text-base input-surface pr-12 w-full"
                    autoComplete="off"
                  />
                  {loadingSuggestions && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
                    </div>
                  )}

                  {/* Autocomplete Suggestions - contained height, scrollable, no overlap */}
                  {suggestionsOpen && (
                    <div
                      className="absolute left-0 right-0 z-50 mt-2 w-full rounded-2xl border backdrop-blur-xl shadow-xl"
                      style={{
                        borderColor: 'rgba(var(--border) / 0.5)',
                        background: 'var(--glass-bg)',
                        maxHeight: DROPDOWN_MAX_H,
                        overflowY: 'auto',
                      }}
                    >
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setSelectedSuggestionIndex(index)}
                          className={cn(
                            'w-full px-4 py-3 text-left text-sm transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl',
                            index === selectedSuggestionIndex
                              ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]'
                              : 'text-[rgb(var(--text))] hover:bg-[rgb(var(--accent))]/10'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Wand2 className="h-4 w-4 shrink-0 opacity-60" />
                            <span className="truncate">{suggestion}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={loading || isPending}
                  className="btn btn-primary min-h-[56px] rounded-2xl px-8 text-base font-semibold transition-all duration-200 disabled:opacity-60 shrink-0"
                >
                  {loading || isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70" />
                      Searching…
                    </span>
                  ) : (
                    'Search'
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Results Section - clear separation, never covered by dropdown */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]" role="region" aria-label="Search results">
        <section className="space-y-4">
          {/* Search Filters */}
          {allItems.length > 0 && (
            <SearchFilters
              filters={filters}
              onChange={setFilters}
              onReset={handleResetFilters}
              onApply={handleApplyFilters}
              resultsCount={items.length}
            />
          )}
          
          <header className="flex items-center justify-between pt-1">
            <div>
              <h3 className="text-xl font-bold text-[rgb(var(--text))] mb-1">Results</h3>
              <p className="text-xs uppercase tracking-[0.3em] text-[rgb(var(--muted))]">Explore and add to your trip</p>
            </div>
            {items.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                <Compass className="h-4 w-4 text-[rgb(var(--accent))]" />
                {items.length} places
              </div>
            )}
          </header>

          {error && (
            <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(var(--error) / 0.4)', background: 'rgba(var(--error) / 0.1)', color: 'rgb(var(--error))' }}>
              {error}
            </div>
          )}

          {!items.length && !loading && !isPending ? (
            <div className="content-card p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ borderWidth: 1, borderColor: 'rgba(var(--accent) / 0.25)', background: 'rgba(var(--accent) / 0.1)' }}>
                <Compass className="h-8 w-8 text-[rgb(var(--accent))]" />
              </div>
              <p className="text-sm text-[rgb(var(--muted))]">
                Search anywhere and discover amazing places.
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

        {/* Map Section - Only show when there are results */}
        {markers.length > 0 && (
          <aside className="content-card hidden p-4 xl:flex xl:flex-col">
            <div className="flex items-center gap-3 px-1 pb-3 text-[rgb(var(--muted))]">
              <MapPin className="h-5 w-5 text-[rgb(var(--accent))]" />
              <div className="text-sm font-medium">Map View</div>
            </div>
            <DiscoverMapWithFallback markers={markers} />
            <p className="mt-4 text-xs text-[rgb(var(--muted))]">
              {markers.length} {markers.length === 1 ? 'location' : 'locations'} shown on map
            </p>
          </aside>
        )}
      </div>
    </div>
  )
}

type MapMarker = { id: string; name: string; lat?: number | null; lng?: number | null }

function DiscoverMapWithFallback({ markers }: { markers: MapMarker[] }) {
  // Use free OpenStreetMap with Leaflet by default
  return <LeafletMap markers={markers} />
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
  const rawImage = (place as any)?.photo ?? place.photo_url
  const photoCredit = (place as any)?.photo_credit || null
  const image =
    stringImageUrl(rawImage) ??
    `https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=900&q=80`

  return (
    <div className="group overflow-hidden rounded-2xl border backdrop-blur-sm transition-all duration-200 hover:translate-y-[-2px]" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[rgb(var(--surface-muted))]">
        <img
          src={image}
          alt={place.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          onError={(e) => {
            // Fallback if image fails to load
            e.currentTarget.src = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=900&q=80'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {photoCredit && (
          <div className="absolute top-2 right-2 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-medium text-white/80 backdrop-blur-sm">
            {photoCredit.replace('Photo by ', '').replace(' on Unsplash', '').replace(' on Pexels', '')}
          </div>
        )}
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
          <p className="text-sm leading-relaxed text-[rgb(var(--muted))]">
            {place.because}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={onAdd}
            disabled={disableActions || adding}
            className={cn(
              'btn btn-primary rounded-2xl px-4 py-2 text-xs font-semibold transition-all duration-200',
              disableActions && 'cursor-not-allowed opacity-60'
            )}
          >
            {adding ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70" />
                Adding…
              </span>
            ) : added ? (
              '✓ Added'
            ) : (
              'Add to trip'
            )}
          </Button>
          <Button
            onClick={onFavorite}
            disabled={disableActions || saving}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold transition-all duration-200',
              favorite && 'shadow-md',
              !favorite && 'border-[rgb(var(--border))]/30 bg-[var(--glass-bg)] text-[rgb(var(--muted))] hover:border-[rgb(var(--border))]/50 hover:bg-[var(--glass-bg-hover)]',
              disableActions && 'cursor-not-allowed opacity-60'
            )}
            style={favorite ? { borderColor: 'rgba(var(--accent) / 0.4)', background: 'rgba(var(--accent) / 0.15)', color: 'rgb(var(--accent))' } : undefined}
          >
            <Heart className={cn('h-4 w-4 transition-all duration-200', favorite ? 'fill-current scale-110' : 'stroke-[1.5]')} />
            {saving ? 'Saving…' : favorite ? 'Saved' : 'Save'}
          </Button>
          {place.lat && place.lng && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-[rgb(var(--border))]/30 bg-[var(--glass-bg)] px-4 py-2 text-xs font-semibold text-[rgb(var(--muted))] transition-all duration-200 hover:border-[rgb(var(--border))]/50 hover:bg-[var(--glass-bg-hover)]"
            >
              <MapPin className="h-4 w-4" />
              Open in Maps
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
