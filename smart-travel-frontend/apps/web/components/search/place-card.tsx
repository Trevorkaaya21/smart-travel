// apps/web/components/search/place-card.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, API_BASE } from '@/lib/api'

type Place = {
  id: string
  name: string
  category?: string | null
  rating?: number | null
  lat?: number | null
  lng?: number | null
  photo?: string | null
  photo_url?: string | null
  photo_credit?: string | null
  photoCredit?: string | null
  because?: string | null
}

const DUPLICATE_RE = /duplicate key/i

function resolveEmail(sessionEmail?: string | null): string | undefined {
  if (sessionEmail) return sessionEmail
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('st_email')
    if (stored) return stored
  }
  return undefined
}

function buildPlacePayload(place: Place) {
  return {
    id: place.id,
    name: place.name,
    category: place.category ?? 'poi',
    rating: place.rating ?? null,
    lat: place.lat ?? null,
    lng: place.lng ?? null,
    photo: place.photo ?? place.photo_url ?? null,
    photo_credit: place.photo_credit ?? place.photoCredit ?? null,
  }
}

function extractErrorMessage(raw: string, status: number) {
  if (!raw) return `HTTP ${status}`
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.message === 'string' && parsed.message.length) return parsed.message
    if (typeof parsed?.error === 'string' && parsed.error.length) return parsed.error
  } catch {
    // ignore JSON parse issues; fall through to raw text
  }
  return raw
}

export function PlaceCard({ place, defaultTripId }: { place: Place; defaultTripId?: string }) {
  const { data: session } = useSession()
  const email = useMemo(() => resolveEmail(session?.user?.email), [session?.user?.email])
  const [adding, setAdding] = useState(false)
  const [savedFavorite, setSavedFavorite] = useState(false)
  const [savingFavorite, setSavingFavorite] = useState(false)
  const [addedToTrip, setAddedToTrip] = useState(false)

  const placePayload = useMemo(() => buildPlacePayload(place), [place])

  useEffect(() => {
    if (email && typeof window !== 'undefined') {
      window.localStorage.setItem('st_email', email)
    }
  }, [email])

  async function addToTrip() {
    if (adding) return
    if (!email) {
      toast('Please sign in to add places.')
      return
    }
    if (!defaultTripId) {
      toast('Create or choose a trip first.')
      return
    }

    setAdding(true)
    try {
      const res = await fetch(api(`/v1/trips/${defaultTripId}/items`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': email,
        },
        body: JSON.stringify({
          place_id: place.id,
          day: 1,
          place: placePayload,
        }),
      })
      if (!res.ok) {
        const raw = await res.text()
        if (DUPLICATE_RE.test(raw)) {
          toast('Already in this trip', { description: place.name })
          setAddedToTrip(true)
          return
        }
        throw new Error(extractErrorMessage(raw, res.status))
      }
      toast.success('Added to your trip', { description: place.name })
      setAddedToTrip(true)
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Request failed'
      toast.error('Could not add to trip', { description: message })
    } finally {
      setAdding(false)
    }
  }

  async function toggleFavorite() {
    if (savingFavorite) return
    if (!email) {
      toast('Please sign in to save favorites.')
      return
    }

    const alreadySaved = savedFavorite
    const method = alreadySaved ? 'DELETE' : 'POST'

    const payload: Record<string, unknown> = { place_id: place.id }
    if (!alreadySaved) payload.place = placePayload

    setSavingFavorite(true)
    try {
      const res = await fetch(api('/v1/favorites'), {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': email,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const raw = await res.text()
        if (!alreadySaved && DUPLICATE_RE.test(raw)) {
          toast('Already in favorites', { description: place.name })
          setSavedFavorite(true)
          return
        }
        throw new Error(extractErrorMessage(raw, res.status))
      }

      if (alreadySaved) {
        toast.success('Removed from favorites', { description: place.name })
        setSavedFavorite(false)
      } else {
        toast.success('Saved to favorites', { description: place.name })
        setSavedFavorite(true)
      }
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Request failed'
      toast.error('Could not update favorites', { description: message })
    } finally {
      setSavingFavorite(false)
    }
  }

  const hasBuiltInPhoto =
    (typeof place.photo === 'string' && place.photo.length > 0) ||
    (typeof place.photo_url === 'string' && place.photo_url.length > 0)
  const heroImage =
    typeof place.photo === 'string' && place.photo.length > 0
      ? place.photo
      : typeof place.photo_url === 'string' && place.photo_url.length > 0
        ? place.photo_url
        : null

  const { data: placeImage } = useQuery({
    queryKey: ['place-image', place.name],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/v1/place-image?q=${encodeURIComponent(place.name)}`
      )
      if (!res.ok) return null
      const d = await res.json()
      return d?.url ? { url: d.url, credit: d.credit } : null
    },
    enabled: !hasBuiltInPhoto && !!place.name?.trim(),
    staleTime: 1000 * 60 * 60,
  })

  const displayImage = heroImage ?? placeImage?.url ?? null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden backdrop-blur-xl">
      {displayImage && (
        <div className="relative">
          <img src={displayImage} alt={place.name} className="h-40 w-full object-cover" />
          {placeImage?.credit && (
            <p className="absolute bottom-1 right-1 text-[10px] text-white/80 drop-shadow-md">
              {placeImage.credit}
            </p>
          )}
        </div>
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{place.name}</h3>
          {place.rating ? <span className="text-xs opacity-70">⭐ {place.rating}</span> : null}
        </div>
        {place.because ? <p className="text-xs opacity-70">{place.because}</p> : null}
        <div className="flex gap-2 pt-2">
          <button
            onClick={addToTrip}
            className="rounded-xl border border-white/15 px-3 py-1 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={adding}
          >
            {adding ? 'Adding…' : addedToTrip ? 'Added' : 'Add to Trip'}
          </button>
          <button
            onClick={toggleFavorite}
            className="rounded-xl border border-white/15 px-3 py-1 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={savingFavorite}
          >
            {savingFavorite ? 'Saving…' : savedFavorite ? 'Saved' : 'Favorite'}
          </button>
        </div>
      </div>
    </div>
  )
}
