'use client'
import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { API_BASE } from '@/lib/configure'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

async function listDiaries(email: string) {
  const r = await fetch(`${API_BASE}/v1/diary?user_email=${encodeURIComponent(email)}`, { cache: 'no-store' })
  if (!r.ok) throw new Error('load_failed'); return r.json()
}
async function createDiary(title: string, email: string) {
  const r = await fetch(`${API_BASE}/v1/diary`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ title })
  }); if (!r.ok) throw new Error('create_failed'); return r.json()
}

export default function DiaryPage() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const qc = useQueryClient()
  const [title, setTitle] = React.useState('My Travel Diary')

  const listQ = useQuery({ queryKey: ['diaries', email], queryFn: () => listDiaries(email!), enabled: status==='authenticated' && !!email })
  const createMut = useMutation({
    mutationFn: () => createDiary(title.trim() || 'Untitled', email!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diaries', email] })
  })

  if (status !== 'authenticated' || !email) return <main className="p-6">Sign in to use Diary.</main>

  const diaries = listQ.data?.diaries ?? []
  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Input value={title} onChange={(e)=>setTitle(e.target.value)} className="w-64" />
        <Button onClick={()=>createMut.mutate()} disabled={createMut.isPending}>Create Diary</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {diaries.map((d:any)=>(
          <a key={d.id} href={`/diary/${d.id}`} className="card">
            <div className="text-lg font-semibold">{d.title}</div>
            <div className="text-xs opacity-70">{new Date(d.created_at).toLocaleString()}</div>
          </a>
        ))}
        {diaries.length===0 && <div className="card">No diaries yet.</div>}
      </div>
    </main>
  )
}