'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'

const GoogleMapView = dynamic(
  () => import('@/components/map/google-map').then((m) => m.GoogleMapView),
  { ssr: false, loading: () => <MapSkeleton /> }
)
const LeafletMap = dynamic(
  () => import('@/components/map/leaflet-map').then((m) => m.LeafletMap),
  { ssr: false, loading: () => <MapSkeleton /> }
)

type Marker = { id: string; name: string; lat?: number | null; lng?: number | null }
type ActiveUser = { travel_name: string; lat: number; lng: number }

type SmartMapProps = {
  markers: Marker[]
  fullScreen?: boolean
  className?: string
  activeUsers?: ActiveUser[]
}

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: '#1a1a2e', minHeight: 300 }}>
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-white/60">Loading map...</span>
      </div>
    </div>
  )
}

export function SmartMap(props: SmartMapProps) {
  const [useLeaflet, setUseLeaflet] = React.useState(false)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey || useLeaflet) {
    return <LeafletMap {...props} />
  }

  return (
    <GoogleMapView
      {...props}
      onError={() => setUseLeaflet(true)}
    />
  )
}
