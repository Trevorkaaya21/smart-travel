'use client'
import * as React from 'react'
import L, { Map as LeafletMapType, LayerGroup } from 'leaflet'
import 'leaflet/dist/leaflet.css'

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

type Marker = { id: string; name: string; lat?: number | null; lng?: number | null }

type ActiveUser = { travel_name: string; lat: number; lng: number }

type LeafletMapProps = {
  markers: Marker[]
  fullScreen?: boolean
  className?: string
  activeUsers?: ActiveUser[]
  onMapReady?: (map: LeafletMapType) => void
}

const DEFAULT_CENTER: [number, number] = [20, 0]
const DEFAULT_ZOOM = 3

export function LeafletMap({ markers, fullScreen, className, activeUsers, onMapReady }: LeafletMapProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<LeafletMapType | null>(null)
  const layerRef = React.useRef<LayerGroup | null>(null)
  const usersLayerRef = React.useRef<LayerGroup | null>(null)
  const initializedRef = React.useRef(false)

  React.useEffect(() => {
    if (!ref.current || mapRef.current) return

    const map = L.map(ref.current, {
      zoomControl: false,
      attributionControl: !fullScreen,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    })
    mapRef.current = map
    initializedRef.current = true

    if (fullScreen) {
      L.control.zoom({ position: 'topright' }).addTo(map)

      const LocateControl = L.Control.extend({
        options: { position: 'topright' as L.ControlPosition },
        onAdd() {
          const btn = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-locate-btn')
          btn.innerHTML = '<button type="button" title="My location" aria-label="Go to my location"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg></button>'
          L.DomEvent.disableClickPropagation(btn)
          btn.querySelector('button')!.addEventListener('click', () => {
            navigator.geolocation?.getCurrentPosition(
              (pos) => map.flyTo([pos.coords.latitude, pos.coords.longitude], 14, { duration: 1.2 }),
              () => {},
              { maximumAge: 60_000 }
            )
          })
          return btn
        },
      })
      new LocateControl().addTo(map)
    } else {
      L.control.zoom({ position: 'topleft' }).addTo(map)
    }

    const apiKey =
      process.env.NEXT_PUBLIC_GEOAPIFY_KEY || process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || ''

    let tilesUrl: string
    let attribution: string

    if (fullScreen) {
      tilesUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      attribution = '&copy; Esri'
    } else if (apiKey) {
      tilesUrl = `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${apiKey}`
      attribution = '&copy; Geoapify, &copy; OpenStreetMap contributors'
    } else {
      tilesUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      attribution = '&copy; OpenStreetMap contributors'
    }

    L.tileLayer(tilesUrl, { attribution, crossOrigin: true, maxZoom: 19 }).addTo(map)

    if (fullScreen) {
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; CartoDB', maxZoom: 19, opacity: 0.7, subdomains: 'abcd' }
      ).addTo(map)
    }

    const lg = L.layerGroup().addTo(map)
    layerRef.current = lg

    const ug = L.layerGroup().addTo(map)
    usersLayerRef.current = ug

    onMapReady?.(map)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const map = mapRef.current
    const group = layerRef.current
    if (!map || !group || !initializedRef.current) return

    group.clearLayers()

    const coords = markers.filter(
      (p): p is Marker & { lat: number; lng: number } =>
        typeof p.lat === 'number' && typeof p.lng === 'number'
    )

    if (coords.length) {
      const bounds = L.latLngBounds(coords.map(c => [c.lat, c.lng] as [number, number]))
      try { map.fitBounds(bounds.pad(0.2)) } catch { /* bounds error guard */ }
      coords.forEach(c => L.marker([c.lat, c.lng]).addTo(group).bindPopup(c.name))
    }
  }, [markers, fullScreen])

  React.useEffect(() => {
    const map = mapRef.current
    const group = usersLayerRef.current
    if (!map || !group || !activeUsers) return

    group.clearLayers()

    activeUsers.forEach(user => {
      const icon = L.divIcon({
        className: 'active-user-marker',
        html: `<div class="active-user-dot"><span class="active-user-label">${user.travel_name}</span></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      })
      L.marker([user.lat, user.lng], { icon }).addTo(group)
    })
  }, [activeUsers])

  return (
    <div
      ref={ref}
      className={
        className ??
        (fullScreen
          ? 'absolute inset-0 h-full w-full'
          : 'h-[520px] w-full rounded-2xl border border-black/10 bg-white lg:h-[640px]')
      }
    />
  )
}