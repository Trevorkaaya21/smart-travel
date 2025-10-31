
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'
import { Compass, Sparkles, MapPinned, Heart, NotebookPen, UserRound, LogOut, LogIn, Sun, Moon } from 'lucide-react'
import { useGuest } from '@/lib/useGuest'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  requiresAuth?: boolean
}

const nav: NavItem[] = [
  { href: '/dashboard', label: 'Discover', icon: Compass },
  { href: '/dashboard/create', label: 'Create with AI', icon: Sparkles, requiresAuth: true },
  { href: '/dashboard/trips', label: 'My Trips', icon: MapPinned, requiresAuth: true },
  { href: '/dashboard/favorites', label: 'My Favorites', icon: Heart, requiresAuth: true },
  { href: '/dashboard/diary', label: 'My Travel Diary', icon: NotebookPen, requiresAuth: true },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound, requiresAuth: true },
]

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || '?').trim()
  const parts = src.split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || 'ST'
}

export default function SidebarNav() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { isGuest } = useGuest()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const guestMode = isGuest || status !== 'authenticated'
  const user = session?.user as any | undefined
  const email = user?.email as string | undefined
  const name = (user?.name as string | undefined) || email || (guestMode ? 'Guest Explorer' : 'Smart Traveler')

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) {
    if (!item.requiresAuth) return
    if (!guestMode) return
    e.preventDefault()
    toast('Sign in to unlock this workspace.', { description: 'Guests can explore Discover, but need Google sign-in for trips, favorites, AI creation, and profiles.' })
    signIn('google')
  }

  return (
    <aside className="sidebar flex h-full flex-col gap-6">
      <div className="card flex items-center gap-3 px-4 py-3 text-[rgb(var(--text))]">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-lg font-semibold">
          ST
        </div>
        <div>
          <div className="text-sm font-semibold tracking-wide">The Smart Travel App</div>
          <div className="text-xs lowercase tracking-[0.35em] text-[rgb(var(--muted))]">Your travel buddy</div>
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        {nav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => handleNavClick(e, item)}
              className={[
                'nav-item group flex items-center gap-3 px-4 py-3 text-sm font-medium transition',
                active ? 'nav-item-active shadow-lg' : '',
                item.requiresAuth && guestMode ? 'opacity-75' : '',
              ].join(' ')}
            >
              <span className="ui-liquid-icon h-10 w-10">
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1">{item.label}</span>
              {item.requiresAuth && guestMode && (
                <span className="badge-pro">Pro</span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto space-y-4">
      <div className="card flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/10 text-base font-semibold text-[rgb(var(--text))]">
          {initials(user?.name, email ?? null)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[rgb(var(--text))]">{name}</div>
          <div className="truncate text-xs uppercase tracking-[0.28em] text-[rgb(var(--muted))]">{email ?? 'Guest access'}</div>
        </div>
        {!guestMode && (
          <button
            onClick={() => signOut()}
            className="btn btn-ghost whitespace-nowrap px-3 py-2 text-xs font-semibold"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        )}
      </div>

      <div className="card flex items-center justify-between gap-2 px-3 py-2 text-xs text-[rgb(var(--muted))]">
        <div className="flex items-center gap-2">
          {mounted && resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span>{mounted ? (resolvedTheme === 'dark' ? 'Dark mode' : 'Light mode') : 'Theme'}</span>
          </div>
          <button
            onClick={() => mounted && setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="btn btn-ghost text-[11px] uppercase tracking-[0.25em] px-3 py-1"
          >
            Switch
          </button>
        </div>

      {guestMode ? (
        <button
          onClick={() => signIn('google')}
          className="btn btn-primary w-full justify-center"
        >
          <LogIn className="h-4 w-4" />
          Sign in with Google
        </button>
      ) : null}
    </div>
  </aside>
)
}
