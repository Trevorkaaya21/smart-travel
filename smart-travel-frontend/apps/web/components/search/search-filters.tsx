/**
 * Advanced Search Filters Component
 * Provides comprehensive filtering for place search results
 */

'use client'

import * as React from 'react'
import { X, SlidersHorizontal, Star, DollarSign, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type FilterState = {
  category: string[]
  rating: number | null
  priceRange: { min: number; max: number } | null
  distance: number | null
  openNow: boolean
  hasPhotos: boolean
  sortBy: 'relevance' | 'rating' | 'distance' | 'popular'
}

const CATEGORIES = [
  'Restaurant',
  'Hotel',
  'Attraction',
  'Bar & Nightlife',
  'Shopping',
  'Museum',
  'Park',
  'Beach',
  'Cafe',
  'Entertainment',
]

const PRICE_RANGES = [
  { label: '$', min: 0, max: 25 },
  { label: '$$', min: 25, max: 50 },
  { label: '$$$', min: 50, max: 100 },
  { label: '$$$$', min: 100, max: 1000 },
]

const DISTANCE_OPTIONS = [
  { label: '1 km', value: 1000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
]

type SearchFiltersProps = {
  filters: FilterState
  onChange: (filters: FilterState) => void
  onReset: () => void
  onApply?: () => void
  resultsCount: number
}

export function SearchFilters({
  filters,
  onChange,
  onReset,
  onApply,
  resultsCount,
}: SearchFiltersProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const activeFiltersCount = React.useMemo(() => {
    let count = 0
    if (filters.category.length > 0) count++
    if (filters.rating !== null) count++
    if (filters.priceRange !== null) count++
    if (filters.distance !== null) count++
    if (filters.openNow) count++
    if (filters.hasPhotos) count++
    return count
  }, [filters])

  const toggleCategory = (category: string) => {
    onChange({
      ...filters,
      category: filters.category.includes(category)
        ? filters.category.filter(c => c !== category)
        : [...filters.category, category],
    })
  }

  return (
    <div className="space-y-4">
      {/* Filter Toggle & Active Count */}
      <div className="flex items-center justify-between gap-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setIsOpen(!isOpen)}
          className="btn btn-ghost gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="rounded-full bg-[rgb(var(--accent))] px-2 py-0.5 text-xs font-semibold text-[rgb(var(--accent-contrast))]">
              {activeFiltersCount}
            </span>
          )}
        </Button>

        <div className="flex items-center gap-4">
          <span className="text-sm text-[rgb(var(--muted))]">
            {resultsCount} places found
          </span>

          {activeFiltersCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={onReset}
              className="btn btn-ghost gap-1.5 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Sort By */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <span className="text-xs font-medium text-[rgb(var(--muted))] whitespace-nowrap">
          Sort by:
        </span>
        {(['relevance', 'rating', 'distance', 'popular'] as const).map((sort) => (
          <button
            key={sort}
            type="button"
            onClick={() => onChange({ ...filters, sortBy: sort })}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 whitespace-nowrap',
              filters.sortBy === sort
                ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-contrast))] shadow-sm'
                : 'bg-[rgb(var(--surface-muted))] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--surface))] dark:text-[rgb(var(--text))]'
            )}
          >
            {sort.charAt(0).toUpperCase() + sort.slice(1)}
          </button>
        ))}
      </div>

      {/* Filter Panel */}
      {isOpen && (
        <div className="content-card space-y-6 animate-fade-in">
          {/* Categories */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[rgb(var(--text))]">Category</h3>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => {
                const isActive = filters.category.includes(category)
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={cn(
                      'rounded-full border px-4 py-2 text-xs font-medium transition-all duration-200',
                      isActive
                        ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                        : 'border-[rgb(var(--border))]/30 bg-[rgb(var(--surface))] text-[rgb(var(--text-secondary))] hover:border-[rgb(var(--border))]/50 dark:text-[rgb(var(--text))]'
                    )}
                  >
                    {category}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[rgb(var(--text))]">Minimum Rating</h3>
            <div className="flex gap-2">
              {[3, 3.5, 4, 4.5, 5].map((rating) => {
                const isActive = filters.rating === rating
                return (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => onChange({ ...filters, rating: isActive ? null : rating })}
                    className={cn(
                      'flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                        : 'border-[rgb(var(--border))]/30 bg-[rgb(var(--surface))] text-[rgb(var(--text-secondary))] hover:border-[rgb(var(--border))]/50 dark:text-[rgb(var(--text))]'
                    )}
                  >
                    <Star className={cn('h-4 w-4', isActive && 'fill-current')} />
                    {rating}+
                  </button>
                )
              })}
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[rgb(var(--text))]">Price Range</h3>
            <div className="flex gap-2">
              {PRICE_RANGES.map((range) => {
                const isActive =
                  filters.priceRange?.min === range.min &&
                  filters.priceRange?.max === range.max
                return (
                  <button
                    key={range.label}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...filters,
                        priceRange: isActive
                          ? null
                          : { min: range.min, max: range.max },
                      })
                    }
                    className={cn(
                      'flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                        : 'border-[rgb(var(--border))]/30 bg-[rgb(var(--surface))] text-[rgb(var(--text-secondary))] hover:border-[rgb(var(--border))]/50 dark:text-[rgb(var(--text))]'
                    )}
                  >
                    {range.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Distance */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[rgb(var(--text))]">Distance</h3>
            <div className="flex gap-2">
              {DISTANCE_OPTIONS.map((option) => {
                const isActive = filters.distance === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...filters,
                        distance: isActive ? null : option.value,
                      })
                    }
                    className={cn(
                      'flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                        : 'border-[rgb(var(--border))]/30 bg-[rgb(var(--surface))] text-[rgb(var(--text-secondary))] hover:border-[rgb(var(--border))]/50 dark:text-[rgb(var(--text))]'
                    )}
                  >
                    <MapPin className="h-4 w-4" />
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quick Filters */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[rgb(var(--text))]">Quick Filters</h3>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.openNow}
                  onChange={(e) =>
                    onChange({ ...filters, openNow: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-[rgb(var(--border))] text-[rgb(var(--accent))]"
                />
                <span className="text-sm text-[rgb(var(--text-secondary))] dark:text-[rgb(var(--text))]">Open now</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasPhotos}
                  onChange={(e) =>
                    onChange({ ...filters, hasPhotos: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-[rgb(var(--border))] text-[rgb(var(--accent))]"
                />
                <span className="text-sm text-[rgb(var(--text-secondary))] dark:text-[rgb(var(--text))]">Has photos</span>
              </label>
            </div>
          </div>
          
          {/* Apply Filters Button */}
          {onApply && activeFiltersCount > 0 && (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                onClick={onApply}
                className="btn btn-primary"
              >
                Apply Filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Default filter state
export const DEFAULT_FILTERS: FilterState = {
  category: [],
  rating: null,
  priceRange: null,
  distance: null,
  openNow: false,
  hasPhotos: false,
  sortBy: 'relevance',
}
