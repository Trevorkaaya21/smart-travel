'use client'
import * as React from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Marker = { id: string; name: string; lat?: number | null; lng?: number | null }

export function MapView({ markers }: { markers: Marker[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<L.Map | null>(null)
  const layerRef = React.useRef<L.LayerGroup | null>(null)

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapRef.current = L.map(containerRef.current, {
      center: [37.7749, -122.4194],
      zoom: 3,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(mapRef.current)

    layerRef.current = L.layerGroup().addTo(mapRef.current)

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (!mapRef.current || !layerRef.current) return

    layerRef.current.clearLayers()

    const valid = markers.filter(m => m.lat != null && m.lng != null) as Required<Marker>[]
    valid.forEach(m => {
      L.marker([m.lat!, m.lng!]).addTo(layerRef.current!).bindPopup(m.name)
    })

    if (valid.length) {
      const bounds = L.latLngBounds(valid.map(m => [m.lat!, m.lng!] as [number, number]))
      mapRef.current.fitBounds(bounds, { padding: [24, 24] })
    }
  }, [markers])

  return <div ref={containerRef} className="card" />
}