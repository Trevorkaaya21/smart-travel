'use client'

import { API_BASE } from '@/lib/api'

export function ExportMenu({ tripId }: { tripId: string }) {
  const csvUrl = `${API_BASE}/v1/trips/${tripId}/export.csv`
  const icsUrl = `${API_BASE}/v1/trips/${tripId}/export.ics`

  return (
    <div className="flex items-center gap-2">
      <a href={csvUrl} className="btn">
        Export CSV
      </a>
      <a href={icsUrl} className="btn">
        Export ICS
      </a>
    </div>
  )
}