'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { API_BASE } from '@/lib/api'
import { toast } from 'sonner'
import { Copy, MapPin, Star, CalendarDays, AlertTriangle, Compass } from 'lucide-react'

export default function PublicSharePage() {
  const params = useParams<{ shareId: string }>()
  const router = useRouter()
  const { data: session } = useSession()
  const email = (session?.user as any)?.email as string | undefined

  const [data, setData] = React.useState<any>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [dupLoading, setDupLoading] = React.useState(false)

  React.useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch(`${API_BASE}/v1/share/${params.shareId}`, { cache: 'no-store' })
        if (!r.ok) throw new Error('not_found')
        setData(await r.json())
      } catch {
        setErr('not_found')
      }
    }
    run()
  }, [params.shareId])

  if (err) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6" style={{ background: 'rgb(var(--bg))' }}>
        <div className="content-card flex max-w-md flex-col items-center gap-4 py-12 text-center">
          <div className="rounded-full p-3" style={{ background: 'rgba(var(--error) / 0.1)' }}>
            <AlertTriangle className="h-6 w-6 text-[rgb(var(--error))]" />
          </div>
          <h2 className="text-lg font-semibold text-[rgb(var(--text))]">Trip not found</h2>
          <p className="text-sm text-[rgb(var(--muted))]">This trip is not public or doesn't exist.</p>
          <Link href="/" className="btn btn-primary">Go to Smart Travel</Link>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6" style={{ background: 'rgb(var(--bg))' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-[rgb(var(--accent))] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[rgb(var(--muted))]">Loading shared trip...</p>
        </div>
      </main>
    )
  }

  const items = (data.items ?? []) as any[]
  const tripName = data.trip?.name ?? 'Shared Trip'
  const dayGroups: Record<number, any[]> = {}
  items.forEach((it: any) => {
    const d = it.day ?? 1
    if (!dayGroups[d]) dayGroups[d] = []
    dayGroups[d].push(it)
  })
  const sortedDays = Object.keys(dayGroups).map(Number).sort((a, b) => a - b)

  const duplicate = async () => {
    if (!email) return toast('Please sign in to save a copy')
    try {
      setDupLoading(true)
      const r = await fetch(`${API_BASE}/v1/share/${params.shareId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
      })
      if (!r.ok) throw new Error('dup_failed')
      const json = await r.json() as { id: string }
      toast.success('Trip copied to your account!')
      router.push(`/trip/${json.id}`)
    } catch {
      toast.error('Could not copy trip')
    } finally {
      setDupLoading(false)
    }
  }

  return (
    <main className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-10 border-b backdrop-blur-xl"
        style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--accent))]">
            <Compass className="h-5 w-5" />
            Smart Travel
          </Link>
          <button
            onClick={duplicate}
            disabled={dupLoading}
            className="btn btn-primary text-sm"
          >
            {dupLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Save a copy
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        {/* Trip header */}
        <div className="content-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[rgb(var(--text))]">{tripName}</h1>
              <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                {items.length} {items.length === 1 ? 'place' : 'places'} · {sortedDays.length} {sortedDays.length === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>
        </div>

        {/* Items by day */}
        {items.length === 0 ? (
          <div className="content-card flex flex-col items-center gap-3 py-12 text-center">
            <MapPin className="h-8 w-8 text-[rgb(var(--accent))]" />
            <p className="text-sm text-[rgb(var(--muted))]">No places added to this trip yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDays.map((day) => (
              <div key={day} className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[rgb(var(--accent))]" />
                  <h2 className="text-sm font-semibold text-[rgb(var(--text))]">Day {day}</h2>
                  <span className="text-xs text-[rgb(var(--muted))]">
                    {dayGroups[day].length} {dayGroups[day].length === 1 ? 'place' : 'places'}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {dayGroups[day].map((it: any) => (
                    <div
                      key={it.id}
                      className="content-card flex flex-col gap-2 transition-all duration-200 hover:translate-y-[-1px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-[rgb(var(--text))]">{it.name ?? it.place_id}</h3>
                        {it.rating && (
                          <span className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium" style={{ borderColor: 'var(--glass-border)' }}>
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {Number(it.rating).toFixed(1)}
                          </span>
                        )}
                      </div>
                      {it.category && (
                        <span className="text-xs text-[rgb(var(--muted))]">{it.category}</span>
                      )}
                      {it.note && (
                        <p className="text-sm text-[rgb(var(--muted))] italic">"{it.note}"</p>
                      )}
                      {it.lat && it.lng && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${it.lat},${it.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[rgb(var(--accent))] hover:underline"
                        >
                          <MapPin className="h-3 w-3" />
                          Open in Maps
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
