'use client'

import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { API_BASE } from '@/lib/configure'

async function fetchTrip(id: string) {
  const r = await fetch(`${API_BASE}/v1/trips/${id}`, { cache: 'no-store' })
  if (!r.ok) throw new Error('trip_load_failed')
  return r.json()
}
async function fetchItems(id: string) {
  const r = await fetch(`${API_BASE}/v1/trips/${id}/items`, { cache: 'no-store' })
  if (!r.ok) throw new Error('items_load_failed')
  return r.json()
}
async function removeItem(id: string, itemId: string, email: string) {
  const r = await fetch(`${API_BASE}/v1/trips/${id}/items/${itemId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email }
  })
  if (!r.ok) throw new Error('delete_failed')
  return r.json()
}

export default function TripClient({ tripId }: { tripId: string }) {
  const { data: session } = useSession()
  const email = (session?.user as any)?.email as string | undefined

  const qc = useQueryClient()
  const tripQ = useQuery({ queryKey: ['trip', tripId], queryFn: () => fetchTrip(tripId) })
  const itemsQ = useQuery({ queryKey: ['trip-items', tripId], queryFn: () => fetchItems(tripId) })

  const delMut = useMutation({
    mutationFn: (itemId: string) => removeItem(tripId, itemId, email!),
    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: ['trip-items', tripId] })
      const prev = qc.getQueryData<any>(['trip-items', tripId])
      qc.setQueryData(['trip-items', tripId], {
        items: (prev?.items ?? []).filter((x: any) => x.id !== itemId)
      })
      return { prev }
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(['trip-items', tripId], ctx.prev) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['trip-items', tripId] })
  })

  if (tripQ.isLoading || itemsQ.isLoading) return <div className="p-6">Loading trip…</div>
  if (tripQ.error || itemsQ.error) return <div className="p-6 text-red-400">Couldn’t load trip.</div>

  const trip = tripQ.data.trip
  const items = itemsQ.data.items as any[]

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{trip.name}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.length === 0 && <div className="opacity-70">No items yet. Add from search.</div>}
        {items.map((it) => (
          <div key={it.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{it.name ?? it.place_id}</div>
                <div className="text-xs uppercase opacity-70">
                  {it.category ?? 'poi'} · {it.rating ? Number(it.rating).toFixed(1) : '—'}
                </div>
              </div>
              <button
                onClick={() => {
                  if (!email) return alert('Please sign in.')
                  delMut.mutate(it.id)
                }}
                className="btn"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
