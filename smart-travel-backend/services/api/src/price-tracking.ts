/**
 * Price Tracking Service
 * Monitor and alert users about price changes
 */

import { supa } from './supabase.js'

type PriceAlert = {
  id: string
  user_email: string
  place_id: string
  place_name: string
  target_price: number
  current_price: number
  alert_type: 'below' | 'above' | 'change'
  is_active: boolean
  created_at: string
  last_checked: string
}

type PriceHistory = {
  place_id: string
  price: number
  currency: string
  date: string
  source: string
}

/**
 * Create a price alert for a place
 */
export async function createPriceAlert(
  userEmail: string,
  placeId: string,
  placeName: string,
  targetPrice: number,
  alertType: 'below' | 'above' | 'change' = 'below'
) {
  const { data, error } = await supa
    .from('price_alerts')
    .insert({
      user_email: userEmail,
      place_id: placeId,
      place_name: placeName,
      target_price: targetPrice,
      current_price: 0, // Will be updated by background job
      alert_type: alertType,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw error
  return data as PriceAlert
}

/**
 * Get all active price alerts for a user
 */
export async function getUserPriceAlerts(userEmail: string) {
  const { data, error } = await supa
    .from('price_alerts')
    .select('*')
    .eq('user_email', userEmail)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as PriceAlert[]
}

/**
 * Delete a price alert
 */
export async function deletePriceAlert(alertId: string, userEmail: string) {
  const { error } = await supa
    .from('price_alerts')
    .delete()
    .eq('id', alertId)
    .eq('user_email', userEmail)

  if (error) throw error
}

/**
 * Get price history for a place
 */
export async function getPriceHistory(
  placeId: string,
  days: number = 30
): Promise<PriceHistory[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supa
    .from('price_history')
    .select('*')
    .eq('place_id', placeId)
    .gte('date', since.toISOString())
    .order('date', { ascending: true })

  if (error) throw error
  return data as PriceHistory[]
}

/**
 * Calculate price statistics
 */
export function calculatePriceStats(history: PriceHistory[]) {
  if (history.length === 0) {
    return {
      current: 0,
      average: 0,
      min: 0,
      max: 0,
      trend: 'stable' as 'up' | 'down' | 'stable',
      changePercent: 0,
    }
  }

  const prices = history.map(h => h.price)
  const current = prices[prices.length - 1]
  const average = prices.reduce((sum, p) => sum + p, 0) / prices.length
  const min = Math.min(...prices)
  const max = Math.max(...prices)

  // Calculate trend (compare recent vs older prices)
  const halfPoint = Math.floor(prices.length / 2)
  const recentAvg = prices.slice(halfPoint).reduce((sum, p) => sum + p, 0) / (prices.length - halfPoint)
  const olderAvg = prices.slice(0, halfPoint).reduce((sum, p) => sum + p, 0) / halfPoint

  const trend = recentAvg > olderAvg * 1.05 ? 'up' : recentAvg < olderAvg * 0.95 ? 'down' : 'stable'
  const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100

  return {
    current,
    average: Math.round(average),
    min,
    max,
    trend,
    changePercent: Math.round(changePercent * 10) / 10,
  }
}

/**
 * Get best time to book based on historical data
 */
export function getBestTimeToBook(history: PriceHistory[]) {
  if (history.length < 7) {
    return { recommendation: 'Not enough data', confidence: 0 }
  }

  const stats = calculatePriceStats(history)
  const current = stats.current
  const average = stats.average

  if (current <= stats.min * 1.1) {
    return {
      recommendation: 'Book now! Price is near historic low',
      confidence: 90,
    }
  }

  if (current <= average * 0.9) {
    return {
      recommendation: 'Good time to book - below average price',
      confidence: 75,
    }
  }

  if (current >= stats.max * 0.9) {
    return {
      recommendation: 'Wait if possible - price is near historic high',
      confidence: 80,
    }
  }

  if (stats.trend === 'up') {
    return {
      recommendation: 'Consider booking soon - prices trending up',
      confidence: 60,
    }
  }

  if (stats.trend === 'down') {
    return {
      recommendation: 'You might wait - prices trending down',
      confidence: 65,
    }
  }

  return {
    recommendation: 'Fair price - book when ready',
    confidence: 50,
  }
}
