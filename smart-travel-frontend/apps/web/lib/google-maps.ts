// apps/web/lib/google-maps.ts

declare global {
  interface Window {
    initSmartTravelGoogleMaps?: () => void
    __SMART_TRAVEL_GOOGLE_MAPS__?: Promise<typeof google.maps>
  }
}

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window_unavailable'))
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps)
  }

  if (window.__SMART_TRAVEL_GOOGLE_MAPS__) {
    return window.__SMART_TRAVEL_GOOGLE_MAPS__
  }

  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAP_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY

  if (!apiKey) {
    return Promise.reject(new Error('maps_key_missing'))
  }

  window.__SMART_TRAVEL_GOOGLE_MAPS__ = new Promise<typeof google.maps>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-smart-travel-maps]')

    if (existing) {
      existing.addEventListener('load', () => {
        if (window.google?.maps) resolve(window.google.maps)
        else reject(new Error('maps_not_loaded'))
      })
      existing.addEventListener('error', () => reject(new Error('maps_failed_load')))
      return
    }

    window.initSmartTravelGoogleMaps = () => {
      if (window.google?.maps) resolve(window.google.maps)
      else reject(new Error('maps_not_ready'))
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&callback=initSmartTravelGoogleMaps`
    script.async = true
    script.defer = true
    script.dataset.smartTravelMaps = 'true'
    script.addEventListener('error', () => reject(new Error('maps_failed_load')))
    document.head.appendChild(script)
  })

  return window.__SMART_TRAVEL_GOOGLE_MAPS__
}

export function isGoogleMapsAvailable() {
  if (typeof window === 'undefined') return false
  return !!window.google?.maps
}
