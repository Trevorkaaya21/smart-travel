/**
 * Trip Selector Modal
 * Allows users to choose which trip to add a place to, or create a new trip
 */

'use client'

import * as React from 'react'
import { X, Plus, Calendar, MapPin, Search, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Trip = {
  id: string
  name: string
  start_date?: string | null
  end_date?: string | null
  places_count?: number
  days_count?: number
  image_url?: string | null
}

type TripSelectorProps = {
  isOpen: boolean
  onClose: () => void
  onSelectTrip: (tripId: string) => void
  onCreateNew: () => void
  trips: Trip[]
  placeName: string
  currentTripId?: string
  isLoading?: boolean
}

export function TripSelector({
  isOpen,
  onClose,
  onSelectTrip,
  onCreateNew,
  trips,
  placeName,
  currentTripId,
  isLoading = false,
}: TripSelectorProps) {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(currentTripId || null)

  const filteredTrips = React.useMemo(() => {
    if (!searchQuery.trim()) return trips
    const query = searchQuery.toLowerCase()
    return trips.filter(trip => 
      trip.name.toLowerCase().includes(query)
    )
  }, [trips, searchQuery])

  const handleSelect = (tripId: string) => {
    setSelectedId(tripId)
  }

  const handleConfirm = () => {
    if (selectedId) {
      onSelectTrip(selectedId)
      onClose()
    } else {
      toast.error('Please select a trip')
    }
  }

  const handleCreateAndAdd = () => {
    onCreateNew()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-3xl border"
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'rgba(var(--border) / 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b" style={{ 
          background: 'var(--glass-bg)',
          borderColor: 'rgba(var(--border) / 0.2)',
          backdropFilter: 'blur(12px)'
        }}>
          <div className="flex items-center justify-between gap-4 p-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-[rgb(var(--text))]">
                Add to Trip
              </h2>
              <p className="text-sm text-[rgb(var(--muted))]">
                Choose where to save <span className="font-medium text-[rgb(var(--text))]">{placeName}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 transition-colors hover:bg-[rgb(var(--surface-muted))]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your trips..."
                className="input-surface pl-10"
                autoFocus
              />
            </div>
          </div>
        </div>

        {/* Trip List */}
        <div className="overflow-y-auto p-6 space-y-3" style={{ maxHeight: 'calc(80vh - 280px)' }}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-12 w-12 mb-4 border-4 border-[rgb(var(--accent))]/20 border-t-[rgb(var(--accent))] rounded-full animate-spin" />
              <p className="text-sm text-[rgb(var(--muted))]">Loading your trips...</p>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="h-12 w-12 mb-4 text-[rgb(var(--muted))]" />
              <p className="text-sm font-medium text-[rgb(var(--text))] mb-2">
                {searchQuery ? 'No trips match your search' : 'No trips yet'}
              </p>
              {!searchQuery && (
                <p className="text-xs text-[rgb(var(--muted))] max-w-xs mb-4">
                  Create your first trip below to start organizing your travel plans
                </p>
              )}
            </div>
          ) : (
            filteredTrips.map((trip) => {
              const isSelected = selectedId === trip.id
              const dateRange = trip.start_date && trip.end_date
                ? `${formatDate(trip.start_date)} - ${formatDate(trip.end_date)}`
                : 'Dates not set'

              return (
                <button
                  key={trip.id}
                  onClick={() => handleSelect(trip.id)}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition-all duration-200',
                    isSelected
                      ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 shadow-md'
                      : 'border-[rgb(var(--border))]/30 hover:border-[rgb(var(--border))]/50 hover:bg-[rgb(var(--surface-muted))]/50'
                  )}
                >
                  <div className="flex items-start gap-4">
                    {/* Trip Image/Icon */}
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[rgb(var(--surface-muted))]">
                      {trip.image_url ? (
                        <img
                          src={trip.image_url}
                          alt={trip.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <MapPin className="h-6 w-6 text-[rgb(var(--muted))]" />
                        </div>
                      )}
                    </div>

                    {/* Trip Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-[rgb(var(--text))] line-clamp-1">
                          {trip.name}
                        </h3>
                        {isSelected && (
                          <div className="shrink-0 rounded-full bg-[rgb(var(--accent))] p-1">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[rgb(var(--muted))]">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {dateRange}
                        </span>
                        {trip.places_count !== undefined && (
                          <span>{trip.places_count} places</span>
                        )}
                        {trip.days_count !== undefined && (
                          <span>{trip.days_count} days</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 border-t p-6 space-y-3" style={{ 
          background: 'var(--glass-bg)',
          borderColor: 'rgba(var(--border) / 0.2)',
          backdropFilter: 'blur(12px)'
        }}>
          {/* Create New Trip Button */}
          <button
            onClick={handleCreateAndAdd}
            className="w-full rounded-2xl border border-dashed border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5 p-4 text-left transition-all duration-200 hover:bg-[rgb(var(--accent))]/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--accent))]/15">
                <Plus className="h-5 w-5 text-[rgb(var(--accent))]" />
              </div>
              <div>
                <div className="font-semibold text-[rgb(var(--accent))]">
                  Create New Trip
                </div>
                <div className="text-xs text-[rgb(var(--muted))]">
                  Start a fresh itinerary with this place
                </div>
              </div>
            </div>
          </button>

          {/* Confirm Button */}
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="ghost"
              className="btn btn-ghost flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedId}
              className="btn btn-primary flex-1"
            >
              Add to Selected Trip
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  } catch {
    return dateString
  }
}

/**
 * Hook for managing trip selector state
 */
export function useTripSelector() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [pendingPlace, setPendingPlace] = React.useState<any>(null)

  const open = (place: any) => {
    setPendingPlace(place)
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
    setPendingPlace(null)
  }

  return {
    isOpen,
    pendingPlace,
    open,
    close,
  }
}
