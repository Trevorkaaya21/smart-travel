'use client'

import { Cloud, Sun, CloudRain, Wind, Droplets, Thermometer } from 'lucide-react'
import { useEffect, useState } from 'react'
interface WeatherData {
  temp: number
  condition: string
  humidity: number
  windSpeed: number
  icon: string
}

interface WeatherWidgetProps {
  city: string
  date?: string
}

export function WeatherWidget({ city, date }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Integrate with weather API (OpenWeatherMap, WeatherAPI, etc.)
    // For now, show mock data
    setTimeout(() => {
      setWeather({
        temp: 22,
        condition: 'Partly Cloudy',
        humidity: 65,
        windSpeed: 12,
        icon: 'partly-cloudy',
      })
      setLoading(false)
    }, 500)
  }, [city, date])

  if (loading) {
    return (
      <div className="content-card p-4 animate-pulse">
        <div className="h-20 bg-[rgb(var(--surface-muted))]/50 rounded-xl" />
      </div>
    )
  }

  const getWeatherIcon = (icon: string) => {
    switch (icon) {
      case 'sunny':
        return <Sun className="h-8 w-8 text-yellow-500" />
      case 'rainy':
        return <CloudRain className="h-8 w-8 text-blue-500" />
      case 'cloudy':
        return <Cloud className="h-8 w-8 text-gray-400" />
      default:
        return <Sun className="h-8 w-8 text-yellow-500" />
    }
  }

  return (
    <div className="content-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)] mb-1">
              Weather Forecast
            </h3>
            <p className="text-lg font-bold text-[rgb(var(--text))]">{city}</p>
            {date && <p className="text-xs text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">{date}</p>}
          </div>
          {getWeatherIcon(weather?.icon || 'sunny')}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-[rgb(var(--accent))]" />
            <span className="text-2xl font-bold text-[rgb(var(--text))]">{weather?.temp}°C</span>
            <span className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
              {weather?.condition}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[rgb(var(--border))]/30">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-[rgb(var(--accent-tertiary))]" />
              <span className="text-xs text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
                Humidity: {weather?.humidity}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-[rgb(var(--accent-secondary))]" />
              <span className="text-xs text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
                Wind: {weather?.windSpeed} km/h
              </span>
            </div>
          </div>
        </div>
      </div>
  )
}
