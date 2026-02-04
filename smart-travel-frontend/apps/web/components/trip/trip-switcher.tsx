'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { API_BASE } from '@/lib/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Trip = { id: string; name: string }

export function TripSwitcher() {
  const router = useRouter()
  const { data: session } = useSession()
  const email = (session?.user as any)?.email as string | undefined

  const tripsQ = useQuery({
    queryKey: ['trips', email],
    enabled: !!email,
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/v1/trips?owner_email=${encodeURIComponent(email!)}`, { cache: 'no-store' })
      if (!r.ok) throw new Error('trips_load_failed')
      return (await r.json()) as { defaultTripId?: string; trips: Trip[] }
    },
  })

  const [newName, setNewName] = React.useState('')
  const createMut = useMutation({
    mutationFn: async (name: string) => {
      const r = await fetch(`${API_BASE}/v1/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email! },
        body: JSON.stringify({ name }),
      })
      if (!r.ok) throw new Error('create_failed')
      return (await r.json()) as { id: string }
    },
    onSuccess: (data) => {
      setNewName('')
      router.push(`/trip/${data.id}`)
    },
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="btn">
          Trips
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>Your trips</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tripsQ.data?.trips?.length ? (
          tripsQ.data.trips.map((t) => (
            <DropdownMenuItem key={t.id} onClick={() => router.push(`/trip/${t.id}`)}>
              {t.name || t.id}
            </DropdownMenuItem>
          ))
        ) : (
          <div className="px-2 py-1.5 text-sm opacity-70">No trips yet.</div>
        )}
        <DropdownMenuSeparator />
        <div className="px-2 py-2 space-y-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New trip name"
          />
          <Button
            className="w-full"
            disabled={!email || createMut.isPending}
            onClick={() => createMut.mutate(newName || 'New Trip')}
          >
            {createMut.isPending ? 'Creating…' : 'Create trip'}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}