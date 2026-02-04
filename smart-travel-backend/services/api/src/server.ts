// services/api/src/server.ts
import './preload-env.js'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import compress from '@fastify/compress'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import { z } from 'zod'
import { supa } from './supabase.js'
import {
  aiSearchBodySchema,
  aiSuggestBodySchema,
  tripsPostBodySchema,
  tripItemsPostBodySchema,
  favoritesBodySchema,
  profilePutBodySchema,
  profileAvatarBodySchema,
  profileGetQuerySchema,
  chatConversationsPostBodySchema,
  chatMessagesPostBodySchema,
  usersSearchQuerySchema,
  placeImageQuerySchema,
  tripsGetQuerySchema,
} from './schemas.js'
import { customAlphabet } from 'nanoid'
import { randomUUID } from 'node:crypto'

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16)

/** In-memory TTL cache for geocoding and search - scales with many users by reducing external API calls */
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour for geocode
const SEARCH_CACHE_TTL_MS = 1000 * 60 * 15 // 15 min for search results
const CACHE_MAX_ENTRIES = 1000

interface CacheEntry<T> { value: T; expiresAt: number }
const geocodeCache = new Map<string, CacheEntry<{ lat: number; lng: number }>>()
const searchCache = new Map<string, CacheEntry<any[]>>()

function pruneCache<T>(cache: Map<string, CacheEntry<T>>, maxSize: number) {
  if (cache.size <= maxSize) return
  const now = Date.now()
  for (const [k, v] of cache.entries()) {
    if (v.expiresAt <= now) cache.delete(k)
    if (cache.size <= maxSize) break
  }
  if (cache.size > maxSize) {
    const keysToDelete = [...cache.keys()].slice(0, cache.size - maxSize)
    keysToDelete.forEach(k => cache.delete(k))
  }
}

function cachedGet<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key)
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) cache.delete(key)
    return null
  }
  return entry.value
}

function cachedSet<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  pruneCache(cache, CACHE_MAX_ENTRIES)
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

/** Fetch with timeout to prevent hanging on slow external APIs */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } finally {
    clearTimeout(t)
  }
}

// Groq AI configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
// Free APIs for maps and photos
const DIARY_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'diary-photos'
const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET || 'avatars'
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || ''
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || ''
// Foursquare Places API for better search results
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY || ''
type TripAccessRole = 'owner' | 'collaborator'
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif'
}
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function ensureEmail(h: Record<string, any> | undefined) {
  const email = (h?.['x-user-email'] as string | undefined)?.toLowerCase?.()
  if (!email) throw Object.assign(new Error('auth_required'), { statusCode: 401 })
  return email
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

function isMissingTableOrColumn(err: any) {
  const msg = String(err?.message ?? err).toLowerCase()
  return msg.includes('does not exist') || msg.includes('relation') || msg.includes('column')
}

/** Sanitize user text to prevent XSS - strip script tags and dangerous patterns */
function sanitizeText(input: string, maxLen = 10_000): string {
  if (typeof input !== 'string') return ''
  const s = input.slice(0, maxLen)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
  return s.trim()
}

/** Parse input with Zod; on error send 400 and return null (OWASP: strict validation). */
function validate<T>(schema: z.ZodType<T>, data: unknown, reply: any): T | null {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  const first = result.error.flatten().formErrors[0] ?? result.error.message
  reply.code(400).send({ error: 'validation_failed', message: first })
  return null
}

async function aiRefine(q: string) {
  if (!GROQ_API_KEY) return q.trim()
  
  const prompt = `You are a travel search assistant. Extract the location and place type from this query.
  
Examples:
- "miami clubs" → "clubs in Miami"
- "best restaurants paris" → "restaurants in Paris"
- "coffee shops near me tokyo" → "coffee shops in Tokyo"
- "bars downtown new york" → "bars in New York"
- "things to do london" → "attractions in London"
- "sushi restaurants" → "sushi restaurants"
- "hotels beach resort" → "beach resort hotels"

User query: "${q}"

Return ONLY the refined search query (location + place type). Be concise. No explanations.`

  try {
    const { text } = await generateWithGroq(prompt)
    const refined = text?.trim()
    if (refined && refined.length > 0 && refined.length < 200) {
      console.log('AI refined:', q, '→', refined)
      return refined
    }
    return q.trim()
  } catch (err) {
    console.warn('aiRefine fallback', err)
    return q.trim()
  }
}

async function upsertPlaceFromPayload(place: any) {
  if (!place || !place.id) return
  const lat = typeof place.lat === 'number' ? place.lat : place.lat != null ? Number(place.lat) : null
  const lngSource = place.lng ?? place.lon
  const lng = typeof lngSource === 'number' ? lngSource : lngSource != null ? Number(lngSource) : null
  const rating = typeof place.rating === 'number' ? place.rating : place.rating != null ? Number(place.rating) : null
  const name = place.name != null ? String(place.name) : String(place.id)

  const row = {
    id: String(place.id),
    name,
    category: place.category ?? 'poi',
    rating,
    lat,
    lng
  }

  const { error } = await supa.from('places').upsert(row, { onConflict: 'id' })
  if (error) throw error
}

/**
 * Search places using Foursquare Places API - free tier, better results
 * Returns restaurants, cafes, attractions, clubs, hotels, ANY type of place
 */
async function searchPlacesFoursquare(q: string, lat?: number, lng?: number, limit = 20, radius = 6000) {
  if (!FOURSQUARE_API_KEY) return null // Return null to indicate API key not configured
  
  try {
    // Extract location from query if present
    let searchQuery = q
    let searchLat = lat
    let searchLng = lng
    
    // If no coordinates provided, try to extract location from query
    if (searchLat == null || searchLng == null) {
      const geo = await geocodeLocation(q)
      if (!geo) {
        console.warn('Could not geocode location for:', q)
        return null
      }
      searchLat = geo.lat
      searchLng = geo.lng
      
      // Remove location from query to keep only the place type
      // e.g., "clubs in Miami" → "clubs" (location is now in lat/lng)
      const locationWords = ['in', 'near', 'at', 'around']
      for (const word of locationWords) {
        const regex = new RegExp(`\\s+${word}\\s+.+$`, 'i')
        searchQuery = searchQuery.replace(regex, '').trim()
      }
    }
    
    // Foursquare Places API v3 - search for ANY type of place
    const url = new URL('https://api.foursquare.com/v3/places/search')
    url.searchParams.set('ll', `${searchLat},${searchLng}`)
    url.searchParams.set('radius', String(Math.min(radius, 15000))) // Max 15km for broader search
    url.searchParams.set('limit', String(Math.min(limit, 50)))
    url.searchParams.set('query', searchQuery)
    url.searchParams.set('fields', 'fsq_id,name,categories,geocodes,location,rating,popularity') // Request all useful fields
    
    const res = await fetchWithTimeout(url.toString(), {
      headers: {
        'Authorization': FOURSQUARE_API_KEY,
        'Accept': 'application/json'
      }
    }, 10000)
    
    if (!res.ok) {
      console.warn('Foursquare API failed:', res.status, res.statusText)
      return null
    }
    
    const data = await res.json()
    const results = data?.results ?? []
    
    if (!results.length) {
      console.warn('Foursquare returned no results for:', q)
      return []
    }
    
    console.log(`Foursquare found ${results.length} places for "${q}"`)
    
    return results.map((place: any) => {
      // Get all category names for better classification
      const categories = place.categories || []
      const categoryNames = categories.map((c: any) => c.name).filter(Boolean)
      const primaryCategory = categoryNames[0] || 'Place'
      
      // Build comprehensive address
      const addressParts = [
        place.location?.address,
        place.location?.locality || place.location?.city,
        place.location?.region,
        place.location?.country
      ].filter(Boolean)
      
      const formattedAddress = place.location?.formatted_address || addressParts.join(', ')
      
      return {
        id: `fsq-${place.fsq_id}`,
        name: place.name,
        category: primaryCategory,
        categories: categoryNames, // Include all categories for better filtering
        rating: place.rating || null,
        popularity: place.popularity || null,
        lat: place.geocodes?.main?.latitude,
        lng: place.geocodes?.main?.longitude,
        address: formattedAddress,
        photoRef: null,
      }
    }).filter((p: any) => p.lat != null && p.lng != null)
  } catch (err) {
    console.error('Foursquare search failed:', err)
    return null
  }
}

/**
 * Search places using Overpass API (OpenStreetMap) - completely free, no API key needed
 * Returns places near a location or matching a query
 */
async function searchPlacesOSM(q: string, lat?: number, lng?: number, limit = 20, radius = 6000) {
  try {
    const radiusM = Math.min(radius, 10000) // max 10km radius
    
    // If we have coordinates, search around that location
    if (typeof lat === 'number' && typeof lng === 'number') {
      // Enhanced Overpass query to handle ANY place type
      // Includes clubs, bars, hotels, attractions, restaurants, shops, etc.
      const query = `
        [out:json][timeout:15];
        (
          node["name"]["tourism"](around:${radiusM},${lat},${lng});
          node["name"]["amenity"](around:${radiusM},${lat},${lng});
          node["name"]["shop"](around:${radiusM},${lat},${lng});
          node["name"]["leisure"](around:${radiusM},${lat},${lng});
          node["name"]["club"](around:${radiusM},${lat},${lng});
          way["name"]["tourism"](around:${radiusM},${lat},${lng});
          way["name"]["amenity"](around:${radiusM},${lat},${lng});
          way["name"]["building"](around:${radiusM},${lat},${lng});
        );
        out body ${limit * 3} center;
      `.trim()
      
      try {
        const res = await fetchWithTimeout('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }, 12000)
        
        if (!res.ok) {
          console.warn('Overpass API failed:', res.status, res.statusText)
          return []
        }
        
        const data = await res.json()
        const elements = data?.elements ?? []
        
        if (!elements.length) {
          console.warn('No results from Overpass API for', { lat, lng, radiusM })
          return []
        }
        
        return elements
          .filter((el: any) => el.tags?.name)
          .slice(0, limit)
          .map((el: any) => {
            // For ways, use center point if available
            const itemLat = el.lat ?? el.center?.lat
            const itemLng = el.lon ?? el.center?.lon
            
            // Get the most relevant category
            const category = el.tags.tourism 
              || el.tags.amenity 
              || el.tags.leisure 
              || el.tags.shop
              || el.tags.club
              || el.tags.building
              || 'place'
            
            // Build address from OSM tags
            const addressParts = [
              el.tags['addr:housenumber'],
              el.tags['addr:street'],
              el.tags['addr:city'] || el.tags['addr:suburb'],
              el.tags['addr:country']
            ].filter(Boolean)
            
            return {
              id: `osm-${el.type}-${el.id}`,
              name: el.tags.name,
              category: category,
              rating: null,
              lat: itemLat,
              lng: itemLng,
              address: addressParts.length > 0 ? addressParts.join(', ') : null,
              photoRef: null,
            }
          })
          .filter((p: any) => p.lat != null && p.lng != null) // Only return items with coordinates
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.warn('Overpass API timeout after 12s')
        } else {
          console.warn('Overpass API error:', err.message)
        }
        return []
      }
    }
    
    // Otherwise, we need coordinates - try to geocode the query
    // Extract just the location part if possible
    const location = extractLocation(q)
    if (!location) {
      console.warn('Could not extract location from query:', q)
      return []
    }
    
    console.log('Attempting to geocode location:', location, 'from query:', q)
    const geo = await geocodeLocation(location)
    
    if (!geo) {
      console.warn('Could not geocode location:', location)
      return []
    }
    
    // Now search around that location with the coordinates
    return await searchPlacesOSM(q, geo.lat, geo.lng, limit, radius)
  } catch (err) {
    console.error('searchPlacesOSM failed:', err)
    return []
  }
}

/**
 * Geocode using Nominatim (OpenStreetMap) - free, no API key needed
 */
/**
 * Extract location from a search query
 * "coffee shops in Paris" → "Paris"
 * "clubs miami" → "miami"
 * "restaurants" → null (no location)
 */
function extractLocation(query: string): string | null {
  // Check for "in [location]" pattern
  const inMatch = query.match(/\s+in\s+([a-zA-Z\s]+)$/i)
  if (inMatch) return inMatch[1].trim()
  
  // Check for "near [location]" pattern
  const nearMatch = query.match(/\s+near\s+([a-zA-Z\s]+)$/i)
  if (nearMatch) return nearMatch[1].trim()
  
  // Check for "[place type] [location]" pattern (e.g., "clubs miami")
  const words = query.trim().split(/\s+/)
  if (words.length === 2) {
    // Last word might be location
    return words[1]
  }
  
  // If query has 3+ words and last few might be location
  if (words.length >= 3) {
    // Try last 1-2 words as location
    return words.slice(-2).join(' ')
  }
  
  return null
}

async function geocodeLocation(text: string) {
  try {
    let locationToGeocode = text
    const extracted = extractLocation(text)
    if (extracted && extracted !== text) {
      locationToGeocode = extracted
    }
    const cacheKey = `geo:${locationToGeocode.toLowerCase().trim()}`
    const cached = cachedGet(geocodeCache, cacheKey)
    if (cached) return cached

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationToGeocode)}&format=json&limit=1`
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'SmartTravelApp/1.0' } }, 8000)
    
    if (!res.ok) return null
    const data = await res.json()
    
    if (!Array.isArray(data) || !data.length) return null
    
    const place = data[0]
    const lat = parseFloat(place.lat)
    const lng = parseFloat(place.lon)
    
    if (isNaN(lat) || isNaN(lng)) return null
    
    const result = { lat, lng }
    cachedSet(geocodeCache, cacheKey, result, CACHE_TTL_MS)
    return result
  } catch (err) {
    console.warn('geocodeLocation failed', err)
    return null
  }
}

/**
 * Get place photos from Unsplash or Pexels (both free)
 * Returns photo URL and credit info
 */
async function getPlacePhoto(placeName: string): Promise<{ url: string; credit: string } | null> {
  // Try Unsplash first
  if (UNSPLASH_ACCESS_KEY) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(placeName)}&per_page=1&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
      )
      
      if (res.ok) {
        const data = await res.json()
        const photo = data?.results?.[0]
        if (photo?.urls?.regular) {
          return {
            url: photo.urls.regular,
            credit: `Photo by ${photo.user?.name || 'Unsplash'} on Unsplash`,
          }
        }
      }
    } catch (err) {
      console.warn('Unsplash photo fetch failed', err)
    }
  }
  
  // Fallback to Pexels
  if (PEXELS_API_KEY) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(placeName)}&per_page=1&orientation=landscape`,
        { headers: { Authorization: PEXELS_API_KEY } }
      )
      
      if (res.ok) {
        const data = await res.json()
        const photo = data?.photos?.[0]
        if (photo?.src?.large) {
          return {
            url: photo.src.large,
            credit: `Photo by ${photo.photographer} on Pexels`,
          }
        }
      }
    } catch (err) {
      console.warn('Pexels photo fetch failed', err)
    }
  }
  
  return null
}

function parseDataUrl(input: string) {
  const match = /^data:([\w/+.-]+);base64,(.*)$/i.exec(input ?? '')
  if (!match) return null
  const [, mime, base64] = match
  if (!mime || !base64) return null
  try {
    const buffer = Buffer.from(base64, 'base64')
    if (!buffer.length) return null
    return { mime, buffer }
  } catch {
    return null
  }
}

async function uploadDiaryPhotoFromDataUrl(diaryId: string, dataUrl: string) {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) throw Object.assign(new Error('invalid_image_data'), { statusCode: 400 })

  const ext = MIME_EXTENSION[parsed.mime] || 'jpg'
  const maxBytes = 1.5 * 1024 * 1024
  if (parsed.buffer.byteLength > maxBytes) {
    throw Object.assign(new Error('image_too_large'), { statusCode: 413 })
  }
  const fileName = `${diaryId}/${new Date().toISOString().split('T')[0]}-${randomUUID()}.${ext}`
  const { error } = await supa.storage.from(DIARY_BUCKET).upload(fileName, parsed.buffer, {
    cacheControl: '3600',
    contentType: parsed.mime,
    upsert: false,
  })
  if (error) {
    // Attempt to create bucket if missing then retry once
    if (String(error.message).toLowerCase().includes('not found')) {
      const { error: bucketErr } = await supa.storage.createBucket(DIARY_BUCKET, { public: true })
      if (bucketErr && !String(bucketErr.message).includes('already exists')) {
        throw bucketErr
      }
      const retry = await supa.storage.from(DIARY_BUCKET).upload(fileName, parsed.buffer, {
        cacheControl: '3600',
        contentType: parsed.mime,
        upsert: false,
      })
      if (retry.error) throw retry.error
    } else {
      throw error
    }
  }
  const { data } = supa.storage.from(DIARY_BUCKET).getPublicUrl(fileName)
  return { path: fileName, url: data.publicUrl }
}

function publicDiaryPhotoUrl(path: string | null | undefined) {
  if (!path) return null
  const { data } = supa.storage.from(DIARY_BUCKET).getPublicUrl(path)
  return data.publicUrl || null
}

async function uploadAvatarFromDataUrl(email: string, dataUrl: string) {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) throw Object.assign(new Error('invalid_image_data'), { statusCode: 400 })
  const ext = MIME_EXTENSION[parsed.mime] || 'jpg'
  const maxBytes = 1024 * 1024 // 1MB for avatars
  if (parsed.buffer.byteLength > maxBytes) {
    throw Object.assign(new Error('image_too_large'), { statusCode: 413 })
  }
  const safeEmail = email.replace(/[^a-z0-9@._-]/gi, '_').toLowerCase()
  const fileName = `${safeEmail}/${randomUUID()}.${ext}`
  const { error } = await supa.storage.from(AVATAR_BUCKET).upload(fileName, parsed.buffer, {
    cacheControl: '3600',
    contentType: parsed.mime,
    upsert: true,
  })
  if (error) {
    if (String(error.message).toLowerCase().includes('not found')) {
      const { error: bucketErr } = await supa.storage.createBucket(AVATAR_BUCKET, { public: true })
      if (bucketErr && !String(bucketErr.message).includes('already exists')) throw bucketErr
      const retry = await supa.storage.from(AVATAR_BUCKET).upload(fileName, parsed.buffer, {
        cacheControl: '3600',
        contentType: parsed.mime,
        upsert: true,
      })
      if (retry.error) throw retry.error
    } else {
      throw error
    }
  }
  const { data } = supa.storage.from(AVATAR_BUCKET).getPublicUrl(fileName)
  return data.publicUrl || null
}

async function fetchPlaceImageFromUnsplash(query: string): Promise<{ url: string; credit: string } | null> {
  if (!UNSPLASH_ACCESS_KEY || !query?.trim()) return null
  try {
    const q = encodeURIComponent(query.trim().slice(0, 100))
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${q}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const hit = data?.results?.[0]
    if (!hit?.urls?.regular) return null
    const credit = hit.user?.name ? `Photo by ${hit.user.name} on Unsplash` : 'Unsplash'
    return { url: hit.urls.regular, credit }
  } catch (err) {
    console.warn('Unsplash place image failed', err)
    return null
  }
}

type TripAccessResult = {
  trip: { id: string; name?: string | null; owner_email: string | null; created_at?: string | null }
  role: TripAccessRole
}

async function ensureTripAccess(tripId: string, email: string): Promise<TripAccessResult> {
  const normalized = normalizeEmail(email)
  const { data: trip, error: tripError } = await supa
    .from('trips')
    .select('id, name, owner_email, created_at')
    .eq('id', tripId)
    .single()

  if (tripError || !trip) throw Object.assign(new Error('not_found'), { statusCode: 404 })

  const ownerEmail = normalizeEmail(trip.owner_email)
  if (ownerEmail && ownerEmail === normalized) {
    return { trip, role: 'owner' }
  }

  const { data: collaborator, error: collError } = await supa
    .from('trip_collaborators')
    .select('id, status')
    .eq('trip_id', tripId)
    .eq('email', normalized)
    .eq('status', 'accepted')
    .maybeSingle()

  if (collError) throw collError
  if (collaborator) {
    return { trip, role: 'collaborator' }
  }

  throw Object.assign(new Error('forbidden'), { statusCode: 403 })
}

type CollaboratorPayload = {
  email: string
  role: TripAccessRole
  invited_by: string | null
  status: string
  created_at: string
}

async function listCollaborators(tripId: string, trip: { owner_email: string | null; created_at?: string | null }) {
  const ownerEmail = normalizeEmail(trip.owner_email)
  const ownerEntry: CollaboratorPayload | null = ownerEmail
    ? {
        email: ownerEmail,
        role: 'owner',
        invited_by: ownerEmail,
        status: 'owner',
        created_at: trip.created_at ?? new Date().toISOString(),
      }
    : null

  const { data, error } = await supa
    .from('trip_collaborators')
    .select('email, invited_by, status, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })

  if (error) throw error

  const collaborators =
    data?.map((row: any) => ({
      email: normalizeEmail(row.email),
      role: 'collaborator' as TripAccessRole,
      invited_by: row.invited_by ?? ownerEmail ?? null,
      status: row.status ?? 'accepted',
      created_at: row.created_at ?? new Date().toISOString(),
    })) ?? []

  return ownerEntry ? [ownerEntry, ...collaborators] : collaborators
}

/**
 * Generate a placeholder image for places without photos
 * Returns a generic travel/location image from Unsplash
 */
function getStaticMap(lat: number | null, lng: number | null, _width = 640, _height = 360) {
  if (lat == null || lng == null) return null
  // Return a nice generic travel/location placeholder from Unsplash
  // These are free to use and don't require authentication
  const placeholders = [
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=900&h=600&fit=crop', // Travel
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=900&h=600&fit=crop', // Destination
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=900&h=600&fit=crop', // Lake
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=900&h=600&fit=crop', // Paris
    'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=900&h=600&fit=crop', // Mountains
  ]
  // Use lat/lng to pick a consistent placeholder for the same location
  const index = Math.abs(Math.floor((lat + lng) * 100)) % placeholders.length
  return placeholders[index]
}

async function generateWithGroq(prompt: string, systemPrompt?: string) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured')
  
  const url = 'https://api.groq.com/openai/v1/chat/completions'
  const messages: any[] = []
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  const body = {
    model: GROQ_MODEL,
    messages,
    temperature: 0.8,
    max_tokens: 1024,
    top_p: 0.95,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(body)
  })

  const rawText = await res.text()
  let parsed: any = null
  try {
    parsed = rawText ? JSON.parse(rawText) : null
  } catch {
    parsed = null
  }

  if (!res.ok) {
    const error = new Error(parsed?.error?.message || rawText || `Groq request failed (${res.status})`)
    ;(error as any).status = res.status
    ;(error as any).raw = rawText
    throw error
  }

  const text = parsed?.choices?.[0]?.message?.content?.trim() || ''
  return { text, model: GROQ_MODEL, raw: parsed }
}

const server = Fastify({ logger: true })

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
]

/** In development, allow any localhost / 127.0.0.1 origin (any port) for flexibility. */
function isLocalOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && (u.protocol === 'http:' || u.protocol === 'https:')
  } catch {
    return false
  }
}

function resolveCorsOrigins(): string[] {
  const envSources = [
    process.env.CORS_ALLOWED_ORIGINS,
    process.env.APP_PUBLIC_URL,
    process.env.NEXT_PUBLIC_SITE_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.WEB_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ]

  const extra = envSources
    .flatMap((entry) => (entry ? entry.split(',') : []))
    .map((value) => value?.trim())
    .filter((value): value is string => !!value)

  return Array.from(new Set([...DEFAULT_CORS_ORIGINS, ...extra]))
}

const corsOrigins = resolveCorsOrigins()
const isDev = process.env.NODE_ENV !== 'production'
server.log.info({ corsOrigins, isDev }, 'CORS config')

await server.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (corsOrigins.includes(origin)) return cb(null, true)
    if (isDev && isLocalOrigin(origin)) return cb(null, true)
    cb(new Error(`Origin ${origin} not allowed by CORS`), false)
  },
  allowedHeaders: ['Content-Type', 'x-user-email'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})

await server.register(helmet, { contentSecurityPolicy: false })
await server.register(compress, { global: true })

// Rate limiting: IP-based by default; when x-user-email present, per-user so one user cannot exhaust an IP pool (OWASP, scalability).
await server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => {
    const ip = (req.ip ?? req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'] ?? 'unknown').toString().trim()
    const user = (req.headers['x-user-email'] as string)?.trim()?.toLowerCase()
    return user ? `${ip}:${user}` : ip
  },
  errorResponseBuilder: (_req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please retry after a short while.',
    retryAfter: Math.ceil(Number(context.after ?? 0) / 1000),
  }),
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true,
  },
})

await server.register(swagger, {
  openapi: { info: { title: 'Smart Travel API', version: '0.3.0' } }
})

server.get('/health', async (req, reply) => {
  const checks: Record<string, boolean> = { api: true }
  try {
    const { error } = await supa.from('trips').select('id').limit(1)
    checks.db = !error
  } catch {
    checks.db = false
  }
  const ok = checks.api && checks.db
  return reply.code(ok ? 200 : 503).send({ ok, checks })
})

server.get(
  '/v1/echo',
  { schema: { querystring: { type: 'object', properties: { q: { type: 'string' } } } } },
  async (req) => {
    const qs = z.object({ q: z.string().min(1) }).parse((req as any).query)
    return { echo: qs.q }
  }
)

server.get('/v1/ai/debug', async () => {
  const env = {
    GROQ_API_KEY: !!GROQ_API_KEY,
    GROQ_MODEL: GROQ_MODEL,
    FOURSQUARE_API_KEY: !!FOURSQUARE_API_KEY,
    UNSPLASH_ACCESS_KEY: !!UNSPLASH_ACCESS_KEY,
    PEXELS_API_KEY: !!PEXELS_API_KEY,
  }
  let ai_ok = false
  let ai_sample: string | null = null
  let ai_error: string | null = null
  try {
    const refined = await aiRefine('best tacos mission sf')
    ai_ok = true
    ai_sample = refined
  } catch (_err) {
    ai_ok = false
    ai_error = (_err as Error)?.message || 'ai_error'
  }
  return { env, checks: { ai_ok, ai_sample, ai_error } }
})

server.post(
  '/v1/ai/search',
  {
    schema: {
      body: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          limit: { type: 'number' },
          radius: { type: 'number' },
          profile: { type: 'object' }
        },
        required: ['q']
      }
    }
  },
  async (req, reply) => {
    const body = validate(aiSearchBodySchema, req.body, reply)
    if (body == null) return
    const { q, lat, lng, limit = 20, radius = 6000 } = body
    const refined = await aiRefine(q)

    let _lat = typeof lat === 'number' ? lat : undefined
    let _lng = typeof lng === 'number' ? lng : undefined

    if (_lat == null || _lng == null) {
      const ge = await geocodeLocation(refined)
      if (ge) {
        _lat = ge.lat
        _lng = ge.lng
      }
    }

    const searchCacheKey = `search:${refined}:${_lat ?? 'n'}:${_lng ?? 'n'}:${limit}:${radius}`
    const cachedResult = cachedGet(searchCache, searchCacheKey)
    if (cachedResult) {
      return { refined, items: cachedResult }
    }

    // Try Foursquare first (better results), fall back to OSM
    let places = await searchPlacesFoursquare(refined, _lat, _lng, limit, radius)
    
    // If Foursquare not configured or failed, use OSM as fallback
    if (places === null || places.length === 0) {
      console.log('Using OSM fallback for search')
      places = await searchPlacesOSM(refined, _lat, _lng, limit, radius)
    } else {
      console.log('Using Foursquare results:', places.length, 'places found')
    }

    const normalized: any[] = []
    
    for (const p of places) {
      const base: any = {
        id: p.id,
        name: p.name,
        category: p.category || 'poi',
        rating: p.rating ?? null,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        because: p.address ? `${p.address}` : `Recommended near ${refined}`,
        photo: null,
        photo_credit: null
      }

      // Get photo from Unsplash/Pexels
      if (base.name) {
        const photoData = await getPlacePhoto(base.name)
        if (photoData) {
          base.photo = photoData.url
          base.photo_credit = photoData.credit
        }
      }

      // Fallback to static map
      if (!base.photo) {
        const staticMap = getStaticMap(base.lat, base.lng)
        if (staticMap) {
          base.photo = staticMap
          base.photo_credit = 'OpenStreetMap'
        }
      }

      normalized.push(base)
    }

    cachedSet(searchCache, searchCacheKey, normalized, SEARCH_CACHE_TTL_MS)
    return { refined, items: normalized }
  }
)

server.post(
  '/v1/ai/suggest',
  {
    schema: {
      body: {
        type: 'object',
        properties: { prompt: { type: 'string' } },
        required: ['prompt']
      }
    }
  },
  async (req, reply) => {
    const body = validate(aiSuggestBodySchema, req.body, reply)
    if (body == null) return
    const { prompt } = body
    if (!GROQ_API_KEY) {
      return reply.code(501).send({ error: 'ai_disabled', message: 'Groq API key not configured' })
    }

    try {
      const systemPrompt = 'You are a concise travel assistant. Keep answers short and practical.'
      const { text, model, raw } = await generateWithGroq(prompt, systemPrompt)
      return { model, text, raw }
    } catch (err: any) {
      req.log.error({ err }, 'ai_suggest_failed')
      const status = err?.status && Number.isInteger(err.status) ? err.status : 500
      return reply.code(status).send({
        error: 'ai_exception',
        message: err?.message || 'Unable to generate response',
        raw: err?.raw
      })
    }
  }
)

server.get(
  '/v1/places',
  {
    schema: {
      querystring: {
        type: 'object',
        properties: { q: { type: 'string' }, limit: { type: 'number' }, lat: { type: 'number' }, lng: { type: 'number' }, radius: { type: 'number' } },
        required: ['q']
      }
    }
  },
  async (req) => {
    const { q, limit = 20, lat, lng, radius = 6000 } = (req as any).query as { q: string; limit?: number; lat?: number; lng?: number; radius?: number }
    const r = await server.inject({ method: 'POST', url: '/v1/ai/search', payload: { q, lat, lng, limit, radius } })
    return r.json()
  }
)

server.get('/v1/trips', {}, async (req, reply) => {
  const q = validate(tripsGetQuerySchema, req.query, reply)
  if (q == null) return
  const { owner_email } = q
  const limit = q.limit ?? 50
  const offset = q.offset ?? 0

  const { data: trips, error } = await supa
    .from('trips')
    .select('id, name, owner_email, is_public, share_id, created_at')
    .eq('owner_email', owner_email)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) return reply.code(500).send({ error: 'db_error' })

  let list = trips ?? []
  let defaultTripId = list[0]?.id as string | undefined

  if (!defaultTripId) {
    const { data: created, error: cErr } = await supa
      .from('trips')
      .insert({ owner_email, name: 'My Trip' })
      .select('id, name, owner_email, is_public, share_id, created_at')
      .single()
    if (cErr) return reply.code(500).send({ error: 'db_error' })
    defaultTripId = created!.id
    list = [created!]
  }

  return { defaultTripId, trips: list }
})

server.post('/v1/trips', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const body = validate(tripsPostBodySchema, req.body, reply)
    if (body == null) return
    const name = body.name ?? 'New Trip'
    const { data, error } = await supa.from('trips').insert({ owner_email: email, name }).select('id').single()
    if (error) throw error
    return { id: data!.id }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

server.delete('/v1/trips/:id', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const id = (req.params as any)?.id as string
    const { data: trip, error: tErr } = await supa.from('trips').select('owner_email').eq('id', id).single()
    if (tErr || !trip) return reply.code(404).send({ error: 'not_found' })
    if (trip.owner_email?.toLowerCase() !== email) return reply.code(403).send({ error: 'forbidden' })
    const { error } = await supa.from('trips').delete().eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

server.patch('/v1/trips/:id', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const id = (req.params as any)?.id as string
    const name = (req.body as any)?.name as string | undefined
    if (!name || !name.trim()) return reply.code(400).send({ error: 'name_required' })
    const { data: trip, error: tripErr } = await supa.from('trips').select('id, owner_email').eq('id', id).single()
    if (tripErr || !trip) return reply.code(404).send({ error: 'not_found' })
    if (trip.owner_email?.toLowerCase() !== email) return reply.code(403).send({ error: 'forbidden' })
    const { error } = await supa.from('trips').update({ name }).eq('id', id)
    if (error) throw error
    return { ok: true, name }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

server.get('/v1/trips/:id', {}, async (req, reply) => {
  const id = (req.params as any)?.id as string
  const { data, error } = await supa.from('trips').select('id, name, owner_email, is_public, share_id').eq('id', id).single()
  if (error || !data) return reply.code(404).send({ error: 'not_found' })
  return { trip: data }
})

server.get('/v1/trips/:id/items', {}, async (req, reply) => {
  const id = (req.params as any)?.id as string
  const { data, error } = await supa
    .from('trip_items')
    .select('id, place_id, day, note, created_at, places(name, category, rating, photo, photo_credit)')
    .eq('trip_id', id)
    .order('day', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return reply.code(500).send({ error: 'db_error' })
  const items = (data ?? []).map((r: any) => ({
    id: r.id,
    place_id: r.place_id,
    day: r.day,
    note: r.note,
    created_at: r.created_at,
    name: r.places?.name,
    category: r.places?.category,
    rating: r.places?.rating,
    photo: r.places?.photo ?? null,
    photo_credit: r.places?.photo_credit ?? null
  }))
  return { items }
})

server.post('/v1/trips/:id/items', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const id = (req.params as any)?.id as string
    const body = validate(tripItemsPostBodySchema, req.body, reply)
    if (body == null) return
    const { place_id, day = 1, note, place } = body
    const noteStr = (note ?? '')?.toString().trim().slice(0, 500) ?? ''

    const { data: trip, error: tErr } = await supa.from('trips').select('owner_email').eq('id', id).single()
    if (tErr || !trip) return reply.code(404).send({ error: 'not_found' })
    if (trip.owner_email?.toLowerCase() !== email) return reply.code(403).send({ error: 'forbidden' })

    if (place) await upsertPlaceFromPayload(place)

    const { error } = await supa.from('trip_items').insert({ trip_id: id, place_id, day: Number(day) || 1, note: noteStr || null })
    if (error) throw error
    return { ok: true }
  } catch (e: any) {
    req.log.error(e)
    return reply.code(e.statusCode || 500).send({
      error: 'db_error',
      message: e?.message || 'unknown_error'
    })
  }
})

server.delete('/v1/trips/:id/items/:itemId', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const id = (req.params as any)?.id as string
    const itemId = (req.params as any)?.itemId as string
    const { data: trip, error: tErr } = await supa.from('trips').select('owner_email').eq('id', id).single()
    if (tErr || !trip) return reply.code(404).send({ error: 'not_found' })
    if (trip.owner_email?.toLowerCase() !== email) return reply.code(403).send({ error: 'forbidden' })
    const { error } = await supa.from('trip_items').delete().eq('id', itemId).eq('trip_id', id)
    if (error) throw error
    return { ok: true }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

server.patch('/v1/trips/:id/items/:itemId', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const id = (req.params as any)?.id as string
    const itemId = (req.params as any)?.itemId as string
    const { day, note } = (req.body as any) ?? {}
    const patch: any = {}
    if (day != null) patch.day = Number(day)
    if (note != null) patch.note = String(note)
    const { data: trip, error: tErr } = await supa.from('trips').select('owner_email').eq('id', id).single()
    if (tErr || !trip) return reply.code(404).send({ error: 'not_found' })
    if (trip.owner_email?.toLowerCase() !== email) return reply.code(403).send({ error: 'forbidden' })
    const { error } = await supa.from('trip_items').update(patch).eq('id', itemId).eq('trip_id', id)
    if (error) throw error
    return { ok: true }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

server.get('/v1/trips/:id/chat', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const tripId = (req.params as any)?.id as string
    const access = await ensureTripAccess(tripId, email)
    const collaborators = await listCollaborators(tripId, access.trip)

    const { data: messages, error } = await supa
      .from('trip_messages')
      .select('id, author_email, message, created_at')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return {
      role: access.role,
      collaborators,
      messages: (messages ?? []).map((msg: any) => ({
        id: msg.id,
        author_email: normalizeEmail(msg.author_email),
        message: msg.message,
        created_at: msg.created_at,
      })),
    }
  } catch (e: any) {
    const status = e?.statusCode || e?.status || 500
    const message = e?.message || 'Unable to load chat'
    return reply.code(status).send({ error: message })
  }
})

server.post('/v1/trips/:id/chat', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const tripId = (req.params as any)?.id as string
    await ensureTripAccess(tripId, email)

    const textRaw = ((req.body as any)?.message ?? '').toString()
    const text = textRaw.trim()
    if (!text) return reply.code(400).send({ error: 'message_required' })
    if (text.length > 2000) return reply.code(400).send({ error: 'message_too_long' })

    const author = normalizeEmail(email)
    const { data, error } = await supa
      .from('trip_messages')
      .insert({ trip_id: tripId, author_email: author, message: text })
      .select('id, author_email, message, created_at')
      .single()

    if (error) throw error

    return {
      message: {
        id: data?.id,
        author_email: normalizeEmail(data?.author_email),
        message: data?.message,
        created_at: data?.created_at,
      },
    }
  } catch (e: any) {
    const status = e?.statusCode || e?.status || 500
    const message = e?.message || 'Unable to send message'
    return reply.code(status).send({ error: message })
  }
})

server.post('/v1/trips/:id/collaborators', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const tripId = (req.params as any)?.id as string
    const access = await ensureTripAccess(tripId, email)
    if (access.role !== 'owner') return reply.code(403).send({ error: 'Only the owner can share this trip.' })

    const rawInvite = (req.body as any)?.email as string | undefined
    const invitee = normalizeEmail(rawInvite)
    if (!invitee || !EMAIL_REGEX.test(invitee)) {
      return reply.code(400).send({ error: 'Provide a valid email address.' })
    }

    if (invitee === normalizeEmail(email)) {
      return reply.code(400).send({ error: 'You are already the owner of this trip.' })
    }

    const { data: existing, error: existingErr } = await supa
      .from('trip_collaborators')
      .select('email, invited_by, status, created_at')
      .eq('trip_id', tripId)
      .eq('email', invitee)
      .maybeSingle()

    if (existingErr) throw existingErr

    if (existing) {
      return {
        collaborator: {
          email: invitee,
          role: 'collaborator',
          invited_by: existing.invited_by ?? normalizeEmail(email),
          status: existing.status ?? 'accepted',
          created_at: existing.created_at ?? new Date().toISOString(),
        },
        duplicate: true,
      }
    }

    const { data, error } = await supa
      .from('trip_collaborators')
      .insert({
        trip_id: tripId,
        email: invitee,
        invited_by: normalizeEmail(email),
        status: 'accepted',
      })
      .select('email, invited_by, status, created_at')
      .single()

    if (error) throw error

    return {
      collaborator: {
        email: invitee,
        role: 'collaborator',
        invited_by: data?.invited_by ?? normalizeEmail(email),
        status: data?.status ?? 'accepted',
        created_at: data?.created_at ?? new Date().toISOString(),
      },
    }
  } catch (e: any) {
    const status = e?.statusCode || e?.status || 500
    const message = e?.message || 'Unable to add collaborator'
    return reply.code(status).send({ error: message })
  }
})

server.post('/v1/trips/:id/reorder', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const id = (req.params as any)?.id as string
    const { day, order } = (req.body as any) as { day: number; order: string[] }
    if (!Array.isArray(order) || typeof day !== 'number') return reply.code(400).send({ error: 'bad_request' })
    const { data: trip, error: tErr } = await supa.from('trips').select('owner_email').eq('id', id).single()
    if (tErr || !trip) return reply.code(404).send({ error: 'not_found' })
    if (trip.owner_email?.toLowerCase() !== email) return reply.code(403).send({ error: 'forbidden' })
    const base = Date.now()
    for (let i = 0; i < order.length; i++) {
      const ts = new Date(base + i).toISOString()
      await supa.from('trip_items').update({ created_at: ts, day }).eq('id', order[i]).eq('trip_id', id)
    }
    return { ok: true }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

server.patch('/v1/trips/:id/share', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const id = (req.params as any)?.id as string
    const make_public = !!(req.body as any)?.make_public
    const { data: trip, error: tErr } = await supa.from('trips').select('owner_email, share_id').eq('id', id).single()
    if (tErr || !trip) return reply.code(404).send({ error: 'not_found' })
    if (trip.owner_email?.toLowerCase() !== email) return reply.code(403).send({ error: 'forbidden' })
    const share_id = make_public ? (trip.share_id || nanoid()) : null
    const { error } = await supa.from('trips').update({ is_public: make_public, share_id }).eq('id', id)
    if (error) throw error
    return { is_public: make_public, share_id }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

server.get('/v1/share/:shareId', {}, async (req, reply) => {
  const shareId = (req.params as any)?.shareId as string
  const { data: trip, error } = await supa.from('trips').select('id, name, is_public, share_id').eq('share_id', shareId).single()
  if (error || !trip || !trip.is_public) return reply.code(404).send({ error: 'not_found' })
  const { data: items, error: iErr } = await supa
    .from('trip_items')
    .select('id, place_id, day, note, created_at, places(name, category, rating)')
    .eq('trip_id', trip.id)
    .order('day', { ascending: true })
    .order('created_at', { ascending: true })
  if (iErr) return reply.code(500).send({ error: 'db_error' })
  const normalized = (items ?? []).map((r: any) => ({
    id: r.id,
    place_id: r.place_id,
    day: r.day,
    note: r.note,
    created_at: r.created_at,
    name: r.places?.name,
    category: r.places?.category,
    rating: r.places?.rating
  }))
  return { trip, items: normalized }
})

server.get('/v1/favorites', {}, async (req, reply) => {
  try {
    const email = ((req.query as any).user_email as string | undefined)?.toLowerCase()
    if (!email) return reply.code(400).send({ error: 'user_email_required' })
    const { data, error } = await supa
      .from('favorites')
      .select('place_id, created_at')
      .eq('user_email', email)
      .order('created_at', { ascending: false })
    if (error) throw error

    const placeIds = Array.from(new Set((data ?? []).map((row: any) => row.place_id).filter(Boolean)))
    const placeMap = new Map<string, any>()

    if (placeIds.length) {
      const { data: placeRows, error: placeErr } = await supa
        .from('places')
        .select('id, name, category, rating, lat, lng, photo, photo_credit')
        .in('id', placeIds as string[])
      if (placeErr) throw placeErr
      for (const row of placeRows ?? []) {
        placeMap.set(row.id, {
          id: row.id,
          name: row.name,
          category: row.category,
          rating: row.rating,
          lat: row.lat,
          lng: row.lng,
          photo: row.photo,
          photo_credit: row.photo_credit,
        })
      }
    }

    const favorites = (data ?? []).map((row: any) => ({
      place_id: row.place_id as string,
      created_at: row.created_at,
      place: placeMap.get(row.place_id) ?? null,
    }))
    return { favorites }
  } catch (e) {
    req.log.error(e as any)
    return reply.code(500).send({ error: 'db_error' })
  }
})

server.post('/v1/favorites', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const body = validate(favoritesBodySchema, req.body, reply)
    if (body == null) return
    const { place_id, place } = body
    if (place) await upsertPlaceFromPayload(place)
    const { error } = await supa.from('favorites').insert({ user_email: email, place_id })
    if (error && !String(error.message).includes('duplicate key')) throw error
    return { ok: true }
  } catch (e: any) {
    req.log.error(e)
    return reply.code(500).send({
      error: 'db_error',
      message: e?.message || 'unknown_error'
    })
  }
})

server.delete('/v1/favorites', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const place_id = (req.body as any)?.place_id as string | undefined
    if (!place_id) return reply.code(400).send({ error: 'place_id_required' })
    const { error } = await supa.from('favorites').delete().eq('user_email', email).eq('place_id', place_id)
    if (error) throw error
    return { ok: true }
  } catch (e) {
    req.log.error(e as any)
    return reply.code(500).send({ error: 'db_error', message: (e as any)?.message || 'unknown_error' })
  }
})

server.get('/v1/diary', {}, async (req, reply) => {
  const email = ((req.query as any).user_email as string | undefined)?.toLowerCase()
  if (!email) return reply.code(400).send({ error: 'user_email_required' })
  const { data, error } = await supa.from('diaries').select('*').eq('owner_email', email).order('created_at', { ascending: false })
  if (error) return reply.code(500).send({ error: 'db_error' })
  return { diaries: data ?? [] }
})

server.post('/v1/diary', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const title = (req.body as any)?.title as string | undefined
    if (!title) return reply.code(400).send({ error: 'title_required' })
    const { data, error } = await supa.from('diaries').insert({ owner_email: email, title }).select('id').single()
    if (error) throw error
    return { id: data!.id }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

server.get('/v1/diary/:id/entries', {}, async (req, reply) => {
  try {
    const id = (req.params as any)?.id as string
    const email = (req.headers as any)?.['x-user-email']?.toLowerCase?.()

    const { data: diary, error: dErr } = await supa
      .from('diaries')
      .select('title, owner_email')
      .eq('id', id)
      .single()

    if (dErr || !diary) return reply.code(404).send({ error: 'not_found' })
    if (email && diary.owner_email?.toLowerCase() !== email) {
      return reply.code(403).send({ error: 'forbidden' })
    }

    const { data, error } = await supa
      .from('diary_entries')
      .select('*')
      .eq('diary_id', id)
      .order('day', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return reply.code(500).send({ error: 'db_error' })
    const items = (data ?? []).map((entry: any) => ({
      ...entry,
      photo_url: entry.photo_path ? publicDiaryPhotoUrl(entry.photo_path) : null,
    }))
    return { diary, items }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

server.post('/v1/diary/:id/entries', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const id = (req.params as any)?.id as string
    const body = (req.body as any) ?? {}
    const textRaw = body?.text as string | undefined
    const photoData = typeof body?.photo_data === 'string' ? body.photo_data : null
    const photoCaption = typeof body?.photo_caption === 'string' ? sanitizeText(body.photo_caption, 500) : null
    const text = sanitizeText(textRaw ?? '', 10_000)
    const day = Number(body?.day ?? 1) || 1

    if (!text && !photoData) return reply.code(400).send({ error: 'content_required' })
    if (photoData && photoData.length > 2_000_000) {
      return reply.code(413).send({ error: 'file_too_large' })
    }

    const { data: diary, error: dErr } = await supa
      .from('diaries')
      .select('owner_email')
      .eq('id', id)
      .single()

    if (dErr || !diary) return reply.code(404).send({ error: 'not_found' })
    if (diary.owner_email?.toLowerCase() !== email) return reply.code(403).send({ error: 'forbidden' })

    const payload: Record<string, any> = {
      diary_id: id,
      text,
      day,
    }
    if (photoData) {
      const uploaded = await uploadDiaryPhotoFromDataUrl(id, photoData)
      payload.photo_path = uploaded.path
    }
    if (photoCaption) payload.photo_caption = photoCaption.trim()

    const { error } = await supa.from('diary_entries').insert(payload)
    if (error) throw error
    return { ok: true }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

server.get('/v1/profile', {}, async (req, reply) => {
  const q = validate(profileGetQuerySchema, req.query, reply)
  if (q == null) return
  const email = q.email
  const { data, error } = await supa.from('profiles').select('*').eq('email', email).single()
  if (error && String(error.message).includes('No rows')) return { profile: null }
  if (error) return reply.code(500).send({ error: 'db_error' })
  return { profile: data }
})

server.get('/v1/stats', {}, async (req, reply) => {
  try {
    const email = (req.headers as any)?.['x-user-email']?.toLowerCase?.() ?? ((req.query as any)?.email as string | undefined)?.toLowerCase?.()
    if (!email) return reply.code(400).send({ error: 'email_required' })

    const { data: trips, error: tripsErr } = await supa
      .from('trips')
      .select('id')
      .eq('owner_email', email)
    if (tripsErr) throw tripsErr
    const tripIds = (trips ?? []).map((t: any) => t.id).filter(Boolean)
    let places_in_trips_count = 0
    if (tripIds.length > 0) {
      const { count, error: countErr } = await supa
        .from('trip_items')
        .select('*', { count: 'exact', head: true })
        .in('trip_id', tripIds)
      if (!countErr) places_in_trips_count = count ?? 0
    }

    const { data: favData, error: favErr } = await supa
      .from('favorites')
      .select('place_id')
      .eq('user_email', email)
    const favorites_count = favErr ? 0 : (favData ?? []).length

    return {
      trips_count: tripIds.length,
      favorites_count: favorites_count,
      places_in_trips_count: places_in_trips_count,
    }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

server.put('/v1/profile', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const body = validate(profilePutBodySchema, req.body, reply)
    if (body == null) return
    const { display_name, home_base, bio, avatar_url, travel_name } = body
    const payload: Record<string, any> = { email, display_name: display_name ?? undefined, home_base: home_base ?? undefined, bio: bio ?? undefined }
    if (avatar_url !== undefined) payload.avatar_url = avatar_url === '' ? null : avatar_url
    if (travel_name !== undefined) payload.travel_name = travel_name === '' ? null : travel_name
    const { error } = await supa.from('profiles').upsert(payload, { onConflict: 'email' })
    if (error) {
      if (isMissingTableOrColumn(error)) {
        return reply.code(503).send({ error: 'Profile update requires database migration. Run: pnpm db:push' })
      }
      throw error
    }
    return { ok: true }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

server.post('/v1/profile/avatar', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const body = validate(profileAvatarBodySchema, req.body, reply)
    if (body == null) return
    const dataUrl = body.image
    const url = await uploadAvatarFromDataUrl(email, dataUrl)
    if (!url) return reply.code(400).send({ error: 'upload_failed' })
    const { error } = await supa.from('profiles').upsert({ email, avatar_url: url }, { onConflict: 'email' })
    if (error) throw error
    return { url }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

server.get('/v1/place-image', {}, async (req, reply) => {
  const query = validate(placeImageQuerySchema, req.query, reply)
  if (query == null) return
  const result = await fetchPlaceImageFromUnsplash(query.q)
  if (!result) return reply.code(404).send({ error: 'no_image' })
  return result
})

server.delete('/v1/profile', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const { error } = await supa.from('profiles').delete().eq('email', email)
    if (error) throw error
    return { ok: true }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
})

// --- Users search (by email or travel_name) for Travel Chat ---
server.get('/v1/users/search', {}, async (req, reply) => {
  try {
    const me = ensureEmail(req.headers)
    const query = validate(usersSearchQuerySchema, req.query, reply)
    if (query == null) return
    const q = query.q
    const isEmail = EMAIL_REGEX.test(q)
    const { data: rows, error } = await supa
      .from('profiles')
      .select('email, display_name, travel_name, avatar_url')
      .neq('email', me)
    if (error) {
      if (isMissingTableOrColumn(error)) return { users: [] }
      throw error
    }
    let list = (rows ?? []).map((r: any) => ({
      email: r.email,
      display_name: r.display_name ?? null,
      travel_name: r.travel_name ?? null,
      avatar_url: r.avatar_url ?? null,
    }))
    if (isEmail) {
      list = list.filter((r: any) => normalizeEmail(r.email) === normalizeEmail(q))
    } else {
      const lower = q.toLowerCase()
      list = list.filter(
        (r: any) =>
          (r.display_name && r.display_name.toLowerCase().includes(lower)) ||
          (r.travel_name && r.travel_name.toLowerCase().includes(lower)) ||
          (r.email && r.email.toLowerCase().includes(lower))
      )
    }
    return { users: list.slice(0, 20) }
  } catch (e: any) {
    if (e.statusCode) return reply.code(e.statusCode).send({ error: e.message })
    if (isMissingTableOrColumn(e)) return { users: [] }
    return reply.code(500).send({ error: e.message || 'db_error' })
  }
})

// --- Travel Chat: 1:1 conversations ---
function conversationParticipant(conv: any, myEmail: string) {
  const a = normalizeEmail(conv.user_a_email)
  const b = normalizeEmail(conv.user_b_email)
  return a === normalizeEmail(myEmail) ? b : a
}

server.get('/v1/chat/conversations', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const norm = normalizeEmail(email)
    const { data: rows, error } = await supa
      .from('chat_conversations')
      .select('id, user_a_email, user_b_email, created_at')
      .or(`user_a_email.eq.${norm},user_b_email.eq.${norm}`)
      .order('created_at', { ascending: false })
    if (error) {
      if (isMissingTableOrColumn(error)) return { conversations: [] }
      throw error
    }
    const list = (rows ?? []).map((r: any) => ({
      id: r.id,
      other_email: conversationParticipant(r, email),
      created_at: r.created_at,
    }))
    return { conversations: list }
  } catch (e: any) {
    if (e.statusCode) return reply.code(e.statusCode).send({ error: e.message })
    if (isMissingTableOrColumn(e)) return { conversations: [] }
    return reply.code(500).send({ error: e.message || 'db_error' })
  }
})

server.post('/v1/chat/conversations', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const body = validate(chatConversationsPostBodySchema, req.body, reply)
    if (body === null) return
    let otherEmail: string | null = (body.other_email ?? body.otherEmail)?.trim()?.toLowerCase() ?? null
    const travelName = (body.other_travel_name ?? body.other_travelName)?.trim()
    if (!otherEmail && travelName) {
      const { data: profile, error: profileErr } = await supa
        .from('profiles')
        .select('email')
        .ilike('travel_name', travelName)
        .limit(1)
        .maybeSingle()
      if (profileErr && isMissingTableOrColumn(profileErr)) {
        return reply.code(503).send({ error: 'Travel Chat requires database migration. Run: pnpm db:push' })
      }
      if (profileErr) throw profileErr
      otherEmail = profile?.email ?? null
    }
    if (!otherEmail) return reply.code(400).send({ error: 'other_user_required' })
    otherEmail = normalizeEmail(otherEmail)
    const myNorm = normalizeEmail(email)
    if (otherEmail === myNorm) return reply.code(400).send({ error: 'cannot_chat_self' })
    const [user_a_email, user_b_email] = myNorm < otherEmail ? [myNorm, otherEmail] : [otherEmail, myNorm]
    const { data: existing, error: findErr } = await supa
      .from('chat_conversations')
      .select('id, created_at')
      .eq('user_a_email', user_a_email)
      .eq('user_b_email', user_b_email)
      .maybeSingle()
    if (findErr && isMissingTableOrColumn(findErr)) {
      return reply.code(503).send({ error: 'Travel Chat requires database migration. Run: pnpm db:push' })
    }
    if (findErr) throw findErr
    if (existing) {
      return reply.code(201).send({ conversation_id: existing.id, created_at: existing.created_at, created: false })
    }
    const { data: inserted, error } = await supa
      .from('chat_conversations')
      .insert({ user_a_email, user_b_email })
      .select('id, created_at')
      .single()
    if (error) {
      if (isMissingTableOrColumn(error)) {
        return reply.code(503).send({ error: 'Travel Chat requires database migration. Run: pnpm db:push' })
      }
      throw error
    }
    return reply.code(201).send({ conversation_id: inserted.id, created_at: inserted.created_at, created: true })
  } catch (e: any) {
    if (e.statusCode) return reply.code(e.statusCode).send({ error: e.message })
    return reply.code(500).send({ error: e.message || 'db_error' })
  }
})

server.get('/v1/chat/conversations/:id/messages', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const id = (req.params as any).id
    const idOk = z.string().uuid().safeParse(id)
    if (!idOk.success) return reply.code(400).send({ error: 'invalid_conversation_id' })
    const { data: conv, error: convErr } = await supa
      .from('chat_conversations')
      .select('user_a_email, user_b_email')
      .eq('id', id)
      .single()
    if (convErr) {
      if (isMissingTableOrColumn(convErr)) return { messages: [] }
      if (String(convErr.message).includes('No rows') || String(convErr.message).includes('PGRST116')) {
        return reply.code(404).send({ error: 'not_found' })
      }
      throw convErr
    }
    if (!conv) return reply.code(404).send({ error: 'not_found' })
    const norm = normalizeEmail(email)
    const partOf = norm === normalizeEmail(conv.user_a_email) || norm === normalizeEmail(conv.user_b_email)
    if (!partOf) return reply.code(403).send({ error: 'forbidden' })
    const { data: messages, error } = await supa
      .from('chat_messages')
      .select('id, sender_email, body, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
    if (error) {
      if (isMissingTableOrColumn(error)) return { messages: [] }
      throw error
    }
    return { messages: messages ?? [] }
  } catch (e: any) {
    if (e.statusCode) return reply.code(e.statusCode).send({ error: e.message })
    if (isMissingTableOrColumn(e)) return { messages: [] }
    return reply.code(500).send({ error: e.message || 'db_error' })
  }
})

server.post('/v1/chat/conversations/:id/messages', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const id = (req.params as any).id
    const idOk = z.string().uuid().safeParse(id)
    if (!idOk.success) return reply.code(400).send({ error: 'invalid_conversation_id' })
    const body = validate(chatMessagesPostBodySchema as unknown as z.ZodType<string>, req.body, reply)
    if (body === null) return
    const messageBody = body
    const { data: conv, error: convErr } = await supa
      .from('chat_conversations')
      .select('user_a_email, user_b_email')
      .eq('id', id)
      .single()
    if (convErr) {
      if (isMissingTableOrColumn(convErr)) {
        return reply.code(503).send({ error: 'Travel Chat requires database migration. Run: pnpm db:push' })
      }
      if (String(convErr.message).includes('No rows') || String(convErr.message).includes('PGRST116')) {
        return reply.code(404).send({ error: 'not_found' })
      }
      throw convErr
    }
    if (!conv) return reply.code(404).send({ error: 'not_found' })
    const norm = normalizeEmail(email)
    const partOf = norm === normalizeEmail(conv.user_a_email) || norm === normalizeEmail(conv.user_b_email)
    if (!partOf) return reply.code(403).send({ error: 'forbidden' })
    const { data: inserted, error } = await supa
      .from('chat_messages')
      .insert({ conversation_id: id, sender_email: norm, body: messageBody })
      .select('id, sender_email, body, created_at')
      .single()
    if (error) {
      if (isMissingTableOrColumn(error)) {
        return reply.code(503).send({ error: 'Travel Chat requires database migration. Run: pnpm db:push' })
      }
      throw error
    }
    return reply.code(201).send(inserted)
  } catch (e: any) {
    if (e.statusCode) return reply.code(e.statusCode).send({ error: e.message })
    return reply.code(500).send({ error: e.message || 'db_error' })
  }
})

const port = Number(process.env.API_PORT || 4000)
server.listen({ port, host: '0.0.0.0' }).catch((err) => {
  server.log.error(err)
  process.exit(1)
})
