'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, CalendarDays, Loader2, Share2, Trash2, Sparkles, MapPin, Plane, History, ClipboardList } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { API_BASE } from '@/lib/api'
import { stringImageUrl } from '@/lib/utils'
import { getTripImageUrl } from '@/lib/trip-utils'

type Trip = {
  id: string
  name: string
  created_at: string
  share_id?: string | null
  image_url?: string | null
  image_credit?: string | null
  places_count?: number
  days_count?: number
  start_date?: string | null
  end_date?: string | null
}

type TripGroup = 'planning' | 'upcoming' | 'past'

/** Today at start of day (local) for real-time upcoming vs past */
function todayDateString(): string {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function groupTrips(trips: Trip[]): Record<TripGroup, Trip[]> {
  const today = todayDateString()
  const planning: Trip[] = []
  const upcoming: Trip[] = []
  const past: Trip[] = []

  for (const trip of trips) {
    const placesCount = trip.places_count ?? 0
    const endDate = trip.end_date ?? null

    // No places = still planning
    if (placesCount === 0) {
      planning.push(trip)
      continue
    }

    // Has places: use end_date for real-time grouping
    if (!endDate) {
      // No end date set → treat as upcoming so user can add dates later
      upcoming.push(trip)
    } else if (endDate >= today) {
      upcoming.push(trip)
    } else {
      past.push(trip)
    }
  }

  return { planning, upcoming, past }
}

async function listTrips(email: string) {
  const res = await fetch(`${API_BASE}/v1/trips?owner_email=${encodeURIComponent(email)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Could not load trips')
  const data = await res.json()
  return (data?.trips as Trip[]) ?? []
}

async function createTrip(
  name: string,
  email: string,
  options?: { start_date?: string; end_date?: string }
) {
  const res = await fetch(`${API_BASE}/v1/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({
      name,
      start_date: options?.start_date || undefined,
      end_date: options?.end_date || undefined,
    }),
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

async function updateTripDates(
  id: string,
  email: string,
  start_date: string | null,
  end_date: string | null
) {
  const res = await fetch(`${API_BASE}/v1/trips/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ start_date, end_date }),
  })
  if (!res.ok) throw new Error('update_failed')
  return res.json()
}

export default function TripsPage() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const qc = useQueryClient()
  const [newTrip, setNewTrip] = React.useState('')
  const [newTripStart, setNewTripStart] = React.useState('')
  const [newTripEnd, setNewTripEnd] = React.useState('')

  const tripsQuery = useQuery({
    queryKey: ['trips', email],
    queryFn: () => listTrips(email!),
    enabled: status === 'authenticated' && !!email,
    staleTime: 30000, // Keep data fresh for 30 seconds
    gcTime: 60000, // Cache for 1 minute
    refetchOnMount: 'always', // Always refetch when mounting
    refetchOnWindowFocus: true, // Refetch when window focused
  })

  const createMut = useMutation({
    mutationFn: () =>
      createTrip(newTrip.trim() || 'New Adventure', email!, {
        start_date: newTripStart.trim() || undefined,
        end_date: newTripEnd.trim() || undefined,
      }),
    onSuccess: () => {
      setNewTrip('')
      setNewTripStart('')
      setNewTripEnd('')
      toast.success('Trip created', { description: 'Start adding places to your trip.' })
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

  const grouped = React.useMemo(() => {
    if (!tripsQuery.data?.length) return { planning: [], upcoming: [], past: [] }
    return groupTrips(tripsQuery.data)
  }, [tripsQuery.data])

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
            <h1 className="text-3xl font-semibold md:text-4xl">Your Trips</h1>
            <p className="max-w-2xl text-sm text-[color-mix(in_oklab,rgb(var(--text))_72%,rgb(var(--muted))_28%)]">
              Plan, organize, and explore your travels.
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
            <p className="form-helper uppercase tracking-[0.3em]">Name it and get started</p>
          </div>
          <div className="flex w-full flex-col gap-3 rounded-3xl border border-white/15 bg-white/10 p-4 shadow md:flex-row md:flex-wrap md:items-end">
            <Input
              value={newTrip}
              onChange={(e) => setNewTrip(e.target.value)}
              placeholder="Autumn escape in Kyoto"
              className="input-surface md:w-56"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-[rgb(var(--muted))]">Start</label>
              <Input
                type="date"
                value={newTripStart}
                onChange={(e) => setNewTripStart(e.target.value)}
                className="input-surface w-40"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-[rgb(var(--muted))]">End</label>
              <Input
                type="date"
                value={newTripEnd}
                onChange={(e) => setNewTripEnd(e.target.value)}
                className="input-surface w-40"
              />
            </div>
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

        {/* Grouped trip sections — Expedia-style */}
        {tripsQuery.isLoading ? (
          <div className="space-y-10">
            <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-72 animate-pulse rounded-2xl content-subtle" />
              ))}
            </div>
          </div>
        ) : tripsQuery.data && tripsQuery.data.length > 0 ? (
          <div className="space-y-10">
            {/* Planning - Show first for emphasis */}
            <TripSection
              title="Planning"
              subtitle="Empty itineraries — add places or generate with AI to bring them to life"
              icon={ClipboardList}
              trips={grouped.planning}
              emptyMessage="No trips in planning. Create one above or let AI generate a complete itinerary."
              emptyAction={
                <div className="flex flex-wrap gap-2">
                  <Link href="/dashboard/create" className="btn btn-primary rounded-2xl px-4 py-2 text-xs font-semibold">
                    <Sparkles className="h-4 w-4" />
                    Generate with AI
                  </Link>
                  <Link href="/dashboard" className="btn btn-ghost rounded-2xl px-4 py-2 text-xs font-semibold">
                    <Plus className="h-4 w-4" />
                    Discover places
                  </Link>
                </div>
              }
              deleteMut={deleteMut}
              email={email}
              onDatesUpdate={() => qc.invalidateQueries({ queryKey: ['trips', email] })}
              updateTripDates={updateTripDates}
              isPlanning={true}
            />

            {/* Upcoming trips */}
            <TripSection
              title="Upcoming trips"
              subtitle="Trips with end date today or in the future · Ready to explore"
              icon={Plane}
              trips={grouped.upcoming}
              emptyMessage="No upcoming trips yet. Add places to your planning trips and set dates to move them here."
              emptyAction={
                <Link href="/dashboard" className="btn btn-primary rounded-2xl px-4 py-2 text-xs font-semibold">
                  <Plus className="h-4 w-4" />
                  Discover places
                </Link>
              }
              deleteMut={deleteMut}
              email={email}
              onDatesUpdate={() => qc.invalidateQueries({ queryKey: ['trips', email] })}
              updateTripDates={updateTripDates}
              isPlanning={false}
            />

            {/* Past trips */}
            <TripSection
              title="Past trips"
              subtitle="Trips whose end date has passed · Memories to cherish"
              icon={History}
              trips={grouped.past}
              emptyMessage="No past trips yet. When a trip's end date passes, it moves here automatically."
              emptyAction={null}
              deleteMut={deleteMut}
              email={email}
              onDatesUpdate={() => qc.invalidateQueries({ queryKey: ['trips', email] })}
              updateTripDates={updateTripDates}
              isPlanning={false}
            />
          </div>
        ) : (
          <div className="col-span-full rounded-2xl border backdrop-blur-sm p-12 text-center" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ borderWidth: 1, borderColor: 'rgba(var(--accent) / 0.25)', background: 'rgba(var(--accent) / 0.1)' }}>
              <Sparkles className="h-8 w-8 text-[rgb(var(--accent))]" />
            </div>
            <h3 className="text-lg font-semibold text-[rgb(var(--text))] mb-2">Start your first adventure</h3>
            <p className="text-sm text-[rgb(var(--muted))] mb-6 max-w-md mx-auto">
              Create a trip with AI or manually add places from Discover. Trips are grouped into Upcoming, Planning, and Past.
            </p>
            <Link
              href="/dashboard/create"
              className="btn btn-primary inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold"
            >
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}

function TripSection({
  title,
  subtitle,
  icon: Icon,
  trips,
  emptyMessage,
  emptyAction,
  deleteMut,
  email,
  onDatesUpdate,
  updateTripDates,
  isPlanning,
}: {
  title: string
  subtitle: string
  icon: React.ElementType
  trips: Trip[]
  emptyMessage: string
  emptyAction: React.ReactNode
  deleteMut: { mutate: (id: string) => void; isPending: boolean }
  email: string
  onDatesUpdate: () => void
  updateTripDates: (id: string, email: string, start_date: string | null, end_date: string | null) => Promise<unknown>
  isPlanning: boolean
}) {
  if (trips.length === 0) {
    return (
      <section className="rounded-2xl border p-6" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl text-[rgb(var(--accent))]" style={{ background: 'rgba(var(--accent) / 0.12)' }}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[rgb(var(--text))]">{title}</h2>
            <p className="text-xs text-[rgb(var(--muted))]">{subtitle}</p>
          </div>
        </div>
        <p className="text-sm text-[rgb(var(--muted))] mb-4">{emptyMessage}</p>
        {emptyAction}
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div 
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[rgb(var(--accent))]" 
          style={{ background: 'rgba(var(--accent) / 0.12)' }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[rgb(var(--text))]">{title}</h2>
          <p className="text-xs text-[rgb(var(--muted))]">{subtitle} · {trips.length} {trips.length === 1 ? 'trip' : 'trips'}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {trips.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            email={email}
            onDelete={() => deleteMut.mutate(trip.id)}
            deletePending={deleteMut.isPending}
            onDatesUpdate={onDatesUpdate}
            updateTripDates={updateTripDates}
          />
        ))}
      </div>
    </section>
  )
}

function formatTripDateRange(start?: string | null, end?: string | null): string | null {
  if (!start && !end) return null
  if (start && end) {
    const s = new Date(start + 'T12:00:00')
    const e = new Date(end + 'T12:00:00')
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).formatRange(s, e)
  }
  if (start) return new Date(start + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  if (end) return new Date(end + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return null
}

function TripCard({
  trip,
  email,
  onDelete,
  deletePending,
  onDatesUpdate,
  updateTripDates,
}: {
  trip: Trip
  email: string
  onDelete: () => void
  deletePending: boolean
  onDatesUpdate: () => void
  updateTripDates: (id: string, email: string, start_date: string | null, end_date: string | null) => Promise<unknown>
}) {
  const tripImage = stringImageUrl(trip.image_url)
  // If no custom image, generate one based on trip name
  const autoImage = !tripImage ? getTripImageUrl(trip.name) : null
  const finalImage = tripImage || autoImage
  const placesCount = trip.places_count ?? 0
  const daysCount = trip.days_count ?? 1
  const isEmpty = placesCount === 0
  const dateRange = formatTripDateRange(trip.start_date, trip.end_date)
  const [editingDates, setEditingDates] = React.useState(false)
  const [editStart, setEditStart] = React.useState(trip.start_date ?? '')
  const [editEnd, setEditEnd] = React.useState(trip.end_date ?? '')
  const [savingDates, setSavingDates] = React.useState(false)

  async function handleSaveDates() {
    setSavingDates(true)
    try {
      await updateTripDates(trip.id, email, editStart.trim() || null, editEnd.trim() || null)
      toast.success('Dates updated')
      onDatesUpdate()
      setEditingDates(false)
    } catch {
      toast.error('Could not update dates')
    } finally {
      setSavingDates(false)
    }
  }

  return (
    <article
      className="group overflow-hidden rounded-2xl border backdrop-blur-sm transition-all duration-200 hover:translate-y-[-2px] hover:shadow-xl"
      style={{ 
        borderColor: 'var(--glass-border)', 
        background: 'var(--glass-bg)' 
      }}
    >
      <div className="relative h-48 w-full overflow-hidden">
        {finalImage ? (
          <>
            <img
              src={finalImage}
              alt={trip.name}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            {trip.image_credit && (
              <p className="absolute bottom-2 right-2 text-[10px] text-white/70 drop-shadow-md">{trip.image_credit}</p>
            )}
          </>
        ) : (
          <div 
            className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br p-6 text-center"
            style={{
              background: isEmpty 
                ? 'linear-gradient(135deg, rgba(var(--accent), 0.15) 0%, rgba(var(--accent), 0.08) 100%)'
                : 'linear-gradient(135deg, rgba(var(--accent), 0.2) 0%, rgba(var(--accent-secondary), 0.1) 100%)'
            }}
          >
            {isEmpty ? (
              <>
                <div className="rounded-2xl bg-[rgb(var(--accent))]/10 p-4">
                  <ClipboardList className="h-12 w-12 text-[rgb(var(--accent))]" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[rgb(var(--accent))]">
                    Ready to Plan
                  </p>
                  <p className="text-xs text-[rgb(var(--muted))]">
                    Add places to bring this trip to life
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl bg-[rgb(var(--accent))]/10 p-4">
                  <MapPin className="h-12 w-12 text-[rgb(var(--accent))]" />
                </div>
                <p className="text-xs font-medium text-[rgb(var(--accent))]">
                  {placesCount} {placesCount === 1 ? 'place' : 'places'} added
                </p>
              </>
            )}
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-lg font-bold leading-tight text-white drop-shadow-lg truncate">{trip.name}</h3>
          <div className="flex items-center gap-2 text-xs text-white/90 mt-1.5 flex-wrap">
            {dateRange && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 backdrop-blur-sm">
                <CalendarDays className="h-3 w-3" />
                {dateRange}
              </span>
            )}
            {!isEmpty && (
              <>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 backdrop-blur-sm">
                  <MapPin className="h-3 w-3" />
                  {placesCount} {placesCount === 1 ? 'place' : 'places'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 backdrop-blur-sm">
                  {daysCount} {daysCount === 1 ? 'day' : 'days'}
                </span>
              </>
            )}
            {isEmpty && !dateRange && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--accent))]/30 bg-[rgb(var(--accent))]/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                <Sparkles className="h-3 w-3" />
                Planning
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-3 p-5">
        {editingDates ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                className="input-surface text-xs h-8 w-32"
              />
              <span className="text-[rgb(var(--muted))]">→</span>
              <Input
                type="date"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                className="input-surface text-xs h-8 w-32"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveDates} disabled={savingDates} className="rounded-xl text-xs h-8">
                {savingDates ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save dates'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingDates(false)} className="rounded-xl text-xs h-8">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {!dateRange && (
              <p className="text-xs text-[rgb(var(--muted))]">
                Created {new Date(trip.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
            {isEmpty && (
              <div className="rounded-xl border border-[rgb(var(--accent))]/15 bg-[rgb(var(--accent))]/5 p-3 mb-2">
                <p className="text-xs font-medium text-[rgb(var(--accent))] mb-2">
                  💡 Get started with your trip:
                </p>
                <ul className="text-xs text-[rgb(var(--muted))] space-y-1 list-disc list-inside">
                  <li>Generate a complete AI itinerary</li>
                  <li>Discover and add places manually</li>
                  <li>Set your travel dates</li>
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {isEmpty ? (
                <>
                  <Link
                    href="/dashboard/create"
                    className="btn btn-primary rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate with AI
                  </Link>
                  <Link
                    href={`/dashboard?addToTrip=${encodeURIComponent(trip.id)}`}
                    className="btn btn-ghost rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Discover places
                  </Link>
                </>
              ) : (
                <>
                  <Link href={`/trip/${trip.id}`} className="btn btn-primary rounded-xl px-3 py-2 text-xs font-semibold">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Open
                  </Link>
                  <Link
                    href={`/dashboard?addToTrip=${encodeURIComponent(trip.id)}`}
                    className="btn btn-ghost rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Add more places
                  </Link>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditStart(trip.start_date ?? '')
                  setEditEnd(trip.end_date ?? '')
                  setEditingDates(true)
                }}
                className="btn btn-ghost rounded-xl px-3 py-2 text-xs font-semibold"
                title="Set or edit trip dates"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {dateRange ? 'Edit dates' : 'Set dates'}
              </button>
              {trip.share_id && (
                <Link href={`/share/${trip.share_id}`} className="btn btn-ghost rounded-xl px-3 py-2 text-xs font-semibold">
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Link>
              )}
              <button
                onClick={onDelete}
                disabled={deletePending}
                className="btn btn-ghost rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
              >
                {deletePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  )
}
