export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://127.0.0.1:4000'
).replace(/\/+$/, '')

export function api(path: string) {
  if (!path) throw new Error('api() requires a path')
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

export function withEmail(headers: HeadersInit = {}, email?: string | null): HeadersInit {
  const e = email ?? (typeof window !== 'undefined'
    ? window.localStorage.getItem('st_email')
    : null)

  return {
    ...headers,
    ...(e ? { 'x-user-email': e } : {}),
  }
}

export async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(api(path), { ...init, method: 'GET' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export async function postJSON<T>(path: string, body?: any, init?: RequestInit): Promise<T> {
  const res = await fetch(api(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: body != null ? JSON.stringify(body) : undefined,
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}