'use client'

import * as React from 'react'
import { loadGoogleMaps } from '@/lib/google-maps'

type Marker = {
  id: string
  name: string
  lat?: number | null
  lng?: number | null
}

export function GoogleMap({ markers }: { markers: Marker[] }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mapNodeRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<google.maps.Map | null>(null)
  const markerRefs = React.useRef<google.maps.Marker[]>([])
  const [ready, setReady] = React.useState(false)
  const [errored, setErrored] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    const host = containerRef.current
    if (!host) return () => {}

    if (!mapNodeRef.current) {
      mapNodeRef.current = document.createElement('div')
      mapNodeRef.current.style.position = 'absolute'
      mapNodeRef.current.style.inset = '0'
      host.appendChild(mapNodeRef.current)
    }

    const mountNode = mapNodeRef.current

    if (mapRef.current) {
      setReady(true)
      return () => {
        cancelled = true
      }
    }

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled) return
        if (!mountNode) return

        try {
          const map = new maps.Map(mountNode, {
            zoom: 4,
            center: { lat: 37.773972, lng: -122.431297 },
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
            styles: mapStyles,
          })
          mapRef.current = map
          setReady(true)
        } catch (err) {
          console.warn('Google Maps init failed', err)
          if (!cancelled) setErrored(true)
        }
      })
      .catch((err) => {
        console.warn('Google Maps failed to load', err)
        if (!cancelled) setErrored(true)
      })

    return () => {
      cancelled = true
      if (markerRefs.current.length) {
        markerRefs.current.forEach((marker) => {
          try {
            marker.setMap(null)
          } catch (_) {
            // ignore
          }
        })
        markerRefs.current = []
      }

      if (mapRef.current) {
        if (typeof window !== 'undefined' && (window as any).google?.maps?.event?.clearInstanceListeners) {
          try {
            (window as any).google.maps.event.clearInstanceListeners(mapRef.current)
          } catch (_) {
            // ignore
          }
        }
        mapRef.current = null
      }

      if (mapNodeRef.current?.parentNode) {
        try {
          mapNodeRef.current.parentNode.removeChild(mapNodeRef.current)
        } catch (_) {
          // ignore
        }
      }
      mapNodeRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map) return

    markerRefs.current.forEach(marker => marker.setMap(null))
    markerRefs.current = []

    const coords = markers.filter(
      (m): m is Marker & { lat: number; lng: number } =>
        typeof m.lat === 'number' && typeof m.lng === 'number'
    )

    if (!coords.length) {
      map.setCenter({ lat: 37.773972, lng: -122.431297 })
      map.setZoom(3)
      return
    }

    const bounds = new google.maps.LatLngBounds()

    for (const point of coords) {
      const marker = new google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        map,
        title: point.name,
        animation: google.maps.Animation.DROP,
      })
      markerRefs.current.push(marker)
      bounds.extend(marker.getPosition()!)
    }

    map.fitBounds(bounds, 80)
  }, [markers, ready])

  if (errored) {
    return (
      <div className="ui-glass flex h-[520px] w-full items-center justify-center rounded-3xl text-sm text-slate-200/70">
        Google Maps unavailable. Try again later.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[520px] w-full rounded-3xl border border-white/15 bg-white/10 shadow-lg backdrop-blur-xl lg:h-[620px]"
    >
      {!ready && (
        <div className="flex h-full items-center justify-center text-sm text-white/80">
          Loading map…
        </div>
      )}
    </div>
  )
}

const mapStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0B1220' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B1220' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9CA3AF' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#dfe7ff' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#c7d2fe' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#11301B' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6EE7B7' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1E293B' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#312E81' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#4338CA' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1E293B' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0F172A' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#B4E3FF' }],
  },
]
