'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ConfettiProps {
  trigger: boolean
  duration?: number
  className?: string
}

export function Confetti({ trigger, duration = 3000, className }: ConfettiProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (trigger) {
      setShow(true)
      const timer = setTimeout(() => setShow(false), duration)
      return () => clearTimeout(timer)
    }
  }, [trigger, duration])

  if (!show) return null

  return (
    <div className={cn("fixed inset-0 pointer-events-none z-50", className)}>
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-10px',
            backgroundColor: [
              'rgb(var(--accent))',
              'rgb(var(--accent-secondary))',
              'rgb(var(--accent-tertiary))',
              'rgb(var(--success))',
            ][Math.floor(Math.random() * 4)],
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        />
      ))}
    </div>
  )
}
