/**
 * Performance Monitoring Hook
 * Track Web Vitals and user interactions
 */

'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

type WebVitalMetric = {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
}

type CustomEvent = {
  name: string
  properties?: Record<string, any>
  timestamp: number
}

// Send metrics to analytics endpoint
async function sendToAnalytics(data: WebVitalMetric | CustomEvent) {
  try {
    // Use navigator.sendBeacon for reliability
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(data)], {
        type: 'application/json',
      })
      navigator.sendBeacon('/api/analytics', blob)
    } else {
      // Fallback to fetch
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true,
      })
    }
  } catch (error) {
    console.error('Failed to send analytics:', error)
  }
}

// Track Web Vitals (disabled - requires web-vitals package)
// To enable: npm install web-vitals
export function useWebVitals() {
  useEffect(() => {
    // Web vitals tracking disabled
    // Uncomment and install web-vitals package to enable
    /*
    if (typeof window === 'undefined') return
    import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
      onCLS((metric: any) => sendToAnalytics(metric as WebVitalMetric))
      onFID((metric: any) => sendToAnalytics(metric as WebVitalMetric))
      onFCP((metric: any) => sendToAnalytics(metric as WebVitalMetric))
      onLCP((metric: any) => sendToAnalytics(metric as WebVitalMetric))
      onTTFB((metric: any) => sendToAnalytics(metric as WebVitalMetric))
    })
    */
  }, [])
}

// Track page views
export function usePageTracking() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams}` : '')
      sendToAnalytics({
        name: 'page_view',
        properties: { url, pathname },
        timestamp: Date.now(),
      })
    }
  }, [pathname, searchParams])
}

// Track user interactions
export function trackEvent(
  eventName: string,
  properties?: Record<string, any>
) {
  sendToAnalytics({
    name: eventName,
    properties,
    timestamp: Date.now(),
  })
}

// Track errors
export function useErrorTracking() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      sendToAnalytics({
        name: 'error',
        properties: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
        },
        timestamp: Date.now(),
      })
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      sendToAnalytics({
        name: 'unhandled_rejection',
        properties: {
          reason: event.reason?.toString(),
          stack: event.reason?.stack,
        },
        timestamp: Date.now(),
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])
}

// Track performance timing
export function trackTiming(name: string, startTime: number) {
  const duration = Date.now() - startTime
  sendToAnalytics({
    name: 'timing',
    properties: { name, duration },
    timestamp: Date.now(),
  })
}

// User session tracking
export function useSessionTracking() {
  useEffect(() => {
    const sessionStart = Date.now()
    const sessionId = crypto.randomUUID()

    // Track session start
    sendToAnalytics({
      name: 'session_start',
      properties: { sessionId },
      timestamp: sessionStart,
    })

    // Track session end on page unload
    const handleUnload = () => {
      const sessionDuration = Date.now() - sessionStart
      sendToAnalytics({
        name: 'session_end',
        properties: { sessionId, duration: sessionDuration },
        timestamp: Date.now(),
      })
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [])
}
