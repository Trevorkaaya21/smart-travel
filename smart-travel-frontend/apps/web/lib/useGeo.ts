'use client'

import { useEffect, useState } from 'react'

export function useGeo() {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 600_000 }
    )
  }, [])

  return pos
}