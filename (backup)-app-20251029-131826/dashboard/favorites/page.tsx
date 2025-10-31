'use client'
import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { API_BASE } from '@/lib/configure'

async function fetchFavorites(email: string) {
  const r = await fetch(`${API_BASE}/v1/favorites?user_email=${encodeURIComponent(email)}`, { cache: 'no-store' })
  if (!r.ok) throw new Error('load_failed')
  return r.json() as Promise<{ placeIds: string[] }>
}

export default function FavoritesPage() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined

  const favsQ = useQuery({
    queryKey: ['favs', email],
    queryFn: () => fetchFavorites(email!),
    enabled: status === 'authenticated' && !!email,
  })

  if (status === 'loading') return null

  if (status !== 'authenticated' || !email) {
    return (
      <main className="p-6">
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm">
          Sign in to see your favorites.
        </div>
      </main>
    )
  }

  const ids = favsQ.data?.placeIds ?? []

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Favorites</h1>
      {favsQ.isLoading && <div className="rounded-2xl border border-white/15 bg-white/5 p-4">Loading…</div>}
      {!favsQ.isLoading && ids.length === 0 && (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4">No favorites yet.</div>
      )}
      {ids.length > 0 && (
        <div className="grid gap-2">
          {ids.map((id) => (
            <div key={id} className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm">
              {id}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}