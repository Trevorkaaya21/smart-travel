'use client'

import * as React from 'react'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

type MarkerData = { id: string; name: string; lat?: number | null; lng?: number | null }
type ActiveUser = { travel_name: string; lat: number; lng: number }

type GoogleMapProps = {
  markers: MarkerData[]
  fullScreen?: boolean
  className?: string
  activeUsers?: ActiveUser[]
  onMapReady?: (map: google.maps.Map) => void
  onError?: () => void
}

const DEFAULT_CENTER = { lat: 20, lng: 0 }
const DEFAULT_ZOOM = 3

function waitForGoogleMaps(timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google.maps) {
      resolve()
      return
    }
    const start = Date.now()
    const interval = setInterval(() => {
      if (typeof google !== 'undefined' && google.maps) {
        clearInterval(interval)
        resolve()
      } else if (Date.now() - start > timeout) {
        clearInterval(interval)
        reject(new Error('Google Maps timeout'))
      }
    }, 100)
  })
}

export function GoogleMapView({
  markers,
  fullScreen,
  className,
  activeUsers,
  onMapReady,
  onError,
}: GoogleMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<google.maps.Map | null>(null)
  const markersRef = React.useRef<google.maps.Marker[]>([])
  const userMarkersRef = React.useRef<google.maps.Marker[]>([])
  const infoWindowRef = React.useRef<google.maps.InfoWindow | null>(null)
  const [loaded, setLoaded] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    if (!API_KEY || !containerRef.current) {
      setFailed(true)
      onError?.()
      return
    }

    let cancelled = false

    const errorHandler = (e: Event) => {
      const msg = (e as any)?.message || ''
      if (typeof msg === 'string' && (msg.includes('BillingNotEnabled') || msg.includes('Google Maps'))) {
        if (!cancelled) { setFailed(true); onError?.() }
      }
    }
    window.addEventListener('error', errorHandler)

    waitForGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return

        const map = new google.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          gestureHandling: 'greedy',
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          scaleControl: false,
          rotateControl: false,
          mapTypeId: fullScreen ? 'hybrid' : 'roadmap',
          backgroundColor: '#1a1a2e',
          styles: fullScreen ? undefined : [
            { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
            { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#0e1626' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
            { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
            { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
            { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
            { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
            { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
            { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
          ],
        })

        mapRef.current = map
        infoWindowRef.current = new google.maps.InfoWindow()
        setLoaded(true)
        onMapReady?.(map)
      })
      .catch(() => {
        if (!cancelled) { setFailed(true); onError?.() }
      })

    return () => {
      cancelled = true
      window.removeEventListener('error', errorHandler)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    const coords = markers.filter(
      (p): p is MarkerData & { lat: number; lng: number } =>
        typeof p.lat === 'number' && typeof p.lng === 'number'
    )

    if (coords.length > 0) {
      const bounds = new google.maps.LatLngBounds()

      coords.forEach((c) => {
        bounds.extend({ lat: c.lat, lng: c.lng })

        const marker = new google.maps.Marker({
          map,
          position: { lat: c.lat, lng: c.lng },
          title: c.name,
          animation: google.maps.Animation.DROP,
        })

        marker.addListener('click', () => {
          infoWindowRef.current?.setContent(
            `<div style="padding:6px 10px;font-weight:600;font-size:14px;color:#1a1a2e">${c.name}</div>`
          )
          infoWindowRef.current?.open(map, marker)
        })

        markersRef.current.push(marker)
      })

      map.fitBounds(bounds, { top: 80, right: 60, bottom: 100, left: 60 })
    }
  }, [markers, loaded])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    userMarkersRef.current.forEach((m) => m.setMap(null))
    userMarkersRef.current = []

    activeUsers?.forEach((user) => {
      const marker = new google.maps.Marker({
        map,
        position: { lat: user.lat, lng: user.lng },
        title: user.travel_name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#16a34a',
          strokeWeight: 2,
        },
        label: {
          text: user.travel_name,
          color: 'white',
          fontSize: '10px',
          fontWeight: '600',
          className: 'gmap-user-label',
        },
      })

      userMarkersRef.current.push(marker)
    })
  }, [activeUsers, loaded])

  if (failed) return null

  const containerClass =
    className ??
    (fullScreen
      ? 'absolute inset-0 h-full w-full'
      : 'h-[520px] w-full rounded-2xl border border-black/10 bg-[#1a1a2e] lg:h-[640px]')

  return (
    <div className={containerClass} style={{ position: 'relative' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', borderRadius: fullScreen ? 0 : 16 }}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#1a1a2e', borderRadius: fullScreen ? 0 : 16 }}>
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-white/60">Loading map...</span>
          </div>
        </div>
      )}
      {loaded && fullScreen && <MyLocationButton mapRef={mapRef} />}
    </div>
  )
}

function MyLocationButton({ mapRef }: { mapRef: React.RefObject<google.maps.Map | null> }) {
  const handleClick = React.useCallback(() => {
    const m = mapRef.current
    if (!m || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        m.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        m.setZoom(14)
      },
      () => {},
      { maximumAge: 60_000 }
    )
  }, [mapRef])

  return (
    <button
      type="button"
      onClick={handleClick}
      title="My location"
      aria-label="Go to my location"
      className="absolute top-20 right-2.5 z-10 flex h-10 w-10 items-center justify-center rounded-lg shadow-lg backdrop-blur-xl transition-all hover:scale-105"
      style={{
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: 'white',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
      </svg>
    </button>
  )
}
