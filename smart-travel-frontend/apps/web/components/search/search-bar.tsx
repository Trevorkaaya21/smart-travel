'use client'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { API_BASE } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { useDefaultTrip } from '@/lib/useDefaultTrip'
import dynamic from 'next/dynamic'

const LeafletMap = dynamic(() => import('@/components/map/leaflet-map').then(m => m.LeafletMap), { ssr: false })

async function aiPlaces(q: string, prefs: any, lat?: number, lng?: number) {
  const r = await fetch(`${API_BASE}/v1/ai/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, prefs, lat, lng })
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()) as { items: any[] }
}

async function fetchFavorites(email: string) {
  const r = await fetch(`${API_BASE}/v1/favorites?user_email=${encodeURIComponent(email)}`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()) as { favorites: { place_id: string }[] }
}

const postFav = (pid: string, email: string) =>
  fetch(`${API_BASE}/v1/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ place_id: pid })
  }).then(r => { if (!r.ok) throw new Error('fav_add_failed'); return r.json() })

const delFav = (pid: string, email: string) =>
  fetch(`${API_BASE}/v1/favorites`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ place_id: pid })
  }).then(r => { if (!r.ok) throw new Error('fav_del_failed'); return r.json() })

async function addTripItem(tripId: string, placeId: string, email: string) {
  const r = await fetch(`${API_BASE}/v1/trips/${tripId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ place_id: placeId, day: 1 })
  })
  if (!r.ok) throw new Error('add_item_failed')
  return r.json()
}

export default function SearchBar() {
  const { data: session } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const { defaultTripId } = useDefaultTrip()

  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [prefs, setPrefs] = useState<any>({})
  const [geo, setGeo] = useState<{ lat?: number; lng?: number }>({})

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 350)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    try { const raw = localStorage.getItem('st.prefs'); if (raw) setPrefs(JSON.parse(raw)) } catch {}
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      )
    }
  }, [])

  const qc = useQueryClient()

  const placesQ = useQuery({
    queryKey: ['ai-places', debounced, prefs, geo.lat, geo.lng],
    queryFn: () => aiPlaces(debounced, prefs, geo.lat, geo.lng),
    enabled: debounced.length > 0
  })

  const favsQ = useQuery({
    queryKey: ['favs', email],
    queryFn: () => fetchFavorites(email!),
    enabled: !!email
  })
  const favSet = useMemo(
    () => new Set<string>((favsQ.data?.favorites ?? []).map((fav) => fav.place_id)),
    [favsQ.data]
  )

  const addMut = useMutation({
    mutationFn: (pid: string) => postFav(pid, email!),
    onMutate: async (pid) => {
      await qc.cancelQueries({ queryKey: ['favs', email] })
      const prev = qc.getQueryData<any>(['favs', email])
      const next = [
        ...(prev?.favorites ?? []),
        { place_id: pid },
      ]
      qc.setQueryData(['favs', email], { favorites: next })
      return { prev }
    },
    onError: (_e, _pid, ctx) => { if (ctx?.prev) qc.setQueryData(['favs', email], ctx.prev) }
  })

  const delMut = useMutation({
    mutationFn: (pid: string) => delFav(pid, email!),
    onMutate: async (pid) => {
      await qc.cancelQueries({ queryKey: ['favs', email] })
      const prev = qc.getQueryData<any>(['favs', email])
      const next = (prev?.favorites ?? []).filter((f: { place_id: string }) => f.place_id !== pid)
      qc.setQueryData(['favs', email], { favorites: next })
      return { prev }
    },
    onError: (_e, _pid, ctx) => { if (ctx?.prev) qc.setQueryData(['favs', email], ctx.prev) }
  })

  const toggleFav = (pid: string) => {
    if (!email) return alert('Sign in to save places.')
    if (favSet.has(pid)) {
      delMut.mutate(pid)
    } else {
      addMut.mutate(pid)
    }
  }

  const addToTrip = async (pid: string) => {
    if (!email) return alert('Please sign in.')
    if (!defaultTripId) return alert('Trip not ready yet—try again.')
    await addTripItem(defaultTripId, pid, email)
    window.location.href = `/trip/${defaultTripId}`
  }

  const items = placesQ.data?.items ?? []
  const markers = items.map((p: any) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng }))

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search places… (e.g., museum, tacos, viewpoint)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="glass"
        />
        <a
          href="/dashboard/preferences"
          className="rounded-xl border border-white/15 bg-white/10 px-3 py-1 text-sm hover:bg-white/15"
          title="Preferences"
        >
          ⚙︎
        </a>
      </div>

      {debounced.length === 0 && (
        <div className="glass p-4 rounded-2xl border border-white/15 text-sm opacity-80">
          Start typing to search. AI will refine your query using your Preferences.
        </div>
      )}

      {debounced.length > 0 && (
        <div className="glass p-2 rounded-2xl border border-white/15">
          <LeafletMap markers={markers} />
        </div>
      )}

      {placesQ.isFetching && debounced.length > 0 && (
        <div className="glass p-4 rounded-2xl border border-white/15 text-sm opacity-80">
          Finding great spots…
        </div>
      )}

      {placesQ.isError && (
        <div className="glass p-4 rounded-2xl border border-white/15 text-sm text-red-300">
          Couldn’t load places. Try again.
        </div>
      )}

      {placesQ.isSuccess && items.length === 0 && (
        <div className="glass p-4 rounded-2xl border border-white/15 text-sm opacity-80">
          No results.
        </div>
      )}

      {placesQ.isSuccess && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((p: any) => {
            const saved = favSet.has(p.id)
            return (
              <div key={p.id} className="glass p-4 rounded-2xl border border-white/15 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFav(p.id)}
                      className={`rounded-xl border px-3 py-1 ${saved ? 'bg-white/20' : 'bg-white/5'} border-white/15`}
                    >
                      {saved ? '⭐ Saved' : '☆ Save'}
                    </button>
                    <button
                      onClick={() => addToTrip(p.id)}
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-1"
                      title="Add to My Trip"
                    >
                      ➕ Add to Trip
                    </button>
                  </div>
                </div>
                <div className="text-xs uppercase tracking-wide opacity-70">
                  {p.category} · {typeof p.rating === 'number' ? p.rating.toFixed(1) : '—'}
                </div>
                <div className="mt-2 text-sm text-slate-300">
                  because: <span className="opacity-90">{p.because}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
