'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, X, Plane, NotebookPen, Sparkles } from 'lucide-react'
import { API_BASE } from '@/lib/api'
import { cleanTripName, computeTripDays } from '@/lib/trip-utils'

type Trip = {
  id: string
  name: string
  start_date?: string | null
  end_date?: string | null
  places_count?: number
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function TripReminders() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set())

  const tripsQ = useQuery({
    queryKey: ['trips', email],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/trips?owner_email=${encodeURIComponent(email!)}`, { cache: 'no-store' })
      if (!res.ok) return { trips: [] }
      return res.json()
    },
    enabled: status === 'authenticated' && !!email,
    staleTime: 60_000,
  })

  const upcomingTrips = React.useMemo(() => {
    const raw = tripsQ.data
    const trips: Trip[] = Array.isArray(raw) ? raw : (raw as any)?.trips ?? []
    return trips
      .filter((t) => {
        if (!t.start_date) return false
        const days = daysUntil(t.start_date)
        return days >= 0 && days <= 7
      })
      .sort((a, b) => daysUntil(a.start_date!) - daysUntil(b.start_date!))
  }, [tripsQ.data])

  const visible = upcomingTrips.filter((t) => !dismissed.has(t.id))

  if (visible.length === 0) return null

  return (
    <div className="space-y-3 animate-fade-in">
      {visible.map((trip) => {
        const days = daysUntil(trip.start_date!)
        const name = cleanTripName(trip.name)
        const placesCount = trip.places_count ?? 0
        const tripDays = computeTripDays(trip.start_date, trip.end_date)
        const isToday = days === 0
        const isTomorrow = days === 1

        return (
          <div
            key={trip.id}
            className="relative flex flex-col gap-3 rounded-2xl border p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor: isToday ? 'rgba(var(--accent) / 0.5)' : 'var(--glass-border)',
              background: isToday ? 'rgba(var(--accent) / 0.08)' : 'var(--glass-bg)',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: isToday ? 'rgba(var(--accent) / 0.2)' : 'rgba(var(--accent) / 0.12)',
                }}
              >
                <Plane className="h-5 w-5 text-[rgb(var(--accent))]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[rgb(var(--text))]">
                  {isToday
                    ? `Your trip starts today!`
                    : isTomorrow
                      ? `Your trip starts tomorrow`
                      : `Trip in ${days} days`}
                </p>
                <p className="text-xs text-[rgb(var(--muted))]">
                  <span className="font-medium text-[rgb(var(--text))]">{name}</span>
                  {' · '}
                  {formatDateShort(trip.start_date!)}
                  {trip.end_date && ` – ${formatDateShort(trip.end_date)}`}
                  {placesCount > 0 && ` · ${placesCount} places`}
                  {tripDays > 0 && ` · ${tripDays} days`}
                </p>
                {placesCount === 0 && (
                  <p className="mt-1 text-xs font-medium text-[rgb(var(--warning))]">
                    No places added yet — add some before you go!
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/trip/${trip.id}`}
                className="btn btn-primary rounded-xl px-3 py-1.5 text-xs font-semibold"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                View itinerary
              </Link>
              {placesCount === 0 && (
                <Link
                  href={`/dashboard?addToTrip=${encodeURIComponent(trip.id)}`}
                  className="btn btn-ghost rounded-xl px-3 py-1.5 text-xs font-semibold"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Add places
                </Link>
              )}
              <Link
                href={`/dashboard/diary?tripId=${encodeURIComponent(trip.id)}&tripName=${encodeURIComponent(name)}`}
                className="btn btn-ghost rounded-xl px-3 py-1.5 text-xs font-semibold"
              >
                <NotebookPen className="h-3.5 w-3.5" />
                Diary
              </Link>
              <button
                onClick={() => setDismissed((s) => new Set(s).add(trip.id))}
                className="rounded-lg p-1.5 text-[rgb(var(--muted))] transition hover:bg-[var(--glass-bg-hover)] hover:text-[rgb(var(--text))]"
                title="Dismiss reminder"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
