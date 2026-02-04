'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function useAnalytics() {
  const pathname = usePathname()

  useEffect(() => {
    // Track page views
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ; (window as any).gtag('config', process.env.NEXT_PUBLIC_GA_ID, {
        page_path: pathname,
      })
    }
  }, [pathname])

  const trackEvent = (eventName: string, params?: Record<string, any>) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ; (window as any).gtag('event', eventName, params)
    }
  }

  return { trackEvent }
}
