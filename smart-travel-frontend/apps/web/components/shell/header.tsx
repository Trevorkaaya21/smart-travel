'use client'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export default function Header() {
  return (
    <header className="sticky top-4 z-40 mb-8">
      <nav className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <Link href="/dashboard" className="text-base font-semibold">
          Smart Travel
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  )
}