
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'
import {
  Compass, Wand2, MapPinned, Heart, NotebookPen, UserRound,
  LogOut, LogIn, Sun, Moon, MessageCircle, ChevronsRight,
} from 'lucide-react'
import { useGuest } from '@/lib/useGuest'
import { cn, stringImageUrl } from '@/lib/utils'
import { API_BASE } from '@/lib/api'
import { emailToUsername, getInitialsFromEmail } from '@/lib/trip-utils'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  requiresAuth?: boolean
  notifs?: number
}

const mainNav: NavItem[] = [
  { href: '/dashboard', label: 'Discover', icon: Compass },
  { href: '/dashboard/trips', label: 'My Trips', icon: MapPinned, requiresAuth: true },
  { href: '/dashboard/create', label: 'AI Planner', icon: Wand2, requiresAuth: true },
  { href: '/dashboard/favorites', label: 'Favorites', icon: Heart, requiresAuth: true },
  { href: '/dashboard/diary', label: 'Diary', icon: NotebookPen, requiresAuth: true },
  { href: '/dashboard/chat', label: 'Messages', icon: MessageCircle, requiresAuth: true },
]

const accountNav: NavItem[] = [
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound, requiresAuth: true },
]

type Conversation = {
  id: string
  other_email: string
  last_message_at?: string | null
  last_message_sender?: string | null
}

function getLastChatVisit(): string {
  if (typeof window === 'undefined') return new Date(0).toISOString()
  return localStorage.getItem('st_last_chat_visit') ?? new Date(0).toISOString()
}

function markChatVisited() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('st_last_chat_visit', new Date().toISOString())
  }
}

export default function SidebarNav() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { isGuest } = useGuest()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const [open, setOpen] = useState(true)

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

  const { data: conversations } = useQuery({
    queryKey: ['chat', 'conversations', email],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/chat/conversations`, {
        headers: { 'x-user-email': email! },
      })
      if (!res.ok) return []
      const d = await res.json()
      return (d?.conversations ?? []) as Conversation[]
    },
    enabled: !!email && !guestMode,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  type SidebarTrip = { id: string; start_date?: string | null; end_date?: string | null }

  const { data: tripsData } = useQuery({
    queryKey: ['sidebar-trips', email],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/v1/trips?owner_email=${encodeURIComponent(email!)}`,
        { cache: 'no-store' }
      )
      if (!res.ok) return []
      const d = await res.json()
      return (d?.trips ?? []) as SidebarTrip[]
    },
    enabled: !!email && !guestMode,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  })

  const upcomingTripsCount = (() => {
    if (!tripsData?.length) return 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return tripsData.filter((t) => {
      if (!t.start_date) return false
      const start = new Date(t.start_date + 'T00:00:00')
      return start >= today
    }).length
  })()

  const unreadCount = (() => {
    if (!conversations?.length || !email) return 0
    const lastVisit = getLastChatVisit()
    const norm = email.trim().toLowerCase()
    return conversations.filter((c) => {
      if (!c.last_message_at) return false
      if (c.last_message_sender?.trim().toLowerCase() === norm) return false
      return new Date(c.last_message_at).getTime() > new Date(lastVisit).getTime()
    }).length
  })()

  const isOnChat = pathname === '/dashboard/chat' || pathname.startsWith('/dashboard/chat/')
  useEffect(() => {
    if (isOnChat && email) markChatVisited()
  }, [isOnChat, email])
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
    <aside
      className={cn(
        'sidebar relative flex h-full flex-col transition-all duration-300 ease-in-out',
        open ? 'w-full' : 'w-[68px] p-2 md:p-3',
      )}
      aria-label="App sidebar"
    >
      {/* ── Brand ─────────────────────────────────── */}
      <div
        className="mb-4 flex items-center gap-3 rounded-xl border px-3 py-2.5 backdrop-blur-sm"
        style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-[rgb(var(--accent))]"
          style={{ background: 'rgba(var(--accent) / 0.15)' }}
        >
          ST
        </div>
        {open && (
          <div className="min-w-0 transition-opacity duration-200">
            <div className="truncate text-sm font-semibold text-[rgb(var(--text))]">Smart Travel</div>
            <div className="truncate text-xs text-[rgb(var(--muted))]">Your travel buddy</div>
          </div>
        )}
      </div>

      {/* ── Main Nav ──────────────────────────────── */}
      <nav className="flex flex-col gap-1" aria-label="Main">
        {mainNav.map((item) => {
          let active = pathname === item.href || pathname.startsWith(item.href + '/')
          if (item.href === '/dashboard/trips' && pathname.startsWith('/trip/')) active = true

          let navItem = item
          if (item.href === '/dashboard/chat' && unreadCount > 0) {
            navItem = { ...item, notifs: unreadCount }
          } else if (item.href === '/dashboard/trips' && upcomingTripsCount > 0) {
            navItem = { ...item, notifs: upcomingTripsCount }
          }

          return (
            <NavLink
              key={navItem.href}
              item={navItem}
              active={active}
              open={open}
              guestMode={guestMode}
              onClick={(e) => handleNavClick(e, navItem)}
            />
          )
        })}
      </nav>

      {/* ── Account Section ───────────────────────── */}
      <div className={cn('mt-4 border-t pt-3', !open && 'mt-2 pt-2')} style={{ borderColor: 'var(--glass-border)' }}>
        {open && (
          <div className="mb-1 px-3.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Account
          </div>
        )}
        <nav className="flex flex-col gap-1">
          {accountNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <NavLink
                key={item.href}
                item={item}
                active={active}
                open={open}
                guestMode={guestMode}
                onClick={(e) => handleNavClick(e, item)}
              />
            )
          })}
        </nav>
      </div>

      {/* ── Bottom section ────────────────────────── */}
      <div className={cn('mt-auto pt-4', open ? 'space-y-3' : 'space-y-2 pt-2')}>
        {/* User card */}
        <div
          className={cn(
            'flex items-center rounded-xl border backdrop-blur-sm',
            open ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5'
          )}
          style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-semibold text-[rgb(var(--accent))]"
            style={{ background: 'rgba(var(--accent) / 0.12)' }}
          >
            {avatarUrl && !avatarError ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setAvatarError(true)} />
            ) : (
              initials
            )}
          </div>
          {open && (
            <div className="min-w-0 flex-1 transition-opacity duration-200">
              <div className="truncate text-sm font-semibold text-[rgb(var(--text))]">{displayName}</div>
              <div className="truncate text-xs text-[rgb(var(--muted))]">{email ?? 'Guest access'}</div>
            </div>
          )}
          {open && !guestMode && (
            <button
              type="button"
              onClick={() => signOut()}
              className="btn btn-ghost shrink-0 px-2.5 py-2 text-xs font-semibold"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        {/* Theme toggle */}
        <div
          className={cn(
            'flex items-center rounded-xl border backdrop-blur-sm',
            open ? 'justify-between px-3 py-2.5' : 'justify-center px-0 py-2.5'
          )}
          style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}
        >
          <button
            type="button"
            onClick={() => mounted && setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className={cn('flex items-center text-[rgb(var(--accent))]', !open && 'justify-center w-full')}
            aria-label={mounted ? `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
            title={!open ? (mounted ? (resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode') : 'Theme') : undefined}
          >
            <div className="relative h-5 w-5 shrink-0" aria-hidden>
              {mounted ? (
                <>
                  <Sun className={cn('absolute inset-0 h-5 w-5 transition-all duration-300', resolvedTheme === 'dark' && 'scale-0 opacity-0')} />
                  <Moon className={cn('absolute inset-0 h-5 w-5 transition-all duration-300', resolvedTheme !== 'dark' && 'scale-0 opacity-0')} />
                </>
              ) : (
                <span className="block h-5 w-5" />
              )}
            </div>
          </button>
          {open && (
            <button
              type="button"
              onClick={() => mounted && setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="btn btn-ghost rounded-lg px-3 py-1.5 text-xs font-semibold"
              aria-label={mounted ? `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
            >
              {mounted ? (resolvedTheme === 'dark' ? 'Light' : 'Dark') : 'Theme'}
            </button>
          )}
        </div>

        {/* Guest sign-in */}
        {guestMode && (
          open ? (
            <button
              type="button"
              onClick={() => signIn('google')}
              className="btn btn-primary w-full justify-center gap-2"
              aria-label="Sign in with Google"
            >
              <LogIn className="h-4 w-4" aria-hidden />
              Sign in with Google
            </button>
          ) : (
            <button
              type="button"
              onClick={() => signIn('google')}
              className="flex w-full items-center justify-center rounded-xl border px-0 py-2.5 backdrop-blur-sm text-[rgb(var(--accent))]"
              style={{ borderColor: 'var(--glass-border)', background: 'rgba(var(--accent) / 0.12)' }}
              aria-label="Sign in with Google"
              title="Sign in"
            >
              <LogIn className="h-4 w-4" aria-hidden />
            </button>
          )
        )}
      </div>

      {/* ── Collapse Toggle ───────────────────────── */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'mt-3 flex w-full items-center rounded-xl border transition-colors backdrop-blur-sm hover:bg-[var(--glass-bg-hover)]',
          open ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'
        )}
        style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <div className="grid h-5 w-5 place-content-center">
          <ChevronsRight
            className={cn(
              'h-4 w-4 transition-transform duration-300 text-[rgb(var(--muted))]',
              open && 'rotate-180',
            )}
          />
        </div>
        {open && (
          <span className="ml-2 text-xs font-medium text-[rgb(var(--muted))]">Collapse</span>
        )}
      </button>
    </aside>
  )
}

/* ────────────────────────────────────────────────── */

function NavLink({
  item,
  active,
  open,
  guestMode,
  onClick,
}: {
  item: NavItem
  active: boolean
  open: boolean
  guestMode: boolean
  onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'nav-item flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium',
        active && 'nav-item-active',
        item.requiresAuth && guestMode && 'opacity-80',
        !open && 'justify-center px-0',
      )}
      aria-current={active ? 'page' : undefined}
      title={!open ? item.label : undefined}
    >
      <span className={cn('relative ui-liquid-icon flex shrink-0 items-center justify-center', open ? 'h-9 w-9' : 'h-10 w-10')}>
        <Icon className="h-4 w-4" aria-hidden />
        {!open && !!item.notifs && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[8px] font-bold text-white ring-2 ring-[rgb(var(--bg))]">
            {item.notifs > 9 ? '9+' : item.notifs}
          </span>
        )}
      </span>
      {open && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {open && !!item.notifs && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[rgb(var(--accent))] px-1 text-[10px] font-bold text-white">
          {item.notifs > 99 ? '99+' : item.notifs}
        </span>
      )}
      {item.requiresAuth && guestMode && open && <span className="badge-pro shrink-0">Pro</span>}
    </Link>
  )
}
