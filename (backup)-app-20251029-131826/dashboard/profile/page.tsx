'use client'
import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { API_BASE } from '@/lib/configure'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

async function getProfile(email: string) {
  const r = await fetch(`${API_BASE}/v1/profile?email=${encodeURIComponent(email)}`, { cache: 'no-store' })
  if (!r.ok) throw new Error('load_failed'); return r.json()
}
async function saveProfile(payload: any, email: string) {
  const r = await fetch(`${API_BASE}/v1/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-user-email': email }, body: JSON.stringify(payload) })
  if (!r.ok) throw new Error('save_failed'); return r.json()
}
async function deleteProfile(email: string) {
  const r = await fetch(`${API_BASE}/v1/profile`, { method: 'DELETE', headers: { 'x-user-email': email } })
  if (!r.ok) throw new Error('delete_failed'); return r.json()
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const qc = useQueryClient()

  const profQ = useQuery({ queryKey:['profile', email], queryFn:()=>getProfile(email!), enabled: status==='authenticated' && !!email })
  const [displayName, setDisplayName] = React.useState('')
  const [homeBase, setHomeBase] = React.useState('')
  const [bio, setBio] = React.useState('')

  React.useEffect(()=>{
    const p = profQ.data?.profile
    if (p) { setDisplayName(p.display_name ?? ''); setHomeBase(p.home_base ?? ''); setBio(p.bio ?? '') }
  }, [profQ.data])

  const saveMut = useMutation({
    mutationFn: ()=>saveProfile({ display_name: displayName, home_base: homeBase, bio }, email!),
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['profile', email] })
  })
  const delMut = useMutation({
    mutationFn: ()=>deleteProfile(email!),
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['profile', email] })
  })

  if (status !== 'authenticated' || !email) return <main className="p-6">Sign in to view your profile.</main>

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <div className="card">
        <Input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Display name" />
        <Input value={homeBase} onChange={e=>setHomeBase(e.target.value)} placeholder="Home base (city)" />
        <Textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="About you" />
        <div className="flex gap-2">
          <Button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending}>Save</Button>
          <Button variant="destructive" onClick={()=>delMut.mutate()} disabled={delMut.isPending}>Delete Profile</Button>
        </div>
      </div>
    </main>
  )
}