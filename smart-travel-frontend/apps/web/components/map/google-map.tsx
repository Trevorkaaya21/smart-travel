'use client'

import * as React from 'react'
import { loadGoogleMaps } from '@/lib/google-maps'

type Marker = {
  id: string
  name: string
  lat?: number | null
  lng?: number | null
}

export function GoogleMap({ markers, onError }: { markers: Marker[]; onError?: () => void }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mapNodeRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<google.maps.Map | null>(null)
  const markerRefs = React.useRef<google.maps.Marker[]>([])
  const [ready, setReady] = React.useState(false)
  const [errored, setErrored] = React.useState(false)

  const handleError = React.useCallback(() => {
    setErrored(true)
    onError?.()
  }, [onError])

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

    function handleMapsError() {
      if (!cancelled) handleError()
    }

    const onWindowError = (e: ErrorEvent) => {
      const msg = (e.message ?? '').toLowerCase()
      if (msg.includes('billingnotenabled') || msg.includes('billing_not_enabled') || msg.includes('maps api error')) {
        handleMapsError()
      }
    }
    window.addEventListener('error', onWindowError)

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
        } catch (_err) {
          if (!cancelled) setErrored(true)
        }
      })
      .catch(() => {
        if (!cancelled) handleError()
      })

    return () => {
      cancelled = true
      window.removeEventListener('error', onWindowError)
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
  }, [handleError])

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

  if (errored && !onError) {
    return (
      <div className="ui-glass flex h-[520px] w-full flex-col items-center justify-center gap-2 rounded-3xl px-4 text-center text-sm text-[rgb(var(--muted))]">
        <p>Map unavailable.</p>
        <p className="text-xs">
          Enable billing for Maps in Google Cloud, or check your API key.
        </p>
      </div>
    )
  }

  if (errored && onError) return null

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
