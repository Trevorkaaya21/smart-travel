'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { API_BASE } from '@/lib/api'
import { toast } from 'sonner'

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

  if (err) return <main className="p-6">This trip is not public or doesn’t exist.</main>
  if (!data) return <main className="p-6">Loading…</main>

  const items = (data.items ?? []) as any[]

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
      toast('Copied to your trips')
      router.push(`/trip/${json.id}`)
    } catch {
      toast('Could not copy trip')
    } finally {
      setDupLoading(false)
    }
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{data.trip?.name ?? 'Trip'}</h1>
        <button
          onClick={duplicate}
          disabled={dupLoading}
          className="rounded-xl border border-white/15 bg-white/10 px-3 py-1 text-sm"
        >
          {dupLoading ? 'Saving…' : 'Save a copy'}
        </button>
      </div>

      <div className="grid gap-3">
        {items.length === 0 && (
          <div className="rounded-2xl border border-white/15 bg-white/5 p-6">No items yet.</div>
        )}
        {items.map((it) => (
          <div key={it.id} className="rounded-2xl border border-white/15 bg-white/5 p-4">
            <div className="font-medium">{it.name ?? it.place_id}</div>
            <div className="text-xs opacity-70">
              {it.category} · {it.rating ?? '—'} · Day {it.day}
            </div>
            {it.note && <div className="text-sm opacity-90 mt-1">{it.note}</div>}
          </div>
        ))}
      </div>
    </main>
  )
}