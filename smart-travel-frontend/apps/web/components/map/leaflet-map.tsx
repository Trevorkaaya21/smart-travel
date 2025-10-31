// apps/web/components/maps/leaflet-map.tsx
'use client'
import * as React from 'react'
import L, { Map as LeafletMapType, LayerGroup } from 'leaflet'
import 'leaflet/dist/leaflet.css'

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

type Marker = { id: string; name: string; lat?: number | null; lng?: number | null }

export function LeafletMap({ markers }: { markers: Marker[] }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<LeafletMapType | null>(null)
  const layerRef = React.useRef<LayerGroup | null>(null)

  React.useEffect(() => {
    if (!ref.current || mapRef.current) return

    const map = L.map(ref.current, { zoomControl: true })
    mapRef.current = map

    const apiKey =
      process.env.NEXT_PUBLIC_GEOAPIFY_KEY || process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || ''

    // Always use a LIGHT Geoapify style for clarity
    const style = 'osm-bright' // good clear light theme

    const tilesUrl = apiKey
      ? `https://maps.geoapify.com/v1/tile/${style}/{z}/{x}/{y}.png?apiKey=${apiKey}`
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

    const attribution = apiKey
      ? '© Geoapify, © OpenStreetMap contributors'
      : '© OpenStreetMap contributors'

    L.tileLayer(tilesUrl, { attribution, crossOrigin: true }).addTo(map)

    const lg = L.layerGroup().addTo(map)
    layerRef.current = lg
  }, [])

  React.useEffect(() => {
    const map = mapRef.current
    const group = layerRef.current
    if (!map || !group) return

    group.clearLayers()

    // OpenTrip POIs -> markers
    const coords = markers.filter(
      (p): p is Marker & { lat: number; lng: number } =>
        typeof p.lat === 'number' && typeof p.lng === 'number'
    )

    if (coords.length) {
      const bounds = L.latLngBounds(coords.map(c => [c.lat, c.lng] as [number, number]))
      map.fitBounds(bounds.pad(0.2))
      coords.forEach(c => L.marker([c.lat, c.lng]).addTo(group).bindPopup(c.name))
    } else {
      map.setView([37.7749, -122.4194], 3)
    }
  }, [markers])

  return (
    <div
      ref={ref}
      className="h-[520px] w-full rounded-2xl border border-black/10 bg-white lg:h-[640px]"
    />
  )
}