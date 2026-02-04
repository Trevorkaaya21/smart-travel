'use client'

import * as React from 'react'
import { API_BASE } from '@/lib/api'

type Props = {
  tripId: string
  initialName: string
  email?: string
  onRenamed?: (name: string) => void
}

export function RenameTrip({ tripId, initialName, email, onRenamed }: Props) {
  const [editing, setEditing] = React.useState(false)
  const [name, setName] = React.useState(initialName)
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const save = async () => {
    if (!email) return alert('Please sign in.')
    if (!name.trim()) return
    try {
      setSaving(true)
      setErr(null)
      const r = await fetch(`${API_BASE}/v1/trips/${tripId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': email,
        },
        body: JSON.stringify({ name }),
      })
      if (!r.ok) throw new Error('rename_failed')
      onRenamed?.(name)
      setEditing(false)
    } catch {
      setErr('Failed to rename.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="btn"
        aria-label="Rename trip"
      >
        Rename
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="card"
        placeholder="Trip name"
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
          setName(initialName)
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