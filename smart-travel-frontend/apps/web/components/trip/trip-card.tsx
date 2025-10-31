'use client'

import Link from 'next/link'
import { CalendarDays, Trash2 } from 'lucide-react'

type Props = {
  id: string
  name: string
  start?: string | null
  end?: string | null
  status?: 'Planned' | 'Completed' | null
  imageUrl?: string | null
  onDelete?: () => void
}

export function TripCard({ id, name, start, end, status, imageUrl, onDelete }: Props) {
  const dates =
    start && end
      ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).formatRange(
          new Date(start),
          new Date(end)
        )
      : 'Dates TBA'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/60 dark:bg-white/5">
      <div className="relative h-44 w-full overflow-hidden rounded-t-2xl bg-black/20">
        {/* image */}
        <img
          src={
            imageUrl ??
            'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?q=80&w=1200&auto=format&fit=crop'
          }
          alt=""
          className="h-full w-full object-cover opacity-95"
        />
        {status ? (
          <div className="absolute right-3 top-3 rounded-full bg-indigo-600/90 px-2 py-0.5 text-xs font-medium">
            {status}
          </div>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        <div className="text-base font-semibold">{name || 'Untitled Trip'}</div>
        <div className="flex items-center gap-2 text-sm opacity-80">
          <CalendarDays className="h-4 w-4" />
          <span>{dates}</span>
        </div>

        <div className="flex items-center justify-between">
          <Link
            href={`/trip/${id}`}
            className="btn"
          >
            View Itinerary
          </Link>
          <button
            onClick={onDelete}
            className="card"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
