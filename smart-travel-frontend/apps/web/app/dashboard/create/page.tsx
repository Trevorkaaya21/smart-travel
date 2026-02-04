'use client'

import * as React from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Wand2, CalendarRange, Save, MapPinned, PenLine, Copy } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useGuest } from '@/lib/useGuest'
import { API_BASE } from '@/lib/api'
import { cn } from '@/lib/utils'

type AiEntry = {
  title: string
  time?: string | null
  duration?: string | null
  description?: string | null
  category?: string | null
  neighborhood?: string | null
}

type AiDay = {
  day: number
  title?: string | null
  theme?: string | null
  summary?: string | null
  entries: AiEntry[]
}

type AiItinerary = {
  tripTitle?: string
  summary?: string
  days: AiDay[]
}

const PREFERENCES = [
  'Food & markets',
  'Hidden bars',
  'Live music',
  'Museums & art',
  'Outdoors',
  'Architecture',
  'Design & shopping',
  'Nightlife',
  'Wellness',
  'Family friendly',
  'Romantic',
  'History',
  'Adventure sports',
]

const PACE_OPTIONS = ['Chill', 'Balanced', 'Full throttle'] as const
const BUDGET_OPTIONS = ['Budget', 'Comfort', 'Luxury'] as const
const TRAVELER_TYPES = ['Solo', 'Couple', 'Friends', 'Family'] as const

const DEFAULT_ITINERARY: AiItinerary = { days: [] }

export default function CreateItineraryPage() {
  const { data: session, status } = useSession()
  const { isGuest } = useGuest()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [destination, setDestination] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [days, setDays] = React.useState(3)
  const [pace, setPace] = React.useState<(typeof PACE_OPTIONS)[number]>('Balanced')
  const [budget, setBudget] = React.useState<(typeof BUDGET_OPTIONS)[number]>('Comfort')
  const [traveler, setTraveler] = React.useState<(typeof TRAVELER_TYPES)[number]>('Couple')
  const [notes, setNotes] = React.useState('')
  const [preferences, setPreferences] = React.useState<string[]>(['Food & markets', 'Museums & art'])

  // Memoize preference toggle function to prevent unnecessary re-renders
  const togglePreferenceMemo = React.useCallback((pref: string) => {
    setPreferences(prev =>
      prev.includes(pref)
        ? prev.filter(p => p !== pref)
        : [...prev, pref]
    )
  }, [])
  const [loading, setLoading] = React.useState(false)
  const [itinerary, setItinerary] = React.useState<AiItinerary>(DEFAULT_ITINERARY)
  const [saving, setSaving] = React.useState(false)
  const [tripName, setTripName] = React.useState('')

  const email = (session?.user as any)?.email as string | undefined
  const authenticated = status === 'authenticated' && !!email && !isGuest

  const duplicateDayAtIndex = React.useCallback((index: number) => {
    setItinerary(prev => {
      const currentDays = prev.days
      if (index < 0 || index >= currentDays.length) return prev
      const dayToCopy = currentDays[index]
      const copied: AiDay = {
        day: index + 2,
        title: dayToCopy.title ? `${dayToCopy.title} (copy)` : undefined,
        theme: dayToCopy.theme ?? undefined,
        summary: dayToCopy.summary ?? undefined,
        entries: (dayToCopy.entries ?? []).map(e => ({ ...e })),
      }
      const newDays: AiDay[] = [
        ...currentDays.slice(0, index + 1),
        copied,
        ...currentDays.slice(index + 1),
      ]
      newDays.forEach((d, i) => {
        d.day = i + 1
      })
      return { ...prev, days: newDays }
    })
    toast.success('Day duplicated', { description: 'The new day was inserted right after.' })
  }, [])

  React.useEffect(() => {
    if (!destination) return
    const labelParts = [destination]
    if (startDate) labelParts.push(formatDateLabel(startDate))
    setTripName(labelParts.join(' • '))
  }, [destination, startDate])

  if (!authenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center animate-fade-in">
        <div className="content-card max-w-lg space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="ui-liquid-icon">
              <PenLine className="h-6 w-6 text-[rgb(var(--accent))]" />
            </div>
            <span className="badge-pro inline-flex items-center gap-2">
              <Wand2 className="h-3.5 w-3.5 text-[rgb(var(--accent))]" />
              Create with AI
            </span>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-[rgb(var(--text))]">
              Sign in to craft itineraries
            </h1>
            <p className="text-sm leading-relaxed text-[color-mix(in_oklab,rgb(var(--text))_75%,rgb(var(--muted))_25%)]">
              Guests can explore Discover. To save personalized itineraries, drag-and-drop days, and sync across devices, connect your Google account.
            </p>
          </div>
          <Button
            onClick={() => signIn('google')}
            className="btn btn-primary w-full justify-center rounded-2xl px-6 py-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-80 animate-scale-in"
            style={{ animationDelay: '0.2s' }}
          >
            Sign in with Google
          </Button>
        </div>
      </div>
    )
  }

  async function generate() {
    // Input validation
    const trimmedDestination = destination.trim()
    if (!trimmedDestination) {
      toast.error('Destination required', { description: 'Please enter where you\'re traveling to.' })
      return
    }
    if (trimmedDestination.length < 2) {
      toast.error('Invalid destination', { description: 'Please enter a valid destination name.' })
      return
    }
    if (days < 1 || days > 10) {
      toast.error('Invalid duration', { description: 'Please enter a duration between 1 and 10 days.' })
      return
    }

    setLoading(true)
    setSaving(false)
    try {
      const prompt = buildPrompt({
        destination: trimmedDestination,
        days,
        startDate,
        pace,
        budget,
        traveler,
        preferences,
        notes,
      })

      const res = await fetch(`${API_BASE}/v1/ai/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok) {
        const raw = await res.text()
        let errorMessage = 'Generation failed'
        try {
          const parsed = JSON.parse(raw)
          errorMessage = parsed.message || parsed.error || errorMessage
        } catch {
          if (raw && raw.length < 200) errorMessage = raw
        }
        throw new Error(errorMessage)
      }
      const data = await res.json()
      const parsed = parseItinerary(data?.text ?? '')
      if (!parsed || !parsed.days?.length) {
        throw new Error('AI response did not include a valid itinerary. Please try again.')
      }
      setItinerary(parsed)
      toast.success('Itinerary generated', { description: 'Review the plan below, then save it into your workspace.' })
    } catch (err) {
      console.error(err)
      const errorMessage = err instanceof Error ? err.message : 'Please try again.'
      toast.error('Could not generate itinerary', {
        description: errorMessage,
        duration: 5000,
      })
      setItinerary(DEFAULT_ITINERARY)
    } finally {
      setLoading(false)
    }
  }

  async function savePlan() {
    if (!email) return
    if (!itinerary.days.length) {
      toast('Generate an itinerary first.')
      return
    }

    setSaving(true)
    try {
      const name = tripName.trim() || itinerary.tripTitle || `AI Trip • ${destination}`
      const tripRes = await fetch(`${API_BASE}/v1/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': email,
        },
        body: JSON.stringify({ name }),
      })
      if (!tripRes.ok) {
        const raw = await tripRes.text()
        throw new Error(raw || 'Trip creation failed')
      }
      const { id } = await tripRes.json()
      if (!id) throw new Error('Missing trip id')

      // Parallelize place resolution and item creation for better performance
      const allEntries = itinerary.days.flatMap((day, dayIndex) =>
        (day.entries ?? []).map((entry) => ({
          entry,
          dayNumber: day.day ?? dayIndex + 1,
        }))
      )

      // Resolve all places in parallel (with concurrency limit to avoid overwhelming the API)
      type ResolvedPlace = Awaited<ReturnType<typeof resolvePlace>>
      const BATCH_SIZE = 5
      const resolvedPlaces: ResolvedPlace[] = []
      for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
        const batch = allEntries.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
          batch.map(({ entry }) => resolvePlace(entry, destination))
        )
        resolvedPlaces.push(...batchResults)
      }

      // Validate that we have resolved places for all entries
      if (resolvedPlaces.length !== allEntries.length) {
        throw new Error('Failed to resolve all places. Please try again.')
      }

      // Create all items in parallel batches
      const itemPromises = allEntries.map(async ({ entry, dayNumber }, idx) => {
        const resolved = resolvedPlaces[idx]
        if (!resolved) {
          throw new Error(`Failed to resolve place for ${entry.title}`)
        }
        const noteParts = [entry.description, entry.neighborhood, entry.duration].filter(Boolean)
        const itemRes = await fetch(`${API_BASE}/v1/trips/${id}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': email,
          },
          body: JSON.stringify({
            place_id: resolved.place_id,
            day: dayNumber,
            note: noteParts.join(' • ') || null,
            place: resolved.place,
          }),
        })
        if (!itemRes.ok) {
          const raw = await itemRes.text()
          throw new Error(raw || `Failed to save ${entry.title}`)
        }
        return itemRes.json()
      })

      // Wait for all items to be created
      await Promise.all(itemPromises)

      toast.success('Itinerary saved', {
        description: 'Visit My Trips to fine-tune the schedule.',
        duration: 4000,
      })
      await queryClient.invalidateQueries({ queryKey: ['trips', email] })
      setTimeout(() => {
        router.push(`/trip/${id}`)
      }, 500)
    } catch (err) {
      console.error(err)
      toast.error('Could not save itinerary', {
        description: err instanceof Error ? err.message : 'Try regenerating or saving again.'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-8 text-[rgb(var(--text))]">
      <header className="content-header">
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.35em] text-[color-mix(in_oklab,rgb(var(--text))_65%,rgb(var(--muted))_35%)]">
            Create with AI
          </p>
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
            Generate a day-by-day itinerary tailored to your vibe
          </h1>
          <p className="max-w-2xl text-sm text-[color-mix(in_oklab,rgb(var(--text))_72%,rgb(var(--muted))_28%)]">
            Blend your travel style, time frame, and must-have experiences. Google AI Studio shapes it into a structured plan you can edit inside Smart Travel.
          </p>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="content-card space-y-6">
          <h2 className="text-lg font-semibold">Trip blueprint</h2>

          <div className="space-y-4 text-sm text-[color-mix(in_oklab,rgb(var(--text))_74%,rgb(var(--muted))_26%)]">
            <Field label="Where are you headed?">
              <Input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Lisbon, Portugal"
                className="input-surface"
                aria-label="Destination"
                autoComplete="off"
                maxLength={100}
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Start date">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-surface"
                  aria-label="Start date"
                />
              </Field>
              <Field label="Duration (days)">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={days}
                  onChange={(e) => setDays(Math.max(1, Math.min(10, Number(e.target.value))))}
                  className="input-surface"
                  aria-label="Duration in days"
                />
              </Field>
            </div>

            <Field label="Preferences">
              <div className="flex flex-wrap gap-2">
                {PREFERENCES.map(pref => {
                  const active = preferences.includes(pref)
                  return (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => togglePreferenceMemo(pref)}
                      className={cn(
                        'group relative inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200',
                        active
                          ? 'text-[rgb(var(--accent-contrast))]'
                          : 'text-[color-mix(in_oklab,rgb(var(--text))_75%,rgb(var(--muted))_25%)] hover:translate-y-[-2px]'
                      )}
                      style={{
                        border: active ? '1px solid transparent' : '1px solid rgba(var(--border) / .5)',
                        background: active
                          ? 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-secondary)))'
                          : 'linear-gradient(165deg, rgba(var(--surface) / .85), rgba(var(--surface-muted) / .7))',
                        boxShadow: active
                          ? '0 2px 8px rgba(var(--accent) / .25)'
                          : '0 2px 8px rgba(var(--shadow-color) / .05)',
                      }}
                    >
                      {pref}
                      {active && (
                        <div className="absolute inset-0 rounded-full bg-white/10 opacity-50" />
                      )}
                    </button>
                  )
                })}
              </div>
            </Field>

            <div className="grid gap-4 md:grid-cols-3">
              <ChipSelect label="Pace" value={pace} options={PACE_OPTIONS} onChange={setPace} />
              <ChipSelect label="Budget" value={budget} options={BUDGET_OPTIONS} onChange={setBudget} />
              <ChipSelect label="Travelers" value={traveler} options={TRAVELER_TYPES} onChange={setTraveler} />
            </div>

            <Field label="Anything else to include?">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add context like “we land Friday evening”, “prefer late breakfasts”, “celebrating anniversary”"
                className="textarea-surface min-h-[90px]"
                aria-label="Additional notes"
                maxLength={500}
                rows={4}
              />
            </Field>
          </div>

          <Button
            onClick={generate}
            disabled={loading || !destination.trim()}
            className="btn btn-primary w-full rounded-2xl px-6 py-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-200"
            aria-label="Generate itinerary"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2.5 relative z-10">
                <Loader2 className="h-5 w-5 animate-spin" />
                Composing with AI…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2.5 relative z-10">
                <Wand2 className="h-5 w-5 group-hover:rotate-12 transition-transform duration-300" />
                Generate itinerary
              </span>
            )}
          </Button>
        </section>

        <section className="content-card flex min-h-[520px] flex-col gap-6">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Preview itinerary</h2>
              <p className="text-xs uppercase tracking-[0.3em] text-[color-mix(in_oklab,rgb(var(--text))_62%,rgb(var(--muted))_38%)]">
                Drag and refine later in My Trips
              </p>
            </div>
            <div
              className="inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200"
              style={{
                borderColor: 'rgba(var(--border) / .5)',
                background: 'linear-gradient(165deg, rgba(var(--surface-muted) / .6), rgba(var(--surface-muted) / .4))',
                boxShadow: '0 2px 8px rgba(var(--shadow-color) / .05)'
              }}
            >
              <CalendarRange className="h-4 w-4 text-[rgb(var(--accent))]" />
              <span className="text-[color-mix(in_oklab,rgb(var(--text))_75%,rgb(var(--muted))_25%)]">
                {days} days · {pace.toLowerCase()} pace
              </span>
            </div>
          </header>

          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-[color-mix(in_oklab,rgb(var(--text))_68%,rgb(var(--muted))_32%)] animate-fade-in">
              <Loader2 className="h-8 w-8 animate-spin text-[rgb(var(--accent))]" aria-hidden />
              <div className="text-center space-y-3 max-w-md">
                <p className="text-sm font-medium text-[color-mix(in_oklab,rgb(var(--text))_75%,rgb(var(--muted))_25%)]">
                  Building your itinerary…
                </p>
                <div className="mt-6 space-y-4 w-full">
                  {Array.from({ length: Math.min(days, 3) }).map((_, i) => (
                    <div key={i} className="content-subtle space-y-3 animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="h-4 w-24 bg-[rgb(var(--surface-muted))]/50 rounded" />
                        <div className="h-5 w-16 bg-[rgb(var(--surface-muted))]/50 rounded-full" />
                      </div>
                      <div className="h-3 w-full bg-[rgb(var(--surface-muted))]/50 rounded" />
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, j) => (
                          <div key={j} className="h-16 bg-[rgb(var(--surface-muted))]/50 rounded-2xl" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : itinerary.days.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-[color-mix(in_oklab,rgb(var(--text))_68%,rgb(var(--muted))_32%)] animate-fade-in">
              <MapPinned className="h-12 w-12 text-[rgb(var(--accent))]" aria-hidden />
              <div className="space-y-2 max-w-sm">
                <p className="text-sm font-medium">
                  Your itinerary appears here. Enter a destination, set your preferences, and generate to preview.
                </p>
                <p className="text-xs text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
                  AI-powered suggestions
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-5 overflow-y-auto pr-2">
              {itinerary.days.map((day, idx) => (
                <DayCard
                  key={`day-${idx}-${day.day}`}
                  day={day}
                  dayIndex={idx}
                  onDuplicate={duplicateDayAtIndex}
                />
              ))}
            </div>
          )}

          {itinerary.days.length > 0 && (
            <div className="content-subtle space-y-3 text-sm">
              <Field label="Trip name">
                <Input
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="AI Weekend in Lisbon"
                  className="input-surface"
                  aria-label="Trip name"
                  maxLength={100}
                  autoComplete="off"
                />
              </Field>
              <Button
                onClick={savePlan}
                disabled={saving}
                className="btn btn-primary w-full rounded-2xl px-6 py-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-200"
              >
                {saving ? (
                  <span className="inline-flex items-center gap-2.5">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Saving to My Trips…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2.5">
                    <Save className="h-5 w-5" />
                    Save to My Trips
                  </span>
                )}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="form-label">{label}</span>
      {children}
    </label>
  )
}

// Memoized ChipSelect component for better performance
const ChipSelect = React.memo(function ChipSelect<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}) {
  return (
    <Field label={label}>
      <div className="grid gap-2">
        {options.map(option => {
          const active = option === value
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                'group relative flex items-center justify-between rounded-2xl px-4 py-2.5 text-xs font-semibold transition-all duration-200',
                active
                  ? 'text-[rgb(var(--accent-contrast))]'
                  : 'text-[color-mix(in_oklab,rgb(var(--text))_75%,rgb(var(--muted))_25%)] hover:translate-y-[-2px]'
              )}
              style={{
                border: active ? '1px solid transparent' : '1px solid rgba(var(--border) / .5)',
                background: active
                  ? 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-secondary)))'
                  : 'linear-gradient(165deg, rgba(var(--surface) / .85), rgba(var(--surface-muted) / .7))',
                boxShadow: active
                  ? '0 2px 8px rgba(var(--accent) / .25)'
                  : '0 2px 8px rgba(var(--shadow-color) / .05)',
              }}
            >
              {option}
              {active && (
                <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-50" />
              )}
            </button>
          )
        })}
      </div>
    </Field>
  )
}) as <T extends string>(props: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) => JSX.Element

// Memoized DayCard component for better performance
const DayCard = React.memo(function DayCard({
  day,
  dayIndex,
  onDuplicate,
}: {
  day: AiDay
  dayIndex: number
  onDuplicate: (index: number) => void
}) {
  return (
    <article className="content-subtle space-y-4 transition-all duration-200">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1.5">
          <span className="form-label text-[rgb(var(--muted))]">Day {day.day}</span>
          <h3 className="text-lg font-semibold text-[rgb(var(--text))]">{day.title || `Day ${day.day}`}</h3>
        </div>
        <div className="flex items-center gap-2">
          {day.theme && <span className="badge-pro text-[10px]">{day.theme}</span>}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDuplicate(dayIndex)}
            className="btn btn-ghost h-8 gap-1.5 rounded-xl px-2.5 text-xs font-medium text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]"
            title="Duplicate day"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </Button>
        </div>
      </div>
      {day.summary && (
        <p className="text-sm leading-relaxed text-[rgb(var(--text))] opacity-90">{day.summary}</p>
      )}
      <div className="space-y-3">
        {(day.entries ?? []).map((entry, idx) => (
          <div
            key={`${entry.title}-${idx}`}
            className="group rounded-2xl border px-4 py-3.5 text-sm transition-shadow duration-200 hover:shadow-[var(--shadow-sm)]"
            style={{
              borderColor: 'rgba(var(--border) / 0.4)',
              background: 'var(--glass-bg)',
              boxShadow: '0 4px 16px rgba(var(--shadow-color) / 0.12)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-[rgb(var(--text))]">{entry.title}</div>
              <div className="shrink-0 rounded-full bg-[rgb(var(--accent))]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[rgb(var(--accent))]">
                {entry.time || 'Flexible'}
              </div>
            </div>
            {entry.description && (
              <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--text))] opacity-90">
                {entry.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.category && (
                <span className="rounded-lg border border-[rgb(var(--accent))]/25 bg-[rgb(var(--accent))]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--accent))]">
                  #{entry.category}
                </span>
              )}
              {entry.neighborhood && (
                <span className="rounded-lg border border-[rgb(var(--border))]/4 bg-[rgb(var(--surface-muted))]/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--text))]">
                  @{entry.neighborhood}
                </span>
              )}
              {entry.duration && (
                <span className="rounded-lg border border-[rgb(var(--border))]/4 bg-[rgb(var(--surface-muted))]/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--text))]">
                  {entry.duration}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </article>
  )
})


function buildPrompt(input: {
  destination: string
  days: number
  startDate?: string
  pace: string
  budget: string
  traveler: string
  preferences: string[]
  notes?: string
}) {
  const { destination, days, startDate, pace, budget, traveler, preferences, notes } = input
  const prefText = preferences.length ? preferences.join(', ') : 'any interesting spots'
  const dateText = startDate ? `starting on ${formatDateLabel(startDate)}` : 'with flexible dates'
  const context = [
    `Destination: ${destination}`,
    `Trip length: ${days} days`,
    `Timing: ${dateText}`,
    `Travelers: ${traveler}`,
    `Trip pace: ${pace}`,
    `Budget: ${budget}`,
    `Preferences: ${prefText}`,
    notes ? `Additional notes: ${notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return `
You are Smart Travel's AI trip designer. Using the preferences below, produce a JSON itinerary with no extra prose.

${context}

Return strictly valid JSON matching:
{
  "tripTitle": string,
  "summary": string,
  "days": [
    {
      "day": number,
      "title": string,
      "theme": string,
      "summary": string,
      "entries": [
        {
          "title": string,
          "description": string,
          "time": "08:30" | "Morning" | "" (use 24h where specific),
          "duration": string,
          "category": string,
          "neighborhood": string
        }
      ]
    }
  ]
}

Focus each entry on a single compelling activity or meal. At most 5 entries per day. Do not wrap the JSON in backticks or markdown.
`.trim()
}

function parseItinerary(raw: string): AiItinerary | null {
  if (!raw) return null
  const cleaned = raw.trim()
  const jsonCandidate = extractJSONObject(cleaned)
  if (!jsonCandidate) return null
  try {
    const parsed = JSON.parse(jsonCandidate) as AiItinerary
    if (!parsed.days || !Array.isArray(parsed.days)) return null
    return parsed
  } catch (err) {
    console.warn('Failed to parse itinerary JSON', err)
    return null
  }
}

function extractJSONObject(raw: string) {
  const codeBlock = raw.match(/```json([\s\S]*?)```/i)
  if (codeBlock?.[1]) return codeBlock[1].trim()
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1) return null
  return raw.slice(firstBrace, lastBrace + 1)
}

async function resolvePlace(entry: AiEntry, destination: string) {
  const query = `${entry.title} ${destination}`.trim()
  try {
    const res = await fetch(`${API_BASE}/v1/ai/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, limit: 1 }),
    })
    if (res.ok) {
      const data = await res.json()
      const best = Array.isArray(data?.items) ? data.items[0] : null
      if (best) {
        return {
          place_id: best.id,
          place: {
            id: best.id,
            name: best.name,
            category: best.category ?? entry.category ?? 'poi',
            rating: best.rating ?? null,
            lat: best.lat ?? null,
            lng: best.lng ?? null,
          },
        }
      }
    }
  } catch (err) {
    console.warn('Could not resolve place for', entry.title, err)
  }

  const fallbackId = `ai-${slugify(entry.title)}-${Math.random().toString(36).slice(2, 8)}`
  return {
    place_id: fallbackId,
    place: {
      id: fallbackId,
      name: entry.title,
      category: entry.category ?? 'poi',
      rating: null,
      lat: null,
      lng: null,
    },
  }
}

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'place'
}

function formatDateLabel(value: string) {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return value
  }
}
