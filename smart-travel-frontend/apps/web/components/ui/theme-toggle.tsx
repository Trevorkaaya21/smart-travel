'use client'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        "group relative inline-flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-300",
        "bg-gradient-to-br from-[rgb(var(--surface))] to-[rgb(var(--surface-muted))]",
        "border-[rgb(var(--border))]/60",
        "shadow-lg shadow-[rgb(var(--shadow-color))]/5",
        "hover:shadow-xl hover:shadow-[rgb(var(--accent))]/10 hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]/40"
      )}
      aria-label="Toggle theme"
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <div className="relative h-5 w-5">
        {mounted ? (
          <>
            <Sun 
              size={18} 
              className={cn(
                "absolute inset-0 transition-all duration-500",
                isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
              )}
            />
            <Moon 
              size={18} 
              className={cn(
                "absolute inset-0 transition-all duration-500",
                isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
              )}
            />
          </>
        ) : (
          <span className="inline-block h-5 w-5" />
        )}
      </div>
      <span className="transition-colors duration-300">
        {mounted ? (isDark ? 'Light Mode' : 'Dark Mode') : 'Theme'}
      </span>
      <div className={cn(
        "absolute inset-0 rounded-2xl bg-gradient-to-br from-[rgb(var(--accent))]/10 to-transparent opacity-0 transition-opacity duration-300",
        "group-hover:opacity-100"
      )} />
    </button>
  )
}