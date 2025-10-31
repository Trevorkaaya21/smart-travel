// services/api/src/server.ts
import './preload-env'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import compress from '@fastify/compress'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import { z } from 'zod'
import { supa } from './supabase'
import { customAlphabet } from 'nanoid'
import { randomUUID } from 'node:crypto'

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16)

const PRIMARY_GEMINI_MODEL = process.env.GOOGLE_AI_STUDIO_MODEL?.trim()
const DEFAULT_GEMINI_MODELS = [
  'models/gemini-2.5-flash',
  'models/gemini-2.5-flash-preview-05-20',
  'models/gemini-2.5-flash-lite',
  'models/gemini-2.5-pro',
  'models/gemini-2.5-pro-preview-05-06',
  'models/gemini-flash-latest',
  'models/gemini-pro-latest'
]
const GEMINI_MODEL_CANDIDATES = Array.from(
  new Set([PRIMARY_GEMINI_MODEL, ...DEFAULT_GEMINI_MODELS].filter(Boolean))
)
let cachedModelList: string[] | null = null
let cachedModelListFetchedAt = 0
const GA_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY || ''
const GOOGLE_PLACES_KEY =
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  ''
const DIARY_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'diary-photos'
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif'
}

function ensureEmail(h: Record<string, any> | undefined) {
  const email = (h?.['x-user-email'] as string | undefined)?.toLowerCase?.()
  if (!email) throw Object.assign(new Error('auth_required'), { statusCode: 401 })
  return email
}

async function aiRefine(q: string) {
  if (!GA_KEY) return q.trim()
  const prompt = `Rewrite this as a concise place search query (no extra words): ${q}`
  try {
    const { text } = await generateWithGemini(prompt)
    return text?.trim().length ? text.trim() : q.trim()
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

async function googlePlacesSearch(q: string, lat?: number, lng?: number, limit = 20, radius = 6000) {
  if (!GOOGLE_PLACES_KEY) return []
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
    url.searchParams.set('query', q)
    url.searchParams.set('key', GOOGLE_PLACES_KEY)
    if (typeof lat === 'number' && typeof lng === 'number') {
      url.searchParams.set('location', `${lat},${lng}`)
      url.searchParams.set('radius', String(Math.max(500, Math.min(radius, 50000))))
    }
    const r = await fetch(url.toString())
    if (!r.ok) return []
    const j = await r.json()
    const results = Array.isArray(j?.results) ? j.results.slice(0, limit) : []
    return results.map((res: any) => ({
      id: res?.place_id as string,
      name: res?.name as string,
      category: Array.isArray(res?.types) && res.types.length ? res.types[0] : 'poi',
      rating: typeof res?.rating === 'number' ? res.rating : null,
      lat: res?.geometry?.location?.lat ?? null,
      lng: res?.geometry?.location?.lng ?? null,
      address: res?.formatted_address ?? null,
      photoRef: res?.photos?.[0]?.photo_reference ?? null
    })).filter((res: any) => res.id && res.name)
  } catch (err) {
    console.warn('googlePlacesSearch failed', err)
    return []
  }
}

async function googleGeocodeOne(text: string) {
  if (!GOOGLE_PLACES_KEY) return null
  try {
    const u = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    u.searchParams.set('address', text)
    u.searchParams.set('key', GOOGLE_PLACES_KEY)
    const r = await fetch(u.toString())
    if (!r.ok) return null
    const j = await r.json()
    const loc = j?.results?.[0]?.geometry?.location
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      return { lat: loc.lat, lng: loc.lng }
    }
  } catch (err) {
    console.warn('googleGeocodeOne failed', err)
  }
  return null
}

function googlePlacePhotoUrl(ref: string, maxWidth = 900) {
  if (!GOOGLE_PLACES_KEY || !ref) return null
  const url = new URL('https://maps.googleapis.com/maps/api/place/photo')
  url.searchParams.set('maxwidth', String(maxWidth))
  url.searchParams.set('photo_reference', ref)
  url.searchParams.set('key', GOOGLE_PLACES_KEY)
  return url.toString()
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

function googleStaticMap(lat: number | null, lng: number | null, width = 640, height = 360) {
  if (!GOOGLE_PLACES_KEY || lat == null || lng == null) return null
  const url = new URL('https://maps.googleapis.com/maps/api/staticmap')
  url.searchParams.set('center', `${lat},${lng}`)
  url.searchParams.set('zoom', '14')
  url.searchParams.set('size', `${width}x${height}`)
  url.searchParams.set('maptype', 'roadmap')
  url.searchParams.set('markers', `color:red|${lat},${lng}`)
  url.searchParams.set('key', GOOGLE_PLACES_KEY)
  return url.toString()
}

async function openverseImage(query: string) {
  try {
    const u = new URL('https://api.openverse.engineering/v1/images/')
    u.searchParams.set('q', query)
    u.searchParams.set('page_size', '1')
    u.searchParams.set('license_type', 'commercial')
    const r = await fetch(u.toString())
    if (!r.ok) return null
    const j = await r.json()
    const img = j?.results?.[0]
    if (!img) return null
    const url = img.url || img.thumbnail
    const credit = `${img.creator || 'Unknown'} • ${(img.license || 'CC').toUpperCase()} via Openverse`
    return { url, credit }
  } catch {
    return null
  }
}

async function generateWithGemini(prompt: string) {
  if (!GA_KEY) throw new Error('GOOGLE_AI_STUDIO_API_KEY not configured')
  const modelsToTry = await resolveGeminiCandidates()
  let lastError: any = null
  for (const model of modelsToTry) {
    try {
      const result = await callGemini(model, prompt)
      return { ...result, model }
    } catch (err: any) {
      lastError = err
      if (!(err?.status === 404 || err?.status === 400)) break
      continue
    }
  }
  if (lastError && (lastError.status === 404 || lastError.status === 400)) {
    try {
      const available = await listGeminiModels()
      if (!available.length) {
        lastError.message = 'No accessible Gemini models for this API key. Enable Gemini models in Google AI Studio.'
      } else {
        lastError.message = `Gemini models not accessible. Available models: ${available.join(', ')}`
      }
    } catch {
      // ignore list failure, fall back to lastError
    }
  }
  throw lastError ?? new Error('Gemini generation failed')
}

async function callGemini(model: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${GA_KEY}`
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, topP: 0.95, topK: 40 }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    const error = new Error(parsed?.error?.message || rawText || `Gemini request failed (${res.status})`)
    ;(error as any).status = res.status
    ;(error as any).raw = rawText
    throw error
  }

  const candidates = Array.isArray(parsed?.candidates) ? parsed.candidates : []
  const text = candidates
    .flatMap((cand: any) => (cand?.content?.parts ?? []).map((part: any) => part?.text ?? '').filter(Boolean))
    .join('\n\n')
    .trim()

  return { text, raw: parsed }
}

async function resolveGeminiCandidates() {
  const baseCandidates = GEMINI_MODEL_CANDIDATES.length ? GEMINI_MODEL_CANDIDATES : DEFAULT_GEMINI_MODELS
  try {
    const available = await listGeminiModels()
    const matches = baseCandidates.filter((model) => available.includes(model))
    if (matches.length) return matches
    const firstFlash = available.find((name) => /gemini.*flash/i.test(name))
    if (firstFlash) return [firstFlash]
  } catch (err) {
    console.warn('Gemini model listing failed', err)
  }
  return baseCandidates
}

async function listGeminiModels() {
  if (!GA_KEY) throw new Error('GOOGLE_AI_STUDIO_API_KEY not configured')
  const now = Date.now()
  if (cachedModelList && now - cachedModelListFetchedAt < 5 * 60 * 1000) return cachedModelList
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GA_KEY}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`ListModels failed (${res.status})`)
  }
  const data = await res.json()
  const names = Array.isArray(data?.models)
    ? data.models.map((model: any) => model?.name).filter((name: any) => typeof name === 'string')
    : []
  cachedModelList = names
  cachedModelListFetchedAt = now
  return names
}

const server = Fastify({ logger: true })

await server.register(cors, {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
  allowedHeaders: ['Content-Type', 'x-user-email']
})

await server.register(helmet, { contentSecurityPolicy: false })
await server.register(compress, { global: true })

await server.register(rateLimit, { max: 100, timeWindow: '1 minute' })

await server.register(swagger, {
  openapi: { info: { title: 'Smart Travel API', version: '0.3.0' } }
})

server.get('/health', async () => ({ ok: true }))

server.get(
  '/v1/echo',
  { schema: { querystring: { type: 'object', properties: { q: { type: 'string' } } } } },
  async (req) => {
    const qs = z.object({ q: z.string().min(1) }).parse((req as any).query)
    return { echo: qs.q }
  }
)

server.get('/v1/ai/debug', async () => {
  let availableModels: string[] | null = null
  try {
    availableModels = await listGeminiModels()
  } catch (_err) {
    availableModels = null
  }

  const env = {
    GOOGLE_AI_STUDIO_API_KEY: !!GA_KEY,
    GOOGLE_AI_STUDIO_MODEL_PRIMARY: PRIMARY_GEMINI_MODEL ?? null,
    GOOGLE_AI_STUDIO_MODEL_CANDIDATES: GEMINI_MODEL_CANDIDATES,
    GOOGLE_AI_STUDIO_MODELS_AVAILABLE: availableModels,
    GOOGLE_PLACES_API_KEY: !!GOOGLE_PLACES_KEY
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
  async (req) => {
    const { q, lat, lng, limit = 20, radius = 6000 } = (req.body as any)
    const refined = await aiRefine(q)

    let _lat = typeof lat === 'number' ? lat : undefined
    let _lng = typeof lng === 'number' ? lng : undefined

    if ((_lat == null || _lng == null) && GOOGLE_PLACES_KEY) {
      const ge = await googleGeocodeOne(refined)
      if (ge) {
        _lat = ge.lat
        _lng = ge.lng
      }
    }

    const places = await googlePlacesSearch(refined, _lat, _lng, limit, radius)

    const normalized: any[] = []
    for (const p of places) {
      const base: any = {
        id: p.id,
        name: p.name,
        category: p.category || 'poi',
        rating: p.rating ?? null,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        because: p.address ? `${p.address} • Google Places` : `Google Places match for “${refined}”`,
        photo: p.photoRef ? googlePlacePhotoUrl(p.photoRef) : null,
        photo_credit: p.photoRef ? 'Google Places' : null
      }

      if (!base.photo && base.name) {
        const img = await openverseImage(base.name)
        if (img) { base.photo = img.url; base.photo_credit = img.credit }
      }

      if (!base.photo) {
        const staticMap = googleStaticMap(base.lat, base.lng)
        if (staticMap) {
          base.photo = staticMap
          base.photo_credit = 'Google Maps static'
        }
      }

      normalized.push(base)
    }

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
    const prompt = String((req.body as any)?.prompt ?? '').trim()
    if (!prompt) return reply.code(400).send({ error: 'prompt_required' })
    if (!GA_KEY) {
      return reply.code(501).send({ error: 'ai_disabled', message: 'Google AI Studio key not configured' })
    }

    try {
      const { text, model, raw } = await generateWithGemini(prompt)
      return { model, text, raw }
    } catch (err: any) {
      req.log.error({ err }, 'ai_suggest_failed')
      const status = err?.status && Number.isInteger(err.status) ? err.status : 500
      return reply.code(status).send({
        error: 'ai_exception',
        message: err?.message || 'Unable to generate itinerary',
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
  const owner_email = ((req.query as any)?.owner_email as string | undefined)?.toLowerCase?.()
  if (!owner_email) return reply.code(400).send({ error: 'owner_email_required' })

  const { data: trips, error } = await supa
    .from('trips')
    .select('id, name, owner_email, is_public, share_id, created_at')
    .eq('owner_email', owner_email)
    .order('created_at', { ascending: false })
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
    const name = ((req.body as any)?.name as string | undefined) ?? 'New Trip'
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
    const { place_id, day = 1, note = '', place } = (req.body as any) ?? {}
    if (!place_id) return reply.code(400).send({ error: 'place_id_required' })

    const { data: trip, error: tErr } = await supa.from('trips').select('owner_email').eq('id', id).single()
    if (tErr || !trip) return reply.code(404).send({ error: 'not_found' })
    if (trip.owner_email?.toLowerCase() !== email) return reply.code(403).send({ error: 'forbidden' })

    if (place) await upsertPlaceFromPayload(place)

    const { error } = await supa.from('trip_items').insert({ trip_id: id, place_id, day: Number(day), note })
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
    const { place_id, place } = (req.body as any) ?? {}
    if (!place_id) return reply.code(400).send({ error: 'place_id_required' })
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
    const photoCaption = typeof body?.photo_caption === 'string' ? body.photo_caption : null
    const text = textRaw?.trim() ?? ''
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
  const email = ((req.query as any).email as string | undefined)?.toLowerCase()
  if (!email) return reply.code(400).send({ error: 'email_required' })
  const { data, error } = await supa.from('profiles').select('*').eq('email', email).single()
  if (error && String(error.message).includes('No rows')) return { profile: null }
  if (error) return reply.code(500).send({ error: 'db_error' })
  return { profile: data }
})

server.put('/v1/profile', {}, async (req, reply) => {
  try {
    const email = ensureEmail(req.headers)
    const { display_name, home_base, bio } = (req.body as any) ?? {}
    const { error } = await supa.from('profiles').upsert({ email, display_name, home_base, bio }, { onConflict: 'email' })
    if (error) throw error
    return { ok: true }
  } catch (e: any) {
    return reply.code(e.statusCode || 500).send({ error: e.message || 'db_error' })
  }
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

const port = Number(process.env.API_PORT || 4000)
server.listen({ port, host: '0.0.0.0' }).catch((err) => {
  server.log.error(err)
  process.exit(1)
})
