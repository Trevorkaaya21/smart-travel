'use client'

import { PremiumModal } from '@/components/premium/premium-modal'
import { useState } from 'react'
import { Crown, Sparkles, Zap, Globe, Shield, Infinity as InfinityIcon, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Unlimited AI Itineraries',
    description: 'Generate as many AI-powered itineraries as you want. No limits, no restrictions.',
    color: 'rgb(var(--accent))',
  },
  {
    icon: Zap,
    title: 'AI Travel Assistant',
    description: 'Get instant answers to travel questions, recommendations, and itinerary optimization.',
    color: 'rgb(var(--accent-secondary))',
  },
  {
    icon: Globe,
    title: 'Weather & Currency',
    description: 'Real-time weather forecasts and currency conversion for your destinations.',
    color: 'rgb(var(--accent-tertiary))',
  },
  {
    icon: Shield,
    title: 'Budget Tracker',
    description: 'Track expenses, manage your travel budget, and never overspend again.',
    color: 'rgb(var(--success))',
  },
  {
    icon: InfinityIcon,
    title: 'Unlimited Everything',
    description: 'Unlimited trips, favorites, and storage. Plan as many adventures as you want.',
    color: 'rgb(var(--accent))',
  },
  {
    icon: Crown,
    title: 'Priority Support',
    description: 'Get priority customer support and early access to new features.',
    color: 'rgb(var(--accent-secondary))',
  },
]

export default function PremiumPage() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="flex h-full flex-col gap-8 animate-fade-in">
      <header className="content-header">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
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
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-[rgb(var(--accent))] via-[rgb(var(--accent-secondary))] to-[rgb(var(--accent-tertiary))] bg-clip-text text-transparent">
                Smart Travel Premium
              </h1>
              <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)] mt-2">
                Unlock the full power of AI-powered travel planning
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Features Grid */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-[rgb(var(--text))]">Premium Features</h2>
          <div className="grid gap-4">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon
              return (
                <div
                  key={i}
                  className="content-card p-5 hover:scale-[1.02] transition-transform duration-200"
                >
                  <div className="flex items-start gap-4">
                    <div className="ui-liquid-icon">
                      <Icon className="h-6 w-6" style={{ color: feature.color }} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="font-semibold text-[rgb(var(--text))]">{feature.title}</h3>
                      <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
                        {feature.description}
                      </p>
                    </div>
                    <Check className="h-5 w-5 text-[rgb(var(--success))] flex-shrink-0" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pricing Card */}
        <div className="lg:sticky lg:top-10 lg:h-fit">
          <div className="content-card p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-[rgb(var(--text))]">Choose Your Plan</h2>
              <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
                Cancel anytime. No hidden fees.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-2xl border-2 border-[rgb(var(--accent))] bg-gradient-to-br from-[rgb(var(--accent))]/10 to-[rgb(var(--accent-secondary))]/5">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold text-[rgb(var(--text))]">$79.99</span>
                  <span className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
                    /year
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm line-through text-[color-mix(in_oklab,rgb(var(--text))_50%,rgb(var(--muted))_50%)]">
                    $119.88
                  </span>
                  <span className="badge-pro text-xs">Save 33%</span>
                </div>
                <p className="text-xs text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)] mb-4">
                  Most popular choice
                </p>
                <Button
                  onClick={() => setShowModal(true)}
                  className="btn btn-primary w-full py-4 text-base font-semibold gap-2"
                >
                  <Crown className="h-5 w-5" />
                  Get Premium Yearly
                </Button>
              </div>

              <div className="p-5 rounded-2xl border border-[rgb(var(--border))]/50">
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-bold text-[rgb(var(--text))]">$9.99</span>
                  <span className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
                    /month
                  </span>
                </div>
                <Button
                  onClick={() => setShowModal(true)}
                  className="btn btn-ghost w-full py-3 text-sm font-semibold"
                >
                  Get Premium Monthly
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-[rgb(var(--border))]/30">
              <ul className="space-y-2 text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[rgb(var(--success))]" />
                  All premium features included
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[rgb(var(--success))]" />
                  Cancel anytime
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[rgb(var(--success))]" />
                  Secure payment via Stripe
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[rgb(var(--success))]" />
                  Priority support
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <PremiumModal open={showModal} onOpenChange={setShowModal} />
    </div>
  )
}
