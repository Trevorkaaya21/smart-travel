'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { API_BASE } from '@/lib/api'
import { useDefaultTrip } from '@/lib/useDefaultTrip'
import { Button } from '@/components/ui/button'

type FavsResp = { favorites: { place_id: string }[] }

async function fetchFavorites(email: string) {
  const r = await fetch(`${API_BASE}/v1/favorites?user_email=${encodeURIComponent(email)}`, { cache: 'no-store' })
  if (!r.ok) throw new Error('favorites_load_failed')
  return r.json() as Promise<FavsResp>
}

async function addToTrip(tripId: string, placeId: string, email: string) {
  const r = await fetch(`${API_BASE}/v1/trips/${tripId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ place_id: placeId, day: 1 })
  })
  if (!r.ok) throw new Error('add_failed')
  return r.json()
}

async function removeFavorite(placeId: string, email: string) {
  const r = await fetch(`${API_BASE}/v1/favorites`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ place_id: placeId })
  })
  if (!r.ok) throw new Error('remove_failed')
  return r.json()
}

export default function FavoriteList() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const { defaultTripId, isLoading: tripLoading } = useDefaultTrip()
  const qc = useQueryClient()

  const favsQ = useQuery({
    queryKey: ['favs', email],
    queryFn: () => fetchFavorites(email!),
    enabled: status === 'authenticated' && !!email,
  })

  const addMut = useMutation({
    mutationFn: (placeId: string) => addToTrip(defaultTripId!, placeId, email!),
  })

  const removeMut = useMutation({
    mutationFn: (placeId: string) => removeFavorite(placeId, email!),
    onMutate: async (placeId) => {
      await qc.cancelQueries({ queryKey: ['favs', email] })
      const prev = qc.getQueryData<FavsResp>(['favs', email])
      if (prev) {
        qc.setQueryData<FavsResp>(['favs', email], {
          favorites: prev.favorites.filter(item => item.place_id !== placeId),
        })
      }
      return { prev }
    },
    onError: (_e, placeId, ctx) => {
      if (ctx?.prev) qc.setQueryData(['favs', email], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['favs', email] }),
  })

  if (status !== 'authenticated' || !email) {
    return null
  }

  const favorites = favsQ.data?.favorites ?? []

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Favorites</h2>
      {favsQ.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 w-2/3 rounded bg-white/10" />
              <div className="h-4 w-1/2 rounded bg-white/10 mt-2" />
            </div>
          ))}
        </div>
      )}
      {!favsQ.isLoading && favorites.length === 0 && (
        <div className="card flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm text-[rgb(var(--muted))]">No favorites yet.</p>
          <Link href="/dashboard" className="btn btn-ghost text-xs">Explore Discover</Link>
        </div>
      )}
      <div className="grid gap-2">
        {favorites.map(({ place_id }) => (
          <div key={place_id} className="card">
            <div className="text-sm">
              <div className="font-medium">{place_id}</div>
              <div className="text-xs opacity-70">Saved place</div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  if (!email) return alert('Please sign in.')
                  if (tripLoading || !defaultTripId) return alert('Trip not ready yet—try again.')
                  addMut.mutate(place_id, {
                    onSuccess: () => (window.location.href = `/trip/${defaultTripId}`)
                  })
                }}
                disabled={addMut.isPending || tripLoading}
                className="btn"
              >
                {addMut.isPending ? 'Adding…' : '➕ Add to Trip'}
              </Button>
              <Button
                onClick={() => removeMut.mutate(place_id)}
                disabled={removeMut.isPending}
                className="card"
              >
                {removeMut.isPending ? 'Removing…' : 'Remove'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
