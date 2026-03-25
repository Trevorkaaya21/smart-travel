'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { CalendarDays, Heart, Wand2, ArrowRight } from 'lucide-react'

const LANDING_STORAGE_KEY = 'st_guest'
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=2070&q=80'

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
  React.useEffect(() => { clearGuestFlag() }, [])

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
      {/* Hero background */}
      <div className="pointer-events-none fixed inset-0 -z-10 transition-colors duration-300" aria-hidden>
        {isDark ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${HERO_IMAGE})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[rgb(var(--bg))]/90 via-[rgb(var(--bg))]/75 to-[rgb(var(--bg))]/95" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(6,182,212,0.08),transparent_60%)]" />
          </>
        ) : (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.08]"
              style={{ backgroundImage: `url(${HERO_IMAGE})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(6,182,212,0.06),transparent_60%)]" />
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-[rgb(var(--accent))]"
            style={{ background: 'rgba(var(--accent) / 0.15)' }}
          >
            ST
          </div>
          <span className="text-lg font-bold tracking-tight text-[rgb(var(--text))]">SmartTravel</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSignIn}
            className="hidden rounded-xl border px-4 py-2 text-sm font-medium backdrop-blur-sm transition hover:bg-[var(--glass-bg-hover)] sm:inline-flex"
            style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pb-16 pt-12 text-center sm:px-8 sm:pt-20 lg:pt-28">
        {/* Badge */}
        <div
          className="landing-fade mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 backdrop-blur-sm"
          style={{ animationDelay: '0.1s', borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            AI-Powered Planning
          </span>
        </div>

        {/* Headline */}
        <h1
          className="landing-fade text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ animationDelay: '0.2s' }}
        >
          Stop searching.
          <br />
          <span className="bg-gradient-to-r from-[rgb(var(--accent))] via-cyan-400 to-sky-400 bg-clip-text text-transparent">
            Start exploring.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="landing-fade mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[rgb(var(--muted))] md:text-xl"
          style={{ animationDelay: '0.3s' }}
        >
          Describe your ideal vibe—&ldquo;cozy autumn cabins&rdquo; or &ldquo;sunny beach vibes&rdquo;—and
          let our AI build your perfect itinerary in seconds.
        </p>

        {/* CTA Buttons */}
        <div
          className="landing-fade mt-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-5"
          style={{ animationDelay: '0.4s' }}
        >
          <button
            type="button"
            onClick={onGuest}
            className="group flex w-full max-w-[300px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[rgb(var(--accent))] to-sky-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[rgb(var(--accent))]/25 transition-all hover:scale-[1.02] hover:shadow-xl sm:w-auto"
          >
            Plan my trip for free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button
            type="button"
            onClick={onSignIn}
            className="flex w-full max-w-[300px] items-center justify-center gap-3 rounded-2xl border px-8 py-4 text-base font-semibold backdrop-blur-sm transition-all hover:bg-[var(--glass-bg-hover)] sm:w-auto"
            style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-sm font-bold text-slate-700 shadow-sm">G</span>
            Sign in with Google
          </button>
        </div>

        <p
          className="landing-fade mt-5 text-sm text-[rgb(var(--muted))]"
          style={{ animationDelay: '0.45s' }}
        >
          No credit card required. Continue as guest.
        </p>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 sm:px-8">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[rgb(var(--accent))]/5 blur-3xl" aria-hidden />

        <div
          className="landing-fade mb-12 text-center"
          style={{ animationDelay: '0.5s' }}
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Everything in one place</h2>
          <p className="mt-3 text-[rgb(var(--muted))]">From a single spark of an idea to a fully planned journey.</p>
        </div>

        <div
          className="landing-fade grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          style={{ animationDelay: '0.6s' }}
        >
          <FeatureCard
            icon={Wand2}
            title="Discover with AI"
            description="Don't know where to go? Describe your mood or activities. Our AI drops pins on a map tailored to you."
            colorClass="text-[rgb(var(--accent))]"
            bgClass="bg-[rgb(var(--accent))]/10"
          />
          <FeatureCard
            icon={CalendarDays}
            title="Smart Itineraries"
            description="Drag, drop, and organize your days. Add notes and photos. Everything syncs and stays up to date."
            colorClass="text-sky-400"
            bgClass="bg-sky-400/10"
          />
          <FeatureCard
            icon={Heart}
            title="Save & Share"
            description="Save memories to your travel diary and share your adventures with friends effortlessly."
            colorClass="text-rose-400"
            bgClass="bg-rose-400/10"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 pb-12 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-[rgb(var(--muted))]">
          Built to help you travel smarter
        </p>
      </footer>
    </main>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  colorClass,
  bgClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  colorClass: string
  bgClass: string
}) {
  return (
    <div
      className="group flex flex-col gap-4 rounded-2xl border p-7 backdrop-blur-sm transition-all duration-200 hover:translate-y-[-2px] hover:shadow-lg"
      style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${bgClass} ${colorClass}`}>
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-[rgb(var(--text))]">{title}</h3>
      <p className="text-sm leading-relaxed text-[rgb(var(--muted))]">{description}</p>
    </div>
  )
}
