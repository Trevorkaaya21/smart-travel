'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { HeartOff, Loader2, MapPin, Compass, Plus, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { API_BASE } from '@/lib/api'
import { stringImageUrl } from '@/lib/utils'
import { TripSelector, useTripSelector } from '@/components/trip/trip-selector'
import { QuickTripCreator } from '@/components/trip/quick-trip-creator'

type Favorite = {
  place_id: string
  created_at: string
  place: {
    id: string
    name: string
    category?: string | null
    rating?: number | null
    lat?: number | null
    lng?: number | null
    photo?: string | null
    photo_credit?: string | null
  } | null
}

type Trip = {
  id: string
  name: string
  start_date?: string | null
  end_date?: string | null
  places_count?: number
  days_count?: number
  image_url?: string | null
}

async function fetchFavorites(email: string) {
  const res = await fetch(`${API_BASE}/v1/favorites?user_email=${encodeURIComponent(email)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('favorites_load_failed')
  const data = await res.json()
  return (data?.favorites as Favorite[]) ?? []
}

async function deleteFavorite(placeId: string, email: string) {
  const res = await fetch(`${API_BASE}/v1/favorites`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ place_id: placeId }),
  })
  if (!res.ok) throw new Error('delete_failed')
  return res.json()
}

export default function FavoritesPage() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const qc = useQueryClient()
  const tripSelector = useTripSelector()
  const [showQuickCreator, setShowQuickCreator] = React.useState(false)
  const [pendingFavorite, setPendingFavorite] = React.useState<Favorite | null>(null)
  const [addingPlaceId, setAddingPlaceId] = React.useState<string | null>(null)

  const favoritesQuery = useQuery({
    queryKey: ['favorites', email],
    queryFn: () => fetchFavorites(email!),
    enabled: status === 'authenticated' && !!email,
  })

  const tripsQuery = useQuery({
    queryKey: ['trips', email],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/trips?owner_email=${encodeURIComponent(email!)}`, { cache: 'no-store' })
      if (!res.ok) return { trips: [] }
      return res.json()
    },
    enabled: status === 'authenticated' && !!email,
  })

  const deleteMut = useMutation({
    mutationFn: (placeId: string) => deleteFavorite(placeId, email!),
    onSuccess: () => {
      toast.success('Removed from favorites')
      qc.invalidateQueries({ queryKey: ['favorites', email] })
    },
    onError: () => toast.error('Could not remove favorite right now.'),
  })

  async function addFavoriteToTrip(fav: Favorite, tripId: string) {
    if (!email || !fav.place) return
    setAddingPlaceId(fav.place_id)
    try {
      const res = await fetch(`${API_BASE}/v1/trips/${tripId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify({
          place_id: fav.place.id,
          day: 1,
          place: {
            id: fav.place.id,
            name: fav.place.name,
            category: fav.place.category ?? 'poi',
            rating: fav.place.rating ?? null,
            lat: fav.place.lat ?? null,
            lng: fav.place.lng ?? null,
            photo: fav.place.photo ?? null,
            photo_credit: fav.place.photo_credit ?? null,
          },
        }),
      })
      if (!res.ok) {
        const raw = await res.text()
        if (/duplicate key/i.test(raw)) {
          toast('Already in this trip', { description: fav.place.name })
          return
        }
        throw new Error(raw || 'Failed to add')
      }
      toast.success('Added to trip', { description: fav.place.name })
      await qc.invalidateQueries({ queryKey: ['trips', email] })
    } catch (err) {
      toast.error('Could not add to trip', { description: err instanceof Error ? err.message : 'Try again' })
    } finally {
      setAddingPlaceId(null)
    }
  }

  async function handleCreateNewTrip(tripData: { name: string; start_date?: string; end_date?: string }) {
    if (!email || !pendingFavorite?.place) return
    try {
      const res = await fetch(`${API_BASE}/v1/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify(tripData),
      })
      if (!res.ok) throw new Error('Failed to create trip')
      const { id: newTripId } = await res.json()
      await addFavoriteToTrip(pendingFavorite, newTripId)
      toast.success('Trip created!', { description: `${tripData.name} with ${pendingFavorite.place.name}` })
      setPendingFavorite(null)
    } catch {
      toast.error('Failed to create trip')
    }
  }

  if (status !== 'authenticated' || !email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="content-card max-w-lg space-y-4">
          <h1 className="text-4xl font-semibold text-[rgb(var(--text))]">Sign in to save places you love</h1>
          <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
            Favorites sync with your trips, so you can add them to itineraries anytime. Connect Google to continue.
          </p>
          <Button
            onClick={() => signIn('google')}
            className="btn btn-primary w-full justify-center rounded-2xl px-5 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-80"
          >
            Sign in with Google
          </Button>
        </div>
      </div>
    )
  }

  const favorites = favoritesQuery.data ?? []
  const rawTrips = tripsQuery.data
  const userTrips: Trip[] = Array.isArray(rawTrips) ? rawTrips : (rawTrips as any)?.trips ?? []

  return (
    <div className="flex h-full flex-col gap-8 text-[rgb(var(--text))]">
      {/* Trip Selector Modal */}
      <TripSelector
        isOpen={tripSelector.isOpen}
        onClose={tripSelector.close}
        onSelectTrip={(tripId) => {
          if (pendingFavorite) {
            addFavoriteToTrip(pendingFavorite, tripId)
            setPendingFavorite(null)
          }
          tripSelector.close()
        }}
        onCreateNew={() => {
          tripSelector.close()
          setShowQuickCreator(true)
        }}
        trips={userTrips}
        placeName={pendingFavorite?.place?.name || ''}
        isLoading={tripsQuery.isLoading}
      />
      <QuickTripCreator
        isOpen={showQuickCreator}
        onClose={() => {
          setShowQuickCreator(false)
          setPendingFavorite(null)
        }}
        onCreate={handleCreateNewTrip}
        placeName={pendingFavorite?.place?.name || ''}
        suggestedName={pendingFavorite?.place?.name ? `Trip to ${pendingFavorite.place.name}` : undefined}
      />

      <header className="content-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-[color-mix(in_oklab,rgb(var(--text))_65%,rgb(var(--muted))_35%)]">
              My favorites
            </p>
            <h1 className="text-3xl font-semibold md:text-4xl">Places you love</h1>
            <p className="max-w-2xl text-sm text-[color-mix(in_oklab,rgb(var(--text))_72%,rgb(var(--muted))_28%)]">
              Your saved restaurants, attractions, and hidden gems. Add them to a trip or keep them for inspiration.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="btn btn-ghost rounded-2xl px-4 py-2 text-sm font-semibold"
          >
            <Compass className="h-4 w-4 text-[rgb(var(--accent))]" />
            Discover more
          </Link>
        </div>
      </header>

      <section className="content-card space-y-6">
        {favoritesQuery.isError ? (
          <div className="content-card flex flex-col items-center gap-4 py-12 text-center">
            <div className="rounded-full p-3" style={{ background: 'rgba(var(--error) / 0.1)' }}>
              <AlertTriangle className="h-6 w-6 text-[rgb(var(--error))]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[rgb(var(--text))]">Something went wrong</h3>
              <p className="mt-1 text-sm text-[rgb(var(--muted))]">We couldn&apos;t load your favorites. Please try again.</p>
            </div>
            <button
              type="button"
              onClick={() => favoritesQuery.refetch()}
              className="btn btn-primary"
            >
              Try again
            </button>
          </div>
        ) : favoritesQuery.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="content-subtle h-60 animate-pulse" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="content-card flex flex-col items-center justify-center gap-4 py-12 text-center text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
            <HeartOff className="h-8 w-8 text-[rgb(var(--accent))]" />
            <p className="max-w-sm text-sm">
              You haven&apos;t saved any places yet. Search for places on Discover and tap the heart to save them here.
            </p>
            <Link
              href="/dashboard"
              className="btn btn-primary rounded-2xl px-4 py-2 text-xs font-semibold"
            >
              <Compass className="h-4 w-4" />
              Start exploring
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {favorites.map((fav) => (
              <FavoriteCard
                key={fav.place_id}
                favorite={fav}
                removing={deleteMut.isPending}
                adding={addingPlaceId === fav.place_id}
                onRemove={() => deleteMut.mutate(fav.place_id)}
                onAddToTrip={() => {
                  setPendingFavorite(fav)
                  tripSelector.open(fav.place)
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function FavoriteCard({
  favorite,
  removing,
  adding,
  onRemove,
  onAddToTrip,
}: {
  favorite: Favorite
  removing: boolean
  adding: boolean
  onRemove: () => void
  onAddToTrip: () => void
}) {
  const place = favorite.place
  const placePhoto = stringImageUrl(place?.photo ?? (place as any)?.photo_url)
  const fallbackImage = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=900&h=600&fit=crop'
  const image = placePhoto ?? fallbackImage
  const mapsLink =
    place?.lat != null && place?.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
      : null

  return (
    <article className="content-card flex h-full flex-col overflow-hidden p-0">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img src={image} alt={place?.name ?? favorite.place_id} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-900/20 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-start justify-between gap-3 text-white">
          <div>
            <div className="text-base font-semibold leading-tight">{place?.name ?? 'Saved place'}</div>
            <div className="text-xs text-white/75">
              {(place?.category ?? 'Point of interest').toString()} {place?.rating ? `• ★ ${place.rating}` : ''}
            </div>
          </div>
          <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/75">
            {new Date(favorite.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="space-y-3 px-5 pb-5 pt-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onAddToTrip}
            disabled={adding}
            className="btn btn-primary rounded-2xl px-4 py-2 text-xs font-semibold"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add to trip
          </button>
          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost rounded-2xl px-4 py-2 text-xs font-semibold"
            >
              <MapPin className="h-3.5 w-3.5 text-[rgb(var(--accent))]" />
              Maps
            </a>
          )}
          <button
            onClick={onRemove}
            disabled={removing}
            aria-label={`Remove ${place?.name ?? 'place'} from favorites`}
            className="btn btn-ghost rounded-2xl px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HeartOff className="h-3.5 w-3.5" />}
            Remove
          </button>
        </div>
      </div>
    </article>
  )
}
