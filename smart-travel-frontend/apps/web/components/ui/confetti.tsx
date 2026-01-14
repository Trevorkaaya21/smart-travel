'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ConfettiProps {
  trigger: boolean
  duration?: number
  className?: string
}

interface ConfettiPiece {
  id: number
  left: string
  color: string
  delay: string
  duration: string
}

export function Confetti({ trigger, duration = 3000, className }: ConfettiProps) {
  const [show, setShow] = useState(false)
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  useEffect(() => {
    if (trigger) {
      const colors = [
        'rgb(var(--accent))',
        'rgb(var(--accent-secondary))',
        'rgb(var(--accent-tertiary))',
        'rgb(var(--success))',
      ]
      const nextPieces = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: `${Math.random() * 2}s`,
        duration: `${2 + Math.random() * 2}s`,
      }))
      setPieces(nextPieces)
      setShow(true)
      const timer = setTimeout(() => setShow(false), duration)
      return () => clearTimeout(timer)
    }
  }, [trigger, duration])

  if (!show) return null

  return (
    <div className={cn('fixed inset-0 pointer-events-none z-50', className)}>
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute w-2 h-2 rounded-full animate-confetti"
          style={{
            left: piece.left,
            top: '-10px',
            backgroundColor: piece.color,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
          }}
        />
      ))}
    </div>
  )
}
