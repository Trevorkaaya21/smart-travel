'use client'

import { ArrowLeftRight, DollarSign } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { PremiumGate } from '@/components/premium/premium-gate'

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
]

interface CurrencyConverterProps {
  defaultFrom?: string
  defaultTo?: string
}

export function CurrencyConverter({ defaultFrom = 'USD', defaultTo = 'EUR' }: CurrencyConverterProps) {
  const [amount, setAmount] = useState('100')
  const [fromCurrency, setFromCurrency] = useState(defaultFrom)
  const [toCurrency, setToCurrency] = useState(defaultTo)
  const [convertedAmount, setConvertedAmount] = useState<string>('')
  const [rate, setRate] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    convertCurrency()
  }, [amount, fromCurrency, toCurrency])

  const convertCurrency = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setConvertedAmount('')
      return
    }

    setLoading(true)
    // TODO: Integrate with currency API (ExchangeRate-API, Fixer.io, etc.)
    // For now, use mock rates
    setTimeout(() => {
      const mockRates: Record<string, Record<string, number>> = {
        USD: { EUR: 0.85, GBP: 0.73, JPY: 110, CAD: 1.25, AUD: 1.35 },
        EUR: { USD: 1.18, GBP: 0.86, JPY: 129, CAD: 1.47, AUD: 1.59 },
      }
      const exchangeRate = mockRates[fromCurrency]?.[toCurrency] || 0.85
      setRate(exchangeRate)
      setConvertedAmount((parseFloat(amount) * exchangeRate).toFixed(2))
      setLoading(false)
    }, 300)
  }

  const fromCurrencyData = CURRENCIES.find(c => c.code === fromCurrency)
  const toCurrencyData = CURRENCIES.find(c => c.code === toCurrency)

  return (
    <PremiumGate feature="Currency converter">
      <div className="content-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-[rgb(var(--accent))]" />
          <h3 className="text-sm font-semibold text-[rgb(var(--text))]">Currency Converter</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
              Amount
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-[rgb(var(--text))]">{fromCurrencyData?.symbol}</span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-surface flex-1"
                placeholder="0.00"
              />
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="input-surface w-24 text-sm"
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => {
                setFromCurrency(toCurrency)
                setToCurrency(fromCurrency)
              }}
              className="ui-liquid-icon"
            >
              <ArrowLeftRight className="h-4 w-4 text-[rgb(var(--accent))]" />
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
              Converted Amount
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-[rgb(var(--text))]">{toCurrencyData?.symbol}</span>
              <Input
                value={loading ? '...' : convertedAmount}
                readOnly
                className="input-surface flex-1 bg-[rgb(var(--surface-muted))]/50"
                placeholder="0.00"
              />
              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="input-surface w-24 text-sm"
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {rate > 0 && (
            <div className="pt-3 border-t border-[rgb(var(--border))]/30">
              <p className="text-xs text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
                1 {fromCurrency} = {rate.toFixed(4)} {toCurrency}
              </p>
            </div>
          )}
        </div>
      </div>
    </PremiumGate>
  )
}
