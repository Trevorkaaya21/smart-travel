'use client'

import * as React from 'react'
import { API_BASE } from '@/lib/api'

type Props = {
  tripId: string
  itemId: string
  note: string | null
  email?: string
  onSaved?: (note: string | null) => void
}

export function ItemNote({ tripId, itemId, note, email, onSaved }: Props) {
  const [editing, setEditing] = React.useState(false)
  const [val, setVal] = React.useState(note ?? '')
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const save = async () => {
    if (!email) return alert('Please sign in.')
    try {
      setSaving(true)
      setErr(null)
      const r = await fetch(`${API_BASE}/v1/trips/${tripId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify({ note: val }),
      })
      if (!r.ok) throw new Error('save_failed')
      onSaved?.(val || null)
      setEditing(false)
    } catch {
      setErr('Failed to save note.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="btn"
      >
        {note ? 'Edit note' : 'Add note'}
      </button>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Add a note…"
        className="card"
      />
      <button
        onClick={save}
        disabled={saving}
        className="btn"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        onClick={() => {
          setVal(note ?? '')
          setEditing(false)
          setErr(null)
        }}
        className="card"
      >
        Cancel
      </button>
      {err && <span className="text-sm text-red-400">{err}</span>}
    </div>
  )
}