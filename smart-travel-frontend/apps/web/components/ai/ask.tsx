'use client'
import * as React from 'react'
import { API_BASE } from '@/lib/configure'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export default function AskAI() {
  const [q, setQ] = React.useState('Plan a 1-day NYC itinerary focused on museums and good coffee.')
  const [ans, setAns] = React.useState<string>('')

  const run = async () => {
    setAns('Thinking…')
    const r = await fetch(`${API_BASE}/v1/ai/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: q })
    })
    const data = await r.json()
    setAns(data.text ?? 'Error')
  }

  return (
    <div className="space-y-3 rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/15 dark:bg-white/5">
      <Textarea value={q} onChange={(e) => setQ(e.target.value)} />
      <Button onClick={run} className="btn">Ask AI</Button>
      {ans && (
        <div className="rounded-xl border border-black/10 bg-white/70 p-3 text-sm leading-6 dark:border-white/15 dark:bg-white/5 whitespace-pre-wrap">
          {ans}
        </div>
      )}
    </div>
  )
}