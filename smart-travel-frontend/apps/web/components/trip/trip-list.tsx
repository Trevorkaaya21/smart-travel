'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { API_BASE } from '@/lib/configure'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Trip = {
  id: string
  name: string | null
  owner_email: string | null
  is_public?: boolean | null
  share_id?: string | null
  created_at?: string | null
}

type TripsResp = {
  defaultTripId: string
  trips: Trip[]
}

type TripItem = {
  id: string
  place_id: string
  day: number | null
  note: string | null
  created_at: string
  places?: { name?: string | null; category?: string | null; rating?: number | null } | null
}

function formatAgo(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

async function fetchTrips(email: string) {
  const r = await fetch(`${API_BASE}/v1/trips?owner_email=${encodeURIComponent(email)}`, { cache: 'no-store' })
  if (!r.ok) throw new Error('trips_load_failed')
  return r.json() as Promise<TripsResp>
}

async function fetchTripItems(tripId: string) {
  const r = await fetch(`${API_BASE}/v1/trips/${tripId}/items`, { cache: 'no-store' })
  if (!r.ok) throw new Error('items_load_failed')
  return r.json() as Promise<{ items: TripItem[] }>
}

async function createTrip(name: string, email: string) {
  const r = await fetch(`${API_BASE}/v1/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ name }),
  })
  if (!r.ok) throw new Error('create_failed')
  return r.json() as Promise<{ id: string }>
}

async function renameTrip(id: string, name: string, email: string) {
  const r = await fetch(`${API_BASE}/v1/trips/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ name }),
  })
  if (!r.ok) throw new Error('rename_failed')
  return r.json() as Promise<{ ok: true; name: string }>
}

async function deleteTrip(id: string, email: string) {
  const r = await fetch(`${API_BASE}/v1/trips/${id}`, {
    method: 'DELETE',
    headers: { 'x-user-email': email },
  })
  if (!r.ok) throw new Error('delete_failed')
  return r.json() as Promise<{ ok: true }>
}

async function duplicateTrip(sourceId: string, sourceName: string, email: string) {
  const itemsResp = await fetchTripItems(sourceId)
  const newTrip = await createTrip(`Copy of ${sourceName || 'Trip'}`, email)

  const batches: TripItem[][] = []
  const size = 8
  for (let i = 0; i < itemsResp.items.length; i += size) {
    batches.push(itemsResp.items.slice(i, i + size))
  }
  for (const batch of batches) {
    await Promise.all(
      batch.map((it) =>
        fetch(`${API_BASE}/v1/trips/${newTrip.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-email': email },
          body: JSON.stringify({ place_id: it.place_id, day: it.day ?? 1, note: it.note ?? '' }),
        })
      )
    )
  }

  return newTrip
}

function useTripMeta(tripId: string) {
  return useQuery({
    queryKey: ['trip-meta', tripId],
    queryFn: async () => {
      const { items } = await fetchTripItems(tripId)
      const count = items.length
      const last = items.reduce<string | null>((acc, it) => {
        if (!acc) return it.created_at
        return new Date(it.created_at) > new Date(acc) ? it.created_at : acc
      }, null)
      return { count, lastUpdated: last }
    },
  })
}

function TripMetaRow({ tripId }: { tripId: string }) {
  const metaQ = useTripMeta(tripId)
  return (
    <>
      <span className="text-xs opacity-70">
        {metaQ.isLoading ? '… items' : `${metaQ.data?.count ?? 0} items`}
      </span>
      <span className="text-xs opacity-50">·</span>
      <span className="text-xs opacity-70">
        updated {metaQ.isLoading ? '…' : formatAgo(metaQ.data?.lastUpdated)}
      </span>
    </>
  )
}

function TripRowActions({ trip, email }: { trip: Trip; email: string }) {
  const qc = useQueryClient()

  const toggleShareMut = useMutation({
    mutationFn: async (makePublic: boolean) => {
      const r = await fetch(`${API_BASE}/v1/trips/${trip.id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify({ make_public: makePublic }),
      })
      if (!r.ok) throw new Error('share_toggle_failed')
      return r.json() as Promise<{ is_public: boolean; share_id: string | null }>
    },
    onMutate: async (makePublic) => {
      await qc.cancelQueries()
      const snapshots = qc.getQueriesData<TripsResp>({ queryKey: ['trips'] })
        .map(([k, v]) => [k, structuredClone(v)] as const)
      const patch = (resp?: TripsResp) =>
        resp ? { ...resp, trips: resp.trips.map(t => t.id === trip.id ? { ...t, is_public: makePublic } : t) } : resp
      qc.getQueriesData<TripsResp>({ queryKey: ['trips'] }).forEach(([k, v]) => qc.setQueryData(k, patch(v)))
      return { snapshots }
    },
    onError: (_e, _vars, ctx) => {
      ctx?.snapshots?.forEach(([k, v]) => qc.setQueryData(k, v))
      toast('Could not update sharing')
    },
    onSuccess: (data) => {
      qc.getQueriesData<TripsResp>({ queryKey: ['trips'] }).forEach(([k, resp]) => {
        if (!resp) return
        qc.setQueryData(k, {
          ...resp,
          trips: resp.trips.map(t => t.id === trip.id ? { ...t, is_public: data.is_public, share_id: data.share_id } : t),
        })
      })
      toast(data.is_public ? 'Trip is now public' : 'Trip is now private')
    },
  })

  const copyLink = async () => {
    if (!trip.is_public || !trip.share_id) return toast('Make trip public first')
    const url = `${window.location.origin}/share/${trip.share_id}`
    await navigator.clipboard.writeText(url)
    toast('Share link copied')
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => toggleShareMut.mutate(!trip.is_public)}
        disabled={toggleShareMut.isPending}
        className="btn"
      >
        {trip.is_public ? 'Make Private' : 'Make Public'}
      </button>
      <button
        onClick={copyLink}
        disabled={!trip.is_public || !trip.share_id}
        className="card"
      >
        Copy Link
      </button>
    </div>
  )
}

export function TripList() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const router = useRouter()
  const qc = useQueryClient()

  const tripsQ = useQuery({
    queryKey: ['trips', email],
    queryFn: () => fetchTrips(email!),
    enabled: status === 'authenticated' && !!email,
  })

  const [newName, setNewName] = React.useState('New Trip')
  const [filter, setFilter] = React.useState('')
  const [sortBy, setSortBy] = React.useState<'created_desc' | 'name_asc'>('created_desc')

  const createMut = useMutation({
    mutationFn: () => createTrip(newName.trim() || 'New Trip', email!),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['trips', email] })
      router.push(`/trip/${data.id}`)
    },
  })

  const renameMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameTrip(id, name, email!),
    onMutate: async ({ id, name }) => {
      await qc.cancelQueries({ queryKey: ['trips', email] })
      const prev = qc.getQueryData<TripsResp>(['trips', email])
      if (prev) {
        const next: TripsResp = { ...prev, trips: prev.trips.map(t => (t.id === id ? { ...t, name } : t)) }
        qc.setQueryData(['trips', email], next)
      }
      return { prev }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['trips', email], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['trips', email] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTrip(id, email!),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['trips', email] })
      const prev = qc.getQueryData<TripsResp>(['trips', email])
      if (prev) {
        const next: TripsResp = { ...prev, trips: prev.trips.filter(t => t.id !== id) }
        qc.setQueryData(['trips', email], next)
      }
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['trips', email], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['trips', email] }),
  })

  const duplicateMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => duplicateTrip(id, name, email!),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['trips', email] })
      router.push(`/trip/${data.id}`)
    },
  })

  if (status === 'loading') return null
  if (status !== 'authenticated' || !email) {
    return (
      <div className="card">
        <div className="text-sm opacity-80">Sign in to see your trips.</div>
      </div>
    )
  }

  const raw = tripsQ.data?.trips ?? []
  const filtered = raw.filter(t =>
    (t.name ?? 'Untitled Trip').toLowerCase().includes(filter.toLowerCase())
  )
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name_asc') {
      return (a.name ?? '').localeCompare(b.name ?? '')
    }
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Trip name"
          className="w-56"
        />
        <Button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
          className="btn"
        >
          {createMut.isPending ? 'Creating…' : 'New Trip'}
        </Button>

        <div className="mx-3 h-6 w-px bg-white/80 dark:bg-white/10" />

        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search trips…"
          className="w-60"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="card"
        >
          <option value="created_desc">Newest first</option>
          <option value="name_asc">Name (A→Z)</option>
        </select>
      </div>

      <div className="grid gap-2">
        {tripsQ.isLoading && (
          <div className="card">Loading trips…</div>
        )}
        {!tripsQ.isLoading && sorted.length === 0 && (
          <div className="card">No trips match your search.</div>
        )}
        {sorted.map((t) => (
          <div key={t.id} className="card">
            <div className="flex items-center gap-3">
              <input
                className="bg-transparent outline-none border-b border-transparent focus:border-white/30 text-sm px-1 py-0.5 rounded"
                defaultValue={t.name ?? 'Untitled Trip'}
                onBlur={(e) => {
                  const name = e.currentTarget.value.trim() || 'Untitled Trip'
                  if (name !== (t.name ?? '')) renameMut.mutate({ id: t.id, name })
                }}
              />
              <span className="text-xs opacity-60">{t.id.slice(0, 8)}…</span>
              <TripMetaRow tripId={t.id} />
              {t.is_public ? (
                <span className="text-xs rounded bg-white/80 dark:bg-white/10 px-2 py-0.5 border border-slate-300 dark:border-white/15">Public</span>
              ) : (
                <span className="text-xs rounded bg-white/60 dark:bg-white/5 px-2 py-0.5 border border-white/10 opacity-70">Private</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/trip/${t.id}`}
                className="btn"
              >
                Open
              </Link>
              <a
                href={`/trip/${t.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn"
              >
                Open in new tab
              </a>
              <Link
                href={`/trip/${t.id}#trip-chat`}
                className="btn"
                prefetch={false}
                title="Jump to trip chat"
              >
                Open chat
              </Link>
              <button
                onClick={() => duplicateMut.mutate({ id: t.id, name: t.name ?? 'Trip' })}
                disabled={duplicateMut.isPending}
                className="btn"
                title="Duplicate trip"
              >
                {duplicateMut.isPending ? 'Duplicating…' : 'Duplicate'}
              </button>
              <TripRowActions trip={t} email={email} />
              <button
                onClick={() => deleteMut.mutate(t.id)}
                className="card"
                title="Delete trip"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
