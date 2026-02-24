/**
 * Quick Trip Creation Modal
 * Fast flow for creating a new trip when adding a place
 */

'use client'

import * as React from 'react'
import { X, MapPin, Calendar, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type QuickTripCreatorProps = {
  isOpen: boolean
  onClose: () => void
  onCreate: (tripData: { name: string; start_date?: string; end_date?: string }) => Promise<void>
  placeName: string
  suggestedName?: string
}

export function QuickTripCreator({
  isOpen,
  onClose,
  onCreate,
  placeName,
  suggestedName,
}: QuickTripCreatorProps) {
  const [tripName, setTripName] = React.useState(suggestedName || `Trip to ${placeName}`)
  const [startDate, setStartDate] = React.useState('')
  const [duration, setDuration] = React.useState(3)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (isOpen && suggestedName) {
      setTripName(suggestedName)
    }
  }, [isOpen, suggestedName])

  const endDate = React.useMemo(() => {
    if (!startDate) return null
    try {
      const start = new Date(startDate + 'T12:00:00')
      const end = new Date(start)
      end.setDate(end.getDate() + Math.max(0, duration - 1))
      return end.toISOString().split('T')[0]
    } catch {
      return null
    }
  }, [startDate, duration])

  const handleCreate = async () => {
    if (!tripName.trim()) return

    setLoading(true)
    try {
      await onCreate({
        name: tripName.trim(),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      onClose()
      // Reset form
      setTripName('')
      setStartDate('')
      setDuration(3)
    } catch (error) {
      console.error('Failed to create trip:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border"
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'rgba(var(--border) / 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b p-6" style={{ borderColor: 'rgba(var(--border) / 0.2)' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-[rgb(var(--text))]">
                Create New Trip
              </h2>
              <p className="text-sm text-[rgb(var(--muted))]">
                Quick setup to get started with <span className="font-medium text-[rgb(var(--text))]">{placeName}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 transition-colors hover:bg-[rgb(var(--surface-muted))]"
              disabled={loading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Trip Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[rgb(var(--text))]">
              Trip Name *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" />
              <Input
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="e.g., Weekend in Paris"
                className="input-surface pl-10"
                maxLength={100}
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          {/* Optional: Dates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[rgb(var(--text))]">
                Trip Dates (Optional)
              </label>
              <span className="text-xs text-[rgb(var(--muted))]">
                You can add these later
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs text-[rgb(var(--muted))]">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-surface"
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[rgb(var(--muted))]">Duration (days)</label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={duration}
                  onChange={(e) => setDuration(Math.max(1, Math.min(30, Number(e.target.value))))}
                  className="input-surface"
                  disabled={loading}
                />
              </div>
            </div>

            {startDate && endDate && (
              <div className="rounded-xl bg-[rgb(var(--accent))]/10 border border-[rgb(var(--accent))]/30 px-3 py-2 text-xs">
                <Calendar className="inline h-3 w-3 mr-1.5 text-[rgb(var(--accent))]" />
                <span className="text-[rgb(var(--accent))] font-medium">
                  {formatDateRange(startDate, endDate)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="border-t p-6 flex gap-3" style={{ borderColor: 'rgba(var(--border) / 0.2)' }}>
          <Button
            onClick={onClose}
            variant="ghost"
            className="btn btn-ghost flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!tripName.trim() || loading}
            className="btn btn-primary flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              'Create & Add Place'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function formatDateRange(start: string, end: string): string {
  try {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const formatter = new Intl.DateTimeFormat(undefined, { 
      month: 'short', 
      day: 'numeric' 
    })
    return `${formatter.format(startDate)} - ${formatter.format(endDate)}`
  } catch {
    return `${start} - ${end}`
  }
}
