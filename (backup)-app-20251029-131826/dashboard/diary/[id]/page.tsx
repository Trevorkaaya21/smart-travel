'use client'
import * as React from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { API_BASE } from '@/lib/configure'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

async function fetchEntries(id: string) {
  const r = await fetch(`${API_BASE}/v1/diary/${id}/entries`, { cache: 'no-store' })
  if (!r.ok) throw new Error('load_failed')
  return r.json()
}
async function addEntry(id: string, text: string, day: number, email: string) {
  const r = await fetch(`${API_BASE}/v1/diary/${id}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ text, day }),
  })
  if (!r.ok) throw new Error('save_failed')
  return r.json()
}

export default function DiaryDetailPage() {
  const params = useParams() as { id: string }
  const id = params.id
  const { data: session } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const qc = useQueryClient()

  const entriesQ = useQuery({
    queryKey: ['entries', id],
    queryFn: () => fetchEntries(id),
    enabled: !!id,
  })

  const [text, setText] = React.useState('')
  const [day, setDay] = React.useState<number>(1)

  const addMut = useMutation({
    mutationFn: () => addEntry(id, text.trim(), day, email!),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['entries', id] })
    },
  })

  const items = entriesQ.data?.items ?? []

  return (
    <main className="p-6 space-y-6">
      <div className="text-2xl font-semibold">Diary</div>

      <div className="card">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={day}
            onChange={(e) => setDay(Math.max(1, Number(e.target.value) || 1))}
            className="w-24"
          />
          <textarea
            value={text}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setText(e.currentTarget.value)
            }
            placeholder="Write your memory…"
            className="card"
          />
        </div>
        <Button onClick={() => addMut.mutate()} disabled={!email || !text.trim()}>
          {addMut.isPending ? 'Saving…' : 'Add Entry'}
        </Button>
      </div>

      <div className="grid gap-3">
        {items.map((it: any) => (
          <div key={it.id} className="card">
            <div className="text-sm opacity-70 mb-1">
              Day {it.day} • {new Date(it.created_at).toLocaleString()}
            </div>
            <div className="whitespace-pre-wrap">{it.text}</div>
          </div>
        ))}
      </div>
    </main>
  )
}