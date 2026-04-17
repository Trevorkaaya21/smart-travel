'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { API_BASE } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Users, MapPinOff } from 'lucide-react'

export type ActiveUser = {
  travel_name: string
  lat: number
  lng: number
}

const DISTANCE_OPTIONS = [
  { label: '1 km', value: 1 },
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '25 km', value: 25 },
] as const

type ActiveUsersLayerProps = {
  onUsersChange: (users: ActiveUser[]) => void
}

export function ActiveUsersLayer({ onUsersChange }: ActiveUsersLayerProps) {
  const { data: session } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const [radius, setRadius] = React.useState(10)
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null)
  const [locationDenied, setLocationDenied] = React.useState(false)

  React.useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationDenied(true),
      { maximumAge: 60_000 }
    )
  }, [])

  const { data } = useQuery({
    queryKey: ['active-users', userLocation?.lat, userLocation?.lng, radius],
    queryFn: async () => {
      if (!userLocation) return { users: [] }
      try {
        const res = await fetch(
          `${API_BASE}/v1/users/active?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${radius}`,
          {
            cache: 'no-store',
            headers: email ? { 'x-user-email': email } : {},
          }
        )
        if (!res.ok) return { users: [] }
        return res.json() as Promise<{ users: ActiveUser[] }>
      } catch {
        return { users: [] }
      }
    },
    enabled: !!userLocation,
    staleTime: 30_000,
    gcTime: 60_000,
    refetchInterval: 30_000,
  })

  const rawUsers = data?.users
  const users = React.useMemo(() => rawUsers ?? [], [rawUsers])

  const prevSerializedRef = React.useRef('')
  React.useEffect(() => {
    const serialized = JSON.stringify(users)
    if (serialized === prevSerializedRef.current) return
    prevSerializedRef.current = serialized
    onUsersChange(users)
  }, [users, onUsersChange])

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium shadow-lg backdrop-blur-xl"
        style={{
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'white',
        }}
      >
        {locationDenied ? (
          <>
            <MapPinOff className="h-3.5 w-3.5 opacity-60" />
            <span>Location unavailable</span>
          </>
        ) : (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
            </span>
            <Users className="h-3.5 w-3.5" />
            <span>{users.length} traveler{users.length !== 1 ? 's' : ''} nearby</span>
          </>
        )}
      </div>

      {!locationDenied && (
        <div className="flex gap-1">
          {DISTANCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={radius === opt.value}
              onClick={() => setRadius(opt.value)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all duration-150 backdrop-blur-md',
                radius === opt.value
                  ? 'bg-green-500 text-white shadow-md'
                  : 'bg-black/40 text-white/80 hover:bg-black/50 hover:text-white'
              )}
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
