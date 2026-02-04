'use client'
import * as React from 'react'
import { API_BASE } from '@/lib/api'
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
    <div className="glass space-y-3 p-4">
      <Textarea value={q} onChange={(e) => setQ(e.target.value)} />
      <Button onClick={run} className="btn">Ask AI</Button>
      {ans && (
        <div className="content-subtle p-3 text-sm leading-6 whitespace-pre-wrap text-[rgb(var(--text))]">
          {ans}
        </div>
      )}
    </div>
  )
}