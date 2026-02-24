'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Crown, Check, Sparkles, Zap, Globe, Shield, Infinity as InfinityIcon } from 'lucide-react'
import { useState } from 'react'

interface PremiumModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FEATURES = [
  { icon: Sparkles, text: 'Unlimited AI itinerary generation' },
  { icon: Zap, text: 'Advanced AI travel assistant' },
  { icon: Globe, text: 'Weather forecasts & currency converter' },
  { icon: Shield, text: 'Budget tracker & expense management' },
  { icon: InfinityIcon, text: 'Unlimited trips & favorites' },
  { icon: Crown, text: 'Priority support & early access' },
]

const PLANS = [
  {
    name: 'Monthly',
    price: '$9.99',
    period: '/month',
    popular: false,
  },
  {
    name: 'Yearly',
    price: '$79.99',
    period: '/year',
    originalPrice: '$119.88',
    popular: true,
    savings: 'Save 33%',
  },
]

export function PremiumModal({ open, onOpenChange }: PremiumModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly')
  const [loading, setLoading] = useState(false)

  const handleSubscribe = async () => {
    setLoading(true)
    // TODO: Integrate with Stripe
    // For now, just show a message
    setTimeout(() => {
      setLoading(false)
      alert('Payment integration coming soon! This would redirect to Stripe checkout.')
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full animate-pulse"
                style={{
                  background: 'radial-gradient(circle, rgba(var(--accent) / .4), transparent)',
                }}
              />
              <div className="ui-liquid-icon relative z-10">
                <Crown className="h-8 w-8 text-[rgb(var(--accent))]" />
              </div>
            </div>
          </div>
          <DialogTitle className="text-3xl font-bold text-center bg-gradient-to-r from-[rgb(var(--accent))] via-[rgb(var(--accent-secondary))] to-[rgb(var(--accent-tertiary))] bg-clip-text text-transparent">
            Upgrade to Premium
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Unlock the full power of Smart Travel with premium features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Features List */}
          <div className="grid gap-3">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: 'linear-gradient(165deg, rgba(var(--surface-muted) / .5), rgba(var(--surface-muted) / .3))',
                  }}
                >
                  <div className="ui-liquid-icon">
                    <Icon className="h-4 w-4 text-[rgb(var(--accent))]" />
                  </div>
                  <span className="text-sm font-medium text-[rgb(var(--text))]">{feature.text}</span>
                  <Check className="h-4 w-4 text-[rgb(var(--success))] ml-auto" />
                </div>
              )
            })}
          </div>

          {/* Pricing Plans */}
          <div className="grid md:grid-cols-2 gap-4">
            {PLANS.map((plan) => (
              <button
                key={plan.name}
                onClick={() => setSelectedPlan(plan.name.toLowerCase() as 'monthly' | 'yearly')}
                className={`
                  relative rounded-2xl border p-5 text-left transition-all duration-200
                  ${selectedPlan === plan.name.toLowerCase() ? 'border-[rgb(var(--accent))] scale-105' : 'border-[rgb(var(--border))]/50'}
                `}
                style={{
                  background: selectedPlan === plan.name.toLowerCase()
                    ? 'linear-gradient(135deg, rgba(var(--accent) / .1), rgba(var(--accent-secondary) / .05))'
                    : 'linear-gradient(165deg, rgba(var(--surface) / .9), rgba(var(--surface-muted) / .7))',
                }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge-pro text-[9px] px-2 py-0.5">Most Popular</span>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-[rgb(var(--text))]">{plan.price}</span>
                    <span className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
                      {plan.period}
                    </span>
                  </div>
                  {plan.originalPrice && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm line-through text-[color-mix(in_oklab,rgb(var(--text))_50%,rgb(var(--muted))_50%)]">
                        {plan.originalPrice}
                      </span>
                      <span className="text-xs font-semibold text-[rgb(var(--success))]">{plan.savings}</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Subscribe Button */}
          <Button
            onClick={handleSubscribe}
            disabled={loading}
            className="btn btn-primary w-full py-4 text-base font-semibold gap-2"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Crown className="h-5 w-5" />
                Subscribe to Premium
              </>
            )}
          </Button>

          <p className="text-xs text-center text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
            Cancel anytime. Secure payment powered by Stripe.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
