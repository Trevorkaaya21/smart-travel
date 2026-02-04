'use client'

import * as React from 'react'
import { api, BACKEND_UNREACHABLE_MESSAGE } from '@/lib/api'

export function BackendHealthBanner() {
  const [unreachable, setUnreachable] = React.useState(false)
  const [dismissed, setDismissed] = React.useState(false)
  const checked = React.useRef(false)

  React.useEffect(() => {
    if (checked.current || dismissed) return
    checked.current = true
    fetch(api('/health'), { method: 'GET', cache: 'no-store' })
      .then((r) => {
        if (!r.ok) setUnreachable(true)
      })
      .catch(() => setUnreachable(true))
  }, [dismissed])

  if (!unreachable || dismissed) return null

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-[rgb(var(--text))]"
      role="alert"
    >
      <p className="min-w-0 flex-1">
        <span className="font-medium">Backend unavailable.</span>{' '}
        {BACKEND_UNREACHABLE_MESSAGE}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[rgb(var(--muted))] transition hover:bg-black/10 dark:hover:bg-white/10"
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  )
}
