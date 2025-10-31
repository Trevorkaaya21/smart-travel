'use client'

import * as React from 'react'
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

  const items = favsQ.data?.favorites ?? []

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Favorites</h2>
      {favsQ.isLoading && (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4">Loading favorites…</div>
      )}
      {!favsQ.isLoading && items.length === 0 && (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4">No favorites yet.</div>
      )}
      <div className="grid gap-2">
        {items.map(({ place_id }) => (
          <div key={place_id} className="rounded-2xl border border-white/15 bg-white/5 p-3 flex items-center justify-between">
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
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-1 text-sm"
              >
                {addMut.isPending ? 'Adding…' : '➕ Add to Trip'}
              </Button>
              <Button
                onClick={() => removeMut.mutate(place_id)}
                disabled={removeMut.isPending}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-sm"
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
