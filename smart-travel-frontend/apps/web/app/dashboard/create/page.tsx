'use client'

import * as React from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Wand2, CalendarRange, Save, MapPinned, Sparkles } from 'lucide-react'
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
  const [loading, setLoading] = React.useState(false)
  const [itinerary, setItinerary] = React.useState<AiItinerary>(DEFAULT_ITINERARY)
  const [saving, setSaving] = React.useState(false)
  const [tripName, setTripName] = React.useState('')

  const email = (session?.user as any)?.email as string | undefined
  const authenticated = status === 'authenticated' && !!email && !isGuest

  React.useEffect(() => {
    if (!destination) return
    const labelParts = [destination]
    if (startDate) labelParts.push(formatDateLabel(startDate))
    setTripName(labelParts.join(' • '))
  }, [destination, startDate])

  if (!authenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="content-card max-w-lg space-y-4">
          <span className="badge-pro inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[rgb(var(--accent))]" />
            Create with AI
          </span>
          <h1 className="text-4xl font-semibold text-[rgb(var(--text))]">Sign in to craft itineraries with Google AI Studio</h1>
          <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_72%,rgb(var(--muted))_28%)]">
            Guests can explore Discover. To save personalized itineraries, drag-and-drop days, and sync across devices, connect your Google account.
          </p>
          <Button
            onClick={() => signIn('google')}
            className="btn btn-primary w-full justify-center rounded-2xl px-5 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-80"
          >
            Sign in with Google
          </Button>
        </div>
      </div>
    )
  }

  async function generate() {
    if (!destination.trim()) {
      toast('Add a destination first.')
      return
    }
    setLoading(true)
    setSaving(false)
    try {
      const prompt = buildPrompt({
        destination,
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
        throw new Error(raw || 'Generation failed')
      }
      const data = await res.json()
      const parsed = parseItinerary(data?.text ?? '')
      if (!parsed) throw new Error('AI response did not include itinerary JSON.')
      setItinerary(parsed)
      toast.success('Itinerary generated', { description: 'Review the plan below, then save it into your workspace.' })
    } catch (err) {
      console.error(err)
      toast.error('Could not generate itinerary', { description: err instanceof Error ? err.message : 'Please try again.' })
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

      for (const day of itinerary.days) {
        for (let i = 0; i < (day.entries ?? []).length; i++) {
          const entry = day.entries[i]
          const resolved = await resolvePlace(entry, destination)
          const noteParts = [entry.description, entry.neighborhood, entry.duration].filter(Boolean)
          const itemRes = await fetch(`${API_BASE}/v1/trips/${id}/items`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': email,
            },
            body: JSON.stringify({
              place_id: resolved.place_id,
              day: day.day ?? itinerary.days.indexOf(day) + 1,
              note: noteParts.join(' • ') || null,
              place: resolved.place,
            }),
          })
          if (!itemRes.ok) {
            const raw = await itemRes.text()
            throw new Error(raw || `Failed to save ${entry.title}`)
          }
        }
      }

      toast.success('Itinerary saved to My Trips', { description: 'Visit My Trips to fine-tune the schedule.' })
      await queryClient.invalidateQueries({ queryKey: ['trips', email] })
      router.push(`/trip/${id}`)
    } catch (err) {
      console.error(err)
      toast.error('Could not save itinerary', { description: err instanceof Error ? err.message : 'Try regenerating or saving again.' })
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
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Start date">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-surface"
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
                      onClick={() => togglePreference(pref, preferences, setPreferences)}
                      className={cn(
                        'inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold transition',
                        active
                          ? 'text-[rgb(var(--accent-contrast))]'
                          : 'text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)] hover:-translate-y-[1px]'
                      )}
                      style={{
                        border: active ? '1px solid transparent' : '1px solid rgba(var(--border) / .6)',
                        background: active ? 'rgb(var(--accent))' : 'rgba(var(--surface) / .72)',
                        boxShadow: active ? '0 18px 38px rgba(var(--shadow-color) / .18)' : 'none',
                      }}
                    >
                      {pref}
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
              />
            </Field>
          </div>

          <Button
            onClick={generate}
            disabled={loading}
            className="btn btn-primary w-full rounded-2xl px-5 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Composing with AI…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
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
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]"
              style={{ border: '1px solid rgba(var(--border) / .6)', background: 'rgba(var(--surface-muted) / .45)' }}
            >
              <CalendarRange className="h-4 w-4 text-[rgb(var(--accent))]" />
              {days} days · {pace.toLowerCase()} pace
            </div>
          </header>

          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[color-mix(in_oklab,rgb(var(--text))_68%,rgb(var(--muted))_32%)]">
              <Loader2 className="h-6 w-6 animate-spin text-[rgb(var(--accent))]" />
              <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_65%,rgb(var(--muted))_35%)]">
                Coordinating days, balancing energy, and mapping highlights…
              </p>
            </div>
          ) : itinerary.days.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-[color-mix(in_oklab,rgb(var(--text))_68%,rgb(var(--muted))_32%)]">
              <MapPinned className="h-8 w-8 text-[rgb(var(--accent))]" />
              <p className="max-w-sm text-sm">
                Your AI itinerary appears here. Tell us where you&apos;re going, pick a vibe, and generate to preview.
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-5 overflow-y-auto pr-2">
              {itinerary.days.map(day => (
                <DayCard key={day.day} day={day} />
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
                />
              </Field>
              <Button
                onClick={savePlan}
                disabled={saving}
                className="btn btn-primary w-full rounded-2xl px-5 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving to My Trips…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Save className="h-4 w-4" />
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

function ChipSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
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
                'flex items-center justify-between rounded-2xl px-4 py-2 text-xs font-semibold transition',
                active
                  ? 'text-[rgb(var(--accent-contrast))]'
                  : 'text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)] hover:-translate-y-[1px]'
              )}
              style={{
                border: active ? '1px solid transparent' : '1px solid rgba(var(--border) / .6)',
                background: active ? 'rgb(var(--accent))' : 'rgba(var(--surface) / .72)',
                boxShadow: active ? '0 16px 36px rgba(var(--shadow-color) / .2)' : 'none',
              }}
            >
              {option}
            </button>
          )
        })}
      </div>
    </Field>
  )
}

function DayCard({ day }: { day: AiDay }) {
  return (
    <article className="content-subtle space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="form-label">Day {day.day}</span>
          <h3 className="text-base font-semibold text-[rgb(var(--text))]">{day.title || `Day ${day.day}`}</h3>
        </div>
        {day.theme && <span className="badge-pro text-[10px]">{day.theme}</span>}
      </div>
      {day.summary && (
        <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">{day.summary}</p>
      )}
      <div className="space-y-3">
        {(day.entries ?? []).map((entry, idx) => (
          <div
            key={`${entry.title}-${idx}`}
            className="rounded-2xl border px-4 py-3 text-sm transition"
            style={{
              borderColor: 'rgba(var(--border) / .55)',
              background: 'rgba(var(--surface) / .78)',
              boxShadow: '0 18px 36px rgba(var(--shadow-color) / .18)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-[rgb(var(--text))]">{entry.title}</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
                {entry.time || 'Flexible'}
              </div>
            </div>
            {entry.description && (
              <p className="mt-1 text-xs text-[color-mix(in_oklab,rgb(var(--text))_68%,rgb(var(--muted))_32%)]">{entry.description}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.25em] text-[color-mix(in_oklab,rgb(var(--text))_58%,rgb(var(--muted))_42%)]">
              {entry.category && <span>#{entry.category}</span>}
              {entry.neighborhood && <span>@{entry.neighborhood}</span>}
              {entry.duration && <span>{entry.duration}</span>}
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

function togglePreference(pref: string, current: string[], set: (v: string[]) => void) {
  if (current.includes(pref)) set(current.filter(p => p !== pref))
  else set([...current, pref])
}

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
