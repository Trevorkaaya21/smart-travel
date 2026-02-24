
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'
import { Compass, Wand2, MapPinned, Heart, NotebookPen, UserRound, LogOut, LogIn, Sun, Moon, MessageCircle } from 'lucide-react'
import { useGuest } from '@/lib/useGuest'
import { cn, stringImageUrl } from '@/lib/utils'
import { API_BASE } from '@/lib/api'
import { emailToUsername, getInitialsFromEmail } from '@/lib/trip-utils'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  requiresAuth?: boolean
}

const nav: NavItem[] = [
  { href: '/dashboard', label: 'Discover', icon: Compass },
  { href: '/dashboard/chat', label: 'Travel Chat', icon: MessageCircle, requiresAuth: true },
  { href: '/dashboard/create', label: 'Create with AI', icon: Wand2, requiresAuth: true },
  { href: '/dashboard/trips', label: 'My Trips', icon: MapPinned, requiresAuth: true },
  { href: '/dashboard/favorites', label: 'My Favorites', icon: Heart, requiresAuth: true },
  { href: '/dashboard/diary', label: 'My Travel Diary', icon: NotebookPen, requiresAuth: true },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound, requiresAuth: true },
]

export default function SidebarNav() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { isGuest } = useGuest()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [avatarError, setAvatarError] = useState(false)

  const guestMode = isGuest || status !== 'authenticated'
  const user = session?.user as any | undefined
  const email = user?.email as string | undefined
  const { data: profile } = useQuery({
    queryKey: ['profile', email],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/profile?email=${encodeURIComponent(email!)}`, { cache: 'no-store' })
      if (!res.ok) return null
      const d = await res.json()
      return d?.profile ?? null
    },
    enabled: !!email && !guestMode,
  })
  const rawAvatar = profile?.avatar_url ?? user?.image ?? null
  const avatarUrl = stringImageUrl(rawAvatar) ?? null
  const displayName = (profile?.display_name as string | undefined) || emailToUsername(email) || 'Guest Explorer'
  const initials = getInitialsFromEmail(email)

  useEffect(() => setMounted(true), [])
  useEffect(() => setAvatarError(false), [avatarUrl])

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) {
    if (!item.requiresAuth) return
    if (!guestMode) return
    e.preventDefault()
    toast('Sign in to unlock this workspace.', { description: 'Guests can explore Discover, but need Google sign-in for trips, favorites, AI creation, and profiles.' })
    signIn('google')
  }

  return (
    <aside className="sidebar flex h-full flex-col gap-5" aria-label="App sidebar">
      <div className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5 backdrop-blur-sm" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-[rgb(var(--accent))]" style={{ background: 'rgba(var(--accent) / 0.15)' }}>
          ST
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[rgb(var(--text))]">Smart Travel</div>
          <div className="truncate text-xs text-[rgb(var(--muted))]">Your travel buddy</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1" aria-label="Main">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => handleNavClick(e, item)}
              className={cn(
                'nav-item flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium',
                active && 'nav-item-active',
                item.requiresAuth && guestMode && 'opacity-80'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span className="ui-liquid-icon flex h-9 w-9 shrink-0 items-center justify-center">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.requiresAuth && guestMode && <span className="badge-pro shrink-0">Pro</span>}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5 backdrop-blur-sm" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-semibold text-[rgb(var(--accent))]" style={{ background: 'rgba(var(--accent) / 0.12)' }}>
            {avatarUrl && !avatarError ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[rgb(var(--text))]">{displayName}</div>
            <div className="truncate text-xs text-[rgb(var(--muted))]">{email ?? 'Guest access'}</div>
          </div>
          {!guestMode && (
            <button
              type="button"
              onClick={() => signOut()}
              className="btn btn-ghost shrink-0 px-3 py-2 text-xs font-semibold"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 backdrop-blur-sm" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
          <div className="flex items-center gap-2.5 text-sm font-medium text-[rgb(var(--text))]">
            <div className="relative h-5 w-5 shrink-0 text-[rgb(var(--accent))]" aria-hidden>
              {mounted ? (
                <>
                  <Sun className={cn('absolute inset-0 h-5 w-5 transition-all duration-300', resolvedTheme === 'dark' && 'scale-0 opacity-0')} />
                  <Moon className={cn('absolute inset-0 h-5 w-5 transition-all duration-300', resolvedTheme !== 'dark' && 'scale-0 opacity-0')} />
                </>
              ) : (
                <span className="block h-5 w-5" />
              )}
            </div>
            <span>{mounted ? (resolvedTheme === 'dark' ? 'Dark' : 'Light') : 'Theme'}</span>
          </div>
          <button
            type="button"
            onClick={() => mounted && setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="btn btn-ghost rounded-lg px-3 py-1.5 text-xs font-semibold"
            aria-label={mounted ? `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
          >
            Switch
          </button>
        </div>

        {guestMode && (
          <button
            type="button"
            onClick={() => signIn('google')}
            className="btn btn-primary w-full justify-center gap-2"
            aria-label="Sign in with Google"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            Sign in with Google
          </button>
        )}
      </div>
    </aside>
  )
}
