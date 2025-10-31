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
      <div className="glass p-4 rounded-2xl border border-white/15">
        <h1 className="text-2xl font-semibold">Preferences</h1>
        <p className="opacity-70 text-sm">Tune search results and AI planning.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass p-4 rounded-2xl border border-white/15 space-y-3">
          <div className="font-medium">Interests</div>
          <div className="flex flex-wrap gap-2">
            {TAGS.map(t => (
              <button
                key={t}
                onClick={() => toggle(t)}
                className={`rounded-xl px-3 py-1 border ${
                  prefs.interests.includes(t)
                    ? 'bg-white/20 border-white/20'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/15 space-y-3">
          <div className="font-medium">Budget</div>
          <div className="flex gap-2">
            {(['low','medium','high'] as const).map(b => (
              <button
                key={b}
                onClick={() => setPrefs(p => ({ ...p, budget: b }))}
                className={`rounded-xl px-3 py-1 border ${
                  prefs.budget === b ? 'bg-white/20 border-white/20' : 'bg-white/5 border-white/10'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <label className="block mt-3 text-sm opacity-80">Max places per day</label>
          <input
            type="number"
            min={1}
            className="w-32 rounded-xl bg-white/10 border border-white/15 px-3 py-1"
            value={prefs.maxPerDay ?? 5}
            onChange={e => setPrefs(p => ({ ...p, maxPerDay: Number(e.target.value || 5) }))}
          />

          <label className="block mt-3 text-sm opacity-80">Home Base (city)</label>
          <input
            className="rounded-xl bg-white/10 border border-white/15 px-3 py-1 w-full"
            placeholder="e.g., New York"
            value={prefs.home ?? ''}
            onChange={e => setPrefs(p => ({ ...p, home: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={save} className="btn">Save</button>
        <button
          onClick={() => { localStorage.removeItem('st.prefs'); location.reload() }}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-1"
        >
          Reset
        </button>
      </div>
    </main>
  )
}