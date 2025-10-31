'use client'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="card"
      aria-label="Toggle theme"
      title="Toggle dark / light"
    >
      {mounted ? (isDark ? <Sun size={16} /> : <Moon size={16} />) : <span className="inline-block w-4" />}
      {mounted ? (isDark ? 'Light' : 'Dark') : 'Theme'}
    </button>
  )
}