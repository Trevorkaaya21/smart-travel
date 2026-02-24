/**
 * Advanced Image Optimization Component
 * Uses Next.js Image for automatic optimization
 */

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type OptimizedImageProps = {
  src: string | null | undefined
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  fallback?: string
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
}

const DEFAULT_FALLBACK = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=900&q=80'

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  fallback = DEFAULT_FALLBACK,
  objectFit = 'cover',
}: OptimizedImageProps) {
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  const imageSrc = error || !src ? fallback : src

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {loading && (
        <div 
          className="absolute inset-0 animate-pulse bg-gradient-to-r from-[rgb(var(--surface-muted))] via-[rgb(var(--surface))] to-[rgb(var(--surface-muted))]"
          style={{ backgroundSize: '200% 100%' }}
        />
      )}
      
      <Image
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        className={cn(
          'transition-opacity duration-300',
          loading ? 'opacity-0' : 'opacity-100',
          className
        )}
        style={{ objectFit }}
        priority={priority}
        quality={85}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        onLoadingComplete={() => setLoading(false)}
        onError={() => {
          setError(true)
          setLoading(false)
        }}
        loading={priority ? undefined : 'lazy'}
        placeholder="blur"
        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzAwIiBoZWlnaHQ9IjQ3NSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2ZXJzaW9uPSIxLjEiLz4="
      />
    </div>
  )
}

/**
 * Optimized Place Card Image with lazy loading
 */
export function PlaceCardImage({
  src,
  name,
  priority = false,
}: {
  src: string | null | undefined
  name: string
  priority?: boolean
}) {
  return (
    <OptimizedImage
      src={src}
      alt={name}
      width={900}
      height={675}
      className="h-full w-full"
      objectFit="cover"
      priority={priority}
    />
  )
}

/**
 * Trip Card Image with optimized loading
 */
export function TripCardImage({
  src,
  name,
  priority = false,
}: {
  src: string | null | undefined
  name: string
  priority?: boolean
}) {
  return (
    <OptimizedImage
      src={src}
      alt={name}
      width={1200}
      height={800}
      className="h-full w-full"
      objectFit="cover"
      priority={priority}
    />
  )
}
