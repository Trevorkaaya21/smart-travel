'use client'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export default function Header() {
  return (
    <header className="sticky top-4 z-40 mb-8">
      <nav className="flex items-center justify-between rounded-3xl border px-4 py-3 backdrop-blur-2xl transition-all duration-300"
        style={{
          background: 'linear-gradient(165deg, rgba(var(--surface) / .95), rgba(var(--surface-muted) / .85))',
          borderColor: 'rgb(var(--border) / .5)',
          boxShadow: '0 8px 32px rgba(var(--shadow-color) / .08), inset 0 1px 0 rgba(255, 255, 255, .1)'
        }}>
        <Link 
          href="/dashboard" 
          className="text-lg font-bold bg-gradient-to-r from-[rgb(var(--accent))] to-[rgb(var(--accent))] bg-clip-text text-transparent transition-all duration-300 hover:scale-105"
        >
          Smart Travel
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  )
}