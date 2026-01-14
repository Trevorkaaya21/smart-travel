'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingOverlayProps {
  message?: string
  className?: string
}

export function LoadingOverlay({ message = 'Loading...', className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm",
        className
      )}
      style={{
        background: 'rgba(var(--bg) / .8)'
      }}
    >
      <div className="content-card flex flex-col items-center gap-4 p-8 animate-scale-in">
        <div className="relative">
          <Loader2 className="h-8 w-8 animate-spin text-[rgb(var(--accent))]" />
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{
              background: 'radial-gradient(circle, rgba(var(--accent) / .3), transparent)',
            }}
          />
        </div>
        <p className="text-sm font-medium text-[color-mix(in_oklab,rgb(var(--text))_75%,rgb(var(--muted))_25%)]">
          {message}
        </p>
      </div>
    </div>
  )
}

export function LoadingSpinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <Loader2
        className="animate-spin text-[rgb(var(--accent))]"
        style={{
          width: size,
          height: size,
        }}
      />
    </div>
  )
}
