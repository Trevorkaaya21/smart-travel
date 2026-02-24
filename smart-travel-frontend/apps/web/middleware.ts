/**
 * Enhanced Security Middleware
 * Production-grade security headers and protections
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Security headers configuration
const securityHeaders = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable XSS protection
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
  
  // Strict Transport Security (HTTPS only) - Only in production
  // Disabled in development to prevent HTTPS redirect issues
  // 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Content Security Policy (relaxed for development)
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: http: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://accounts.google.com https://*.googleapis.com https://*.onrender.com http://localhost:4000 http://127.0.0.1:4000 http://localhost:3001 http://127.0.0.1:3001 ws://localhost:3001 ws://127.0.0.1:3001",
    "frame-src 'self' https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Remove upgrade-insecure-requests in development to prevent HTTPS issues
    // "upgrade-insecure-requests",
  ].join('; '),
}

// Rate limiting store (in-memory for simplicity, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limit configuration
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
}

function getRateLimitKey(request: NextRequest): string {
  // Use IP address or user identifier
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? 'unknown'
  const userId = request.cookies.get('user-id')?.value
  return userId ? `user:${userId}` : `ip:${ip}`
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    // New window or expired
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    })
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 }
  }

  if (record.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  record.count++
  return { allowed: true, remaining: RATE_LIMIT.maxRequests - record.count }
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Check if we're in development
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Apply security headers (skip some in development)
  Object.entries(securityHeaders).forEach(([key, value]) => {
    // Skip HSTS in development to prevent HTTPS issues
    if (key === 'Strict-Transport-Security' && isDevelopment) {
      return
    }
    response.headers.set(key, value)
  })

  // Rate limiting
  const rateLimitKey = getRateLimitKey(request)
  const { allowed, remaining } = checkRateLimit(rateLimitKey)

  response.headers.set('X-RateLimit-Limit', RATE_LIMIT.maxRequests.toString())
  response.headers.set('X-RateLimit-Remaining', remaining.toString())

  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': '60',
        ...Object.fromEntries(response.headers.entries()),
      },
    })
  }

  // Clean up old rate limit entries periodically
  if (Math.random() < 0.01) {
    // 1% chance to clean up
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime + RATE_LIMIT.windowMs) {
        rateLimitStore.delete(key)
      }
    }
  }

  return response
}

// Apply middleware to all routes except static files
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
