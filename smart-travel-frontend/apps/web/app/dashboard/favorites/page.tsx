'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { HeartOff, Loader2, MapPin, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { API_BASE } from '@/lib/api'

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

  const favoritesQuery = useQuery({
    queryKey: ['favorites', email],
    queryFn: () => fetchFavorites(email!),
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

  if (status !== 'authenticated' || !email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="content-card max-w-lg space-y-4">
          <h1 className="text-4xl font-semibold text-[rgb(var(--text))]">Sign in to save places you love</h1>
          <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
            Favorites sync with your trips, so you can drag them into itineraries anytime. Connect Google to continue.
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

  return (
    <div className="flex h-full flex-col gap-8 text-[rgb(var(--text))]">
      <header className="content-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-[color-mix(in_oklab,rgb(var(--text))_65%,rgb(var(--muted))_35%)]">
              My favorites
            </p>
            <h1 className="text-3xl font-semibold md:text-4xl">Curate the spots you never want to lose</h1>
            <p className="max-w-2xl text-sm text-[color-mix(in_oklab,rgb(var(--text))_72%,rgb(var(--muted))_28%)]">
              Save cafes, museums, nightlife, and hidden gems. Drag them into itineraries later or keep them handy for inspiration.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="btn btn-ghost rounded-2xl px-4 py-2 text-sm font-semibold"
          >
            <Compass className="h-4 w-4 text-[rgb(var(--accent))]" />
            Explore more
          </Link>
        </div>
      </header>

      <section className="content-card space-y-6">
        {favoritesQuery.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="content-subtle h-60 animate-pulse" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="content-card flex flex-col items-center justify-center gap-4 text-center text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
            <HeartOff className="h-8 w-8 text-[rgb(var(--accent))]" />
            <p className="max-w-sm text-sm">
              You haven&apos;t saved any places yet. Visit Discover to add the spots that inspire you.
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
                onRemove={() => deleteMut.mutate(fav.place_id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function FavoriteCard({ favorite, removing, onRemove }: { favorite: Favorite; removing: boolean; onRemove: () => void }) {
  const place = favorite.place
  const image =
    place?.photo ||
    `https://images.unsplash.com/placeholder-photos/extra-large.jpg?auto=format&fit=crop&w=900&q=80`
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

      <div className="space-y-4 px-5 pb-5 pt-4 text-sm text-[color-mix(in_oklab,rgb(var(--text))_72%,rgb(var(--muted))_28%)]">
        <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.25em] text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
          <span>#{(place?.category ?? 'explore').toString().replace(/\s+/g, '')}</span>
          {place?.rating && <span>★ {place.rating}</span>}
        </div>

        <div className="flex flex-wrap gap-3">
          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost rounded-2xl px-4 py-2 text-xs font-semibold"
            >
              <MapPin className="h-4 w-4 text-[rgb(var(--accent))]" />
              Open in Maps
            </a>
          )}
          <button
            onClick={onRemove}
            disabled={removing}
            aria-label={removing ? 'Removing from favorites' : `Remove ${place?.name ?? 'place'} from favorites`}
            className="btn btn-ghost rounded-2xl px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none"
          >
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartOff className="h-4 w-4 text-[rgb(var(--accent))]" />}
            Remove
          </button>
        </div>
      </div>
    </article>
  )
}
