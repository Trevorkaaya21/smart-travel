import type { Place, Trip } from '../types'
import { API_URL } from './env'

type AiSearchResponse = {
  items: Place[]
}

type TripListResponse = {
  trips: Trip[]
  defaultTripId?: string | null
}

export async function aiSearch(params: { query: string }) {
  const body = JSON.stringify({ q: params.query })
  const res = await fetch(`${API_URL}/v1/ai/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Search failed')
  }

  return (await res.json()) as AiSearchResponse
}

export async function fetchTrips(email: string) {
  const res = await fetch(`${API_URL}/v1/trips?owner_email=${encodeURIComponent(email)}`, {
    headers: { 'Cache-Control': 'no-cache' }
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Could not load trips')
  }

  return (await res.json()) as TripListResponse
}
