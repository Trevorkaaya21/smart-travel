
/* apps/web/app/page.tsx */
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'

function resetGuestFlag() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem('st_guest')
}

export default function LandingPage() {
  const router = useRouter()
  const [leaving, setLeaving] = React.useState<null | 'auth' | 'guest'>(null)

  React.useEffect(() => {
    resetGuestFlag()
  }, [])

  React.useEffect(() => {
    if (!leaving) return
    const next = leaving === 'guest' ? '/dashboard?guest=1' : '/dashboard'
    const timer = window.setTimeout(() => {
      router.push(next)
    }, 640)
    return () => window.clearTimeout(timer)
  }, [leaving, router])

  const onGuest = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('st_guest', '1')
    }
    setLeaving('guest')
  }, [])

  const onSignIn = React.useCallback(() => {
    resetGuestFlag()
    setLeaving('auth')
    signIn('google', { callbackUrl: '/dashboard' })
  }, [])

  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden text-white">
      {/* Animated travel video background */}
      <div className="absolute inset-0">
        <video
          className="h-full w-full object-cover"
          src="https://cdn.coverr.co/videos/coverr-clouds-over-the-alps-2903/1080p.mp4"
          autoPlay
          muted
          loop
          playsInline
          poster="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-900/80" />
      </div>

      {/* Star overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(transparent,rgba(15,23,42,0.65))]" />

      <AnimatePresence initial={false}>
        <motion.section
          key="hero"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0, x: leaving ? '-10%' : '0%' }}
          exit={{ opacity: 0, x: '-50%' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pb-16 pt-20 sm:px-8 md:px-12"
        >
          <header className="flex flex-col gap-6 text-center md:text-left">
            <span className="mx-auto w-fit rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur">
              Introducing Smart Travel
            </span>
            <h1 className="text-balance text-4xl font-semibold leading-tight text-white md:text-6xl lg:text-7xl">
              Your AI copilot for unforgettable adventures
            </h1>
            <p className="mx-auto max-w-2xl text-balance text-lg text-white/85 md:text-xl">
              Discover destinations, craft itineraries with Google AI Studio, and manage every detail with a fluid, liquid-glass workspace built for modern explorers.
            </p>
          </header>

          <div className="mt-12 flex flex-col items-center gap-4 md:flex-row md:gap-6">
            <button
              onClick={onSignIn}
              className="ui-glass ui-shine flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl px-6 py-3 text-base font-semibold text-white/95 shadow-xl transition hover:scale-[1.01]"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-lg">G</span>
              <span>Sign in with Google</span>
            </button>
            <button
              onClick={onGuest}
              className="ui-glass w-full max-w-xs rounded-2xl border-white/40 px-6 py-3 text-base font-semibold text-white/85 transition hover:border-white/60 hover:text-white"
            >
              Continue as Guest
            </button>
          </div>

          <div className="mt-16 grid gap-6 text-sm text-white/80 lg:grid-cols-3">
            <FeatureCard
              title="Discover with AI"
              description="Google-powered insights turn vague ideas into curated destinations, complete with immersive maps and photo-rich highlights."
            />
            <FeatureCard
              title="Build living itineraries"
              description="Drag, drop, and rearrange plans by day or time. Keep everything synced across devices with real-time glassmorphic boards."
            />
            <FeatureCard
              title="Save memories beautifully"
              description="Favorites, diary entries, and shared trips live together so you can revisit the story behind every journey."
            />
          </div>
        </motion.section>
      </AnimatePresence>

      <footer className="relative z-10 flex w-full justify-center pb-8 text-xs uppercase tracking-[0.35em] text-white/55">
        Built to help you travel smarter ✦
      </footer>
    </main>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="ui-glass ui-shine h-full rounded-3xl border border-white/15 bg-white/10 p-6 leading-relaxed backdrop-blur-xl">
      <h2 className="mb-2 text-base font-semibold text-white">{title}</h2>
      <p className="text-sm text-white/80">{description}</p>
    </div>
  )
}
