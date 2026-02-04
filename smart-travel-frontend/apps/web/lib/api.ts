/**
 * Smart Travel API client.
 *
 * - API_BASE: backend root URL (set NEXT_PUBLIC_API_URL or NEXT_PUBLIC_API_BASE_URL).
 * - api(path): returns full URL for a path.
 * - getJSON / postJSON: typed fetch helpers with error handling.
 * - ApiError, extractErrorMessage: for consistent error handling.
 *
 * @see docs/SCALABILITY.md for scale and performance notes.
 */

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://127.0.0.1:4000'
).replace(/\/+$/, '')

/** Returns full API URL for path (e.g. api('/v1/trips') => 'http://.../v1/trips'). */
export function api(path: string): string {
  if (!path) throw new Error('api() requires a path')
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Merges x-user-email into headers when available (from arg or localStorage). */
export function withEmail(headers: HeadersInit = {}, email?: string | null): HeadersInit {
  const e = email ?? (typeof window !== 'undefined' ? window.localStorage.getItem('st_email') : null)
  return { ...headers, ...(e ? { 'x-user-email': e } : {}) }
}

/** Thrown when an API request fails. status, statusText, body are set from the response. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: string,
    message?: string
  ) {
    super(message || `API Error: ${status} ${statusText}`)
    this.name = 'ApiError'
  }

  static async fromResponse(res: Response): Promise<ApiError> {
    let body: string | undefined
    try {
      body = await res.text()
    } catch {
      // Ignore if we can't read the body
    }
    return new ApiError(res.status, res.statusText, body)
  }
}

/** Parses API error body (JSON or text) into a user-facing message. */
export function extractErrorMessage(raw: string, status: number): string {
  if (!raw) {
    if (status === 401) return 'Please sign in to continue'
    if (status === 403) return 'You don\'t have permission to perform this action'
    if (status === 404) return 'Resource not found'
    if (status === 429) return 'Too many requests. Please try again later'
    if (status >= 500) return 'Server error. Please try again later'
    return 'An error occurred'
  }

  try {
    const parsed = JSON.parse(raw)
    return parsed.message || parsed.error || raw
  } catch {
    // If not JSON, try to extract meaningful text
    if (raw.length < 200) return raw
    return 'An error occurred'
  }
}

/** User-friendly message when backend is unreachable (API not running or CORS). */
export const BACKEND_UNREACHABLE_MESSAGE =
  'Backend unavailable. Start the API with: pnpm --filter @smart-travel/api dev'

function isNetworkOrCorsError(err: unknown): boolean {
  if (err instanceof TypeError) {
    const msg = (err as Error).message?.toLowerCase() ?? ''
    return msg.includes('fetch') || msg.includes('load failed') || msg.includes('failed to fetch')
  }
  return false
}

/** GET JSON from path. Uses extractErrorMessage for non-2xx. */
export async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(api(path), {
      ...init,
      method: 'GET',
      headers: { ...init?.headers },
    })
    if (!res.ok) {
      const error = await ApiError.fromResponse(res)
      error.message = extractErrorMessage(error.body || '', res.status)
      throw error
    }
    return res.json() as Promise<T>
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (isNetworkOrCorsError(err)) {
      throw new Error(BACKEND_UNREACHABLE_MESSAGE)
    }
    throw err
  }
}

/** POST JSON to path. Uses extractErrorMessage for non-2xx. */
export async function postJSON<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(api(path), {
      ...init,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      body: body != null ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const error = await ApiError.fromResponse(res)
      error.message = extractErrorMessage(error.body || '', res.status)
      throw error
    }
    return res.json() as Promise<T>
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (isNetworkOrCorsError(err)) {
      throw new Error(BACKEND_UNREACHABLE_MESSAGE)
    }
    throw err
  }
}