'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, CalendarDays, Loader2, Share2, Trash2, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { API_BASE } from '@/lib/api'

type Trip = { id: string; name: string; created_at: string; share_id?: string | null }

async function listTrips(email: string) {
  const res = await fetch(`${API_BASE}/v1/trips?owner_email=${encodeURIComponent(email)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Could not load trips')
  const data = await res.json()
  return (data?.trips as Trip[]) ?? []
}

async function createTrip(name: string, email: string) {
  const res = await fetch(`${API_BASE}/v1/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('create_failed')
  return res.json() as Promise<{ id: string }>
}

async function removeTrip(id: string, email: string) {
  const res = await fetch(`${API_BASE}/v1/trips/${id}`, {
    method: 'DELETE',
    headers: { 'x-user-email': email },
  })
  if (!res.ok) throw new Error('delete_failed')
  return res.json()
}

export default function TripsPage() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const qc = useQueryClient()
  const [newTrip, setNewTrip] = React.useState('')

  const tripsQuery = useQuery({
    queryKey: ['trips', email],
    queryFn: () => listTrips(email!),
    enabled: status === 'authenticated' && !!email,
  })

  const createMut = useMutation({
    mutationFn: () => createTrip(newTrip.trim() || 'New Adventure', email!),
    onSuccess: () => {
      setNewTrip('')
      toast.success('Trip created', { description: 'Head to the timeline editor to customize it.' })
      qc.invalidateQueries({ queryKey: ['trips', email] })
    },
    onError: () => toast.error('Could not create trip. Try again.'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => removeTrip(id, email!),
    onSuccess: () => {
      toast.success('Trip removed')
      qc.invalidateQueries({ queryKey: ['trips', email] })
    },
    onError: () => toast.error('Unable to delete trip right now.'),
  })

  if (status !== 'authenticated' || !email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        <div className="content-card max-w-lg space-y-4">
          <h1 className="text-4xl font-semibold text-[rgb(var(--text))]">Sign in to manage your itineraries</h1>
          <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_72%,rgb(var(--muted))_28%)]">
            Trips sync across devices, support drag-and-drop edits, sharing, and AI updates. Connect your Google account to continue.
          </p>
          <Button onClick={() => signIn('google')} className="btn btn-primary w-full justify-center">
            Sign in with Google
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-8 text-[rgb(var(--text))]">
      <header className="content-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-[color-mix(in_oklab,rgb(var(--text))_65%,rgb(var(--muted))_35%)]">My trips</p>
            <h1 className="text-3xl font-semibold md:text-4xl">Keep every journey in one flexible timeline</h1>
            <p className="max-w-2xl text-sm text-[color-mix(in_oklab,rgb(var(--text))_72%,rgb(var(--muted))_28%)]">
              Smart Travel syncs AI itineraries, manual edits, and favorite places. Drag experiences between days, add notes, and share with friends seamlessly.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/create"
              className="btn btn-primary rounded-2xl px-4 py-2 text-sm font-semibold"
            >
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </Link>
            <Link
              href="/dashboard"
              className="btn btn-ghost rounded-2xl px-4 py-2 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Discover new places
            </Link>
          </div>
        </div>
      </header>

      <section className="content-card space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Create a new trip</h2>
            <p className="form-helper uppercase tracking-[0.3em]">Name it however you like — you can tweak later</p>
          </div>
          <div className="flex w-full flex-col gap-3 rounded-3xl border border-white/15 bg-white/10 p-4 shadow md:w-auto md:flex-row md:items-center">
            <Input
              value={newTrip}
              onChange={(e) => setNewTrip(e.target.value)}
              placeholder="Autumn escape in Kyoto"
              className="input-surface md:w-64"
            />
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
              className="btn btn-primary rounded-2xl px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-70"
            >
              {createMut.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create trip
                </span>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {tripsQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-36 animate-pulse content-subtle" />
            ))
          ) : tripsQuery.data && tripsQuery.data.length > 0 ? (
            tripsQuery.data.map((trip) => (
              <article key={trip.id} className="content-card flex flex-col justify-between text-sm">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-[rgb(var(--text))]">{trip.name}</h3>
                    <span className="content-subtle px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
                      {new Date(trip.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[color-mix(in_oklab,rgb(var(--text))_65%,rgb(var(--muted))_35%)]">
                    Timeline editor lets you reorder by drag-and-drop, add notes, and sync with AI suggestions.
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/trip/${trip.id}`}
                    className="btn btn-primary rounded-2xl px-4 py-2 text-xs font-semibold"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Open timeline
                  </Link>
                  {trip.share_id && (
                    <Link
                      href={`/share/${trip.share_id}`}
                      className="btn btn-ghost rounded-2xl px-4 py-2 text-xs font-semibold"
                    >
                      <Share2 className="h-4 w-4" />
                      Share view
                    </Link>
                  )}
                  <button
                    onClick={() => deleteMut.mutate(trip.id)}
                    disabled={deleteMut.isPending}
                    className="btn btn-ghost rounded-2xl px-4 py-2 text-xs font-semibold disabled:cursor-wait disabled:opacity-60"
                  >
                    {deleteMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-white/15 bg-white/10 p-6 text-center text-white/70">
              Build your first trip with AI or add favorite places from Discover to get started.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
