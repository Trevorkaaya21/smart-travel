'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { MapPin, Compass, Share2, CalendarDays } from 'lucide-react'

const LANDING_STORAGE_KEY = 'st_guest'
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1920&q=80'

function clearGuestFlag() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LANDING_STORAGE_KEY)
}

export default function LandingPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [leaving, setLeaving] = React.useState<null | 'auth' | 'guest'>(null)

  React.useEffect(() => setMounted(true), [])
  React.useEffect(() => {
    clearGuestFlag()
  }, [])

  React.useEffect(() => {
    if (!leaving) return
    const path = leaving === 'guest' ? '/dashboard?guest=1' : '/dashboard'
    const t = setTimeout(() => router.push(path), 400)
    return () => clearTimeout(t)
  }, [leaving, router])

  const onGuest = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANDING_STORAGE_KEY, '1')
    }
    setLeaving('guest')
  }, [])

  const onSignIn = React.useCallback(() => {
    clearGuestFlag()
    setLeaving('auth')
    signIn('google', { callbackUrl: '/dashboard' })
  }, [])

  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-[rgb(var(--bg))] text-[rgb(var(--text))] transition-colors duration-300">
      {/* Theme-aware hero background */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[rgb(var(--bg))] transition-colors duration-300"
        aria-hidden
      >
        {isDark ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${HERO_IMAGE})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/70 to-slate-950/95" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(251,191,36,0.06),transparent_60%)]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-slate-100/80 to-slate-50" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(245,158,11,0.05),transparent_60%)]" />
          </>
        )}
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 pb-20 pt-16 sm:px-8 md:px-10 lg:pt-24">
        <header className="flex flex-1 flex-col justify-center gap-8 text-center md:text-left">
          <div
            className="landing-fade mx-auto flex w-fit items-center gap-2 rounded-full border px-4 py-2 backdrop-blur-sm md:mx-0"
            style={{ animationDelay: '0.1s', borderColor: 'rgba(var(--border) / 0.25)', background: 'var(--glass-bg)' }}
          >
            <Compass className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Smart Travel
            </span>
          </div>

          <h1
            className="landing-fade text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ animationDelay: '0.2s' }}
          >
            Your next adventure,{' '}
            <span className="block bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 bg-clip-text text-transparent">
              planned.
            </span>
          </h1>

          <p
            className="landing-fade mx-auto max-w-xl text-lg leading-relaxed text-[rgb(var(--muted))] md:mx-0 md:text-xl"
            style={{ animationDelay: '0.3s' }}
          >
            Discover places with AI, build day‑by‑day itineraries, and keep every trip in one
            workspace. Start as a guest or sign in to save and sync.
          </p>

          <div
            className="landing-fade flex flex-col items-center gap-4 sm:flex-row sm:gap-5"
            style={{ animationDelay: '0.4s' }}
          >
            <button
              type="button"
              onClick={onSignIn}
              className="btn btn-primary w-full max-w-[280px] gap-3 rounded-2xl px-6 py-3.5 text-base font-semibold sm:max-w-none"
              aria-label="Sign in with Google"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-sm font-bold">
                G
              </span>
              Sign in with Google
            </button>
            <button
              type="button"
              onClick={onGuest}
              className="btn btn-ghost w-full max-w-[280px] rounded-2xl px-6 py-3.5 text-base font-semibold sm:max-w-none"
              aria-label="Continue as guest"
            >
              Continue as guest
            </button>
          </div>
        </header>

        <section
          className="landing-fade mt-16 grid gap-6 sm:grid-cols-3 lg:mt-24 lg:gap-8"
          style={{ animationDelay: '0.5s' }}
          aria-label="Features"
        >
          <FeatureCard
            icon={MapPin}
            title="Discover with AI"
            description="Describe vibes, budgets, or activities. We surface the best spots and drop them on a map."
          />
          <FeatureCard
            icon={CalendarDays}
            title="Build itineraries"
            description="Drag-and-drop days, add notes, and keep plans in sync across devices."
          />
          <FeatureCard
            icon={Share2}
            title="Save & share"
            description="Favorites, diary entries, and shared trips so you can revisit every journey."
          />
        </section>

        <footer
          className="mt-16 flex justify-center pb-8 text-xs font-medium uppercase tracking-[0.3em] text-[rgb(var(--muted))] lg:mt-24"
          role="contentinfo"
        >
          Built to help you travel smarter
        </footer>
      </div>
    </main>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="group flex flex-col gap-4 rounded-2xl border p-6 backdrop-blur-sm transition-all duration-200 hover:translate-y-[-2px]" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl text-[rgb(var(--accent))] transition-colors" style={{ background: 'rgba(var(--accent) / 0.12)' }}>
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-[rgb(var(--text))]">{title}</h2>
      <p className="text-sm leading-relaxed text-[rgb(var(--muted))]">{description}</p>
    </div>
  )
}
