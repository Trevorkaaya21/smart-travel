'use client'

import { Crown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PremiumBadgeProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

export function PremiumBadge({ className, size = 'md', showIcon = true }: PremiumBadgeProps) {
  const sizeClasses = {
    sm: 'text-[9px] px-2 py-0.5',
    md: 'text-[10px] px-3 py-1',
    lg: 'text-xs px-4 py-1.5',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-[0.2em] transition-all duration-200',
        sizeClasses[size],
        className
      )}
      style={{
        borderColor: 'rgba(var(--accent) / .5)',
        background: 'linear-gradient(135deg, rgba(var(--accent) / .25), rgba(var(--accent-secondary) / .15))',
        color: 'rgb(var(--accent))',
        boxShadow: '0 2px 12px rgba(var(--accent) / .25), 0 0 20px rgba(var(--accent) / .1)',
      }}
    >
      {showIcon && <Crown className="h-3 w-3" />}
      <span>Premium</span>
    </span>
  )
}
