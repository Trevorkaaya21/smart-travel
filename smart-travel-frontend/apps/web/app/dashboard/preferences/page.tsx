'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'

type Prefs = {
  interests: string[]
  budget: 'low' | 'medium' | 'high'
  maxPerDay?: number | null
  home?: string
}

const TAGS = ['Museums','Coffee','Food','Nightlife','Outdoors','Art','Shopping','Hidden Gems','Viewpoints']

export default function PreferencesPage() {
  const router = useRouter()
  const [prefs, setPrefs] = React.useState<Prefs>({
    interests: [],
    budget: 'medium',
    maxPerDay: 5,
    home: ''
  })

  React.useEffect(() => {
    const raw = localStorage.getItem('st.prefs')
    if (raw) {
      try { setPrefs({ ...prefs, ...JSON.parse(raw) }) } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (t: string) =>
    setPrefs(p => ({
      ...p,
      interests: p.interests.includes(t)
        ? p.interests.filter(x => x !== t)
        : [...p.interests, t]
    }))

  const save = () => {
    localStorage.setItem('st.prefs', JSON.stringify(prefs))
    router.push('/dashboard')
  }

  return (
    <main className="space-y-6">
      <div className="content-header">
        <h1 className="text-2xl font-semibold text-[rgb(var(--text))]">Preferences</h1>
        <p className="text-sm text-[rgb(var(--muted))]">Tune search results and AI planning.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="content-card space-y-3">
          <div className="font-medium text-[rgb(var(--text))]">Interests</div>
          <div className="flex flex-wrap gap-2">
            {TAGS.map(t => (
              <button
                key={t}
                onClick={() => toggle(t)}
                className={`rounded-xl px-3 py-1.5 border text-sm font-medium transition-all ${
                  prefs.interests.includes(t)
                    ? 'bg-[rgb(var(--accent))]/15 border-[rgb(var(--accent))]/40 text-[rgb(var(--accent))]'
                    : 'btn-ghost'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="content-card space-y-3">
          <div className="font-medium text-[rgb(var(--text))]">Budget</div>
          <div className="flex gap-2">
            {(['low','medium','high'] as const).map(b => (
              <button
                key={b}
                onClick={() => setPrefs(p => ({ ...p, budget: b }))}
                className={`rounded-xl px-3 py-1.5 border text-sm font-medium capitalize transition-all ${
                  prefs.budget === b
                    ? 'bg-[rgb(var(--accent))]/15 border-[rgb(var(--accent))]/40 text-[rgb(var(--accent))]'
                    : 'btn-ghost'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <label className="block mt-3 text-sm text-[rgb(var(--muted))]">Max places per day</label>
          <input
            type="number"
            min={1}
            className="input-surface w-32"
            value={prefs.maxPerDay ?? 5}
            onChange={e => setPrefs(p => ({ ...p, maxPerDay: Number(e.target.value || 5) }))}
          />

          <label className="block mt-3 text-sm text-[rgb(var(--muted))]">Home Base (city)</label>
          <input
            className="input-surface w-full"
            placeholder="e.g., New York"
            value={prefs.home ?? ''}
            onChange={e => setPrefs(p => ({ ...p, home: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={save} className="btn btn-primary">Save</button>
        <button
          onClick={() => { localStorage.removeItem('st.prefs'); location.reload() }}
          className="btn btn-ghost"
        >
          Reset
        </button>
      </div>
    </main>
  )
}
