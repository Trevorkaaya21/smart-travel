'use client'
import * as React from 'react'
import { useParams } from 'next/navigation'
import { API_BASE } from '@/lib/configure'

export default function PublicSharePage() {
  const params = useParams<{ shareId: string }>()
  const [data, setData] = React.useState<any>(null)
  const [err, setErr] = React.useState<string | null>(null)

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

  if (err) return <main className="p-6">This trip is not public or doesn’t exist.</main>
  if (!data) return <main className="p-6">Loading…</main>

  const items = data.items as any[]
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{data.trip?.name ?? 'Trip'}</h1>
      <div className="grid gap-3">
        {items.length === 0 && (
          <div className="card">No items yet.</div>
        )}
        {items.map((it) => (
          <div key={it.id} className="card">
            <div className="font-medium">{it.name ?? it.place_id}</div>
            <div className="text-xs opacity-70">{it.category} · {it.rating ?? '—'} · Day {it.day}</div>
            {it.note && <div className="text-sm opacity-90 mt-1">{it.note}</div>}
          </div>
        ))}
      </div>
    </main>
  )
}