'use client'

import { useState } from 'react'
import { WeatherWidget } from './weather-widget'
import { CurrencyConverter } from './currency-converter'
import { PackingList } from './packing-list'
import { BudgetTracker } from './budget-tracker'
import { CloudRain, DollarSign, Luggage, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'

interface TripToolsProps {
  tripId: string
  destination?: string
  startDate?: string
  days?: number
  budget?: number
}

export function TripTools({ tripId, destination, startDate, days = 3, budget }: TripToolsProps) {
  const [expanded, setExpanded] = useState({
    weather: true,
    currency: false,
    packing: true,
    budget: false,
  })

  const toggleSection = (section: keyof typeof expanded) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[rgb(var(--text))]">Travel Tools</h2>
        <span className="text-xs text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
          Premium features
        </span>
      </div>

      {/* Weather Widget */}
      <div className="content-card p-0 overflow-hidden">
        <button
          onClick={() => toggleSection('weather')}
          className="w-full flex items-center justify-between p-4 hover:bg-[rgb(var(--surface-muted))]/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <CloudRain className="h-5 w-5 text-[rgb(var(--accent-tertiary))]" />
            <span className="font-semibold text-[rgb(var(--text))]">Weather Forecast</span>
          </div>
          {expanded.weather ? (
            <ChevronUp className="h-4 w-4 text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]" />
          )}
        </button>
        {expanded.weather && (
          <div className="px-4 pb-4">
            <WeatherWidget city={destination || 'Unknown'} date={startDate} />
          </div>
        )}
      </div>

      {/* Currency Converter */}
      <div className="content-card p-0 overflow-hidden">
        <button
          onClick={() => toggleSection('currency')}
          className="w-full flex items-center justify-between p-4 hover:bg-[rgb(var(--surface-muted))]/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-[rgb(var(--accent))]" />
            <span className="font-semibold text-[rgb(var(--text))]">Currency Converter</span>
          </div>
          {expanded.currency ? (
            <ChevronUp className="h-4 w-4 text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]" />
          )}
        </button>
        {expanded.currency && (
          <div className="px-4 pb-4">
            <CurrencyConverter />
          </div>
        )}
      </div>

      {/* Packing List */}
      <div className="content-card p-0 overflow-hidden">
        <button
          onClick={() => toggleSection('packing')}
          className="w-full flex items-center justify-between p-4 hover:bg-[rgb(var(--surface-muted))]/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Luggage className="h-5 w-5 text-[rgb(var(--accent-secondary))]" />
            <span className="font-semibold text-[rgb(var(--text))]">Packing List</span>
          </div>
          {expanded.packing ? (
            <ChevronUp className="h-4 w-4 text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]" />
          )}
        </button>
        {expanded.packing && (
          <div className="px-4 pb-4">
            <PackingList tripId={tripId} days={days} />
          </div>
        )}
      </div>

      {/* Budget Tracker */}
      <div className="content-card p-0 overflow-hidden">
        <button
          onClick={() => toggleSection('budget')}
          className="w-full flex items-center justify-between p-4 hover:bg-[rgb(var(--surface-muted))]/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-[rgb(var(--success))]" />
            <span className="font-semibold text-[rgb(var(--text))]">Budget Tracker</span>
          </div>
          {expanded.budget ? (
            <ChevronUp className="h-4 w-4 text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]" />
          )}
        </button>
        {expanded.budget && (
          <div className="px-4 pb-4">
            <BudgetTracker tripId={tripId} budget={budget} />
          </div>
        )}
      </div>
    </div>
  )
}
