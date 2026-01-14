'use client'

import { useSession } from 'next-auth/react'
import { useGuest } from '@/lib/useGuest'
import { PremiumBadge } from './premium-badge'
import { Button } from '@/components/ui/button'
import { Crown, Lock } from 'lucide-react'
import { useState } from 'react'
import { PremiumModal } from './premium-modal'

interface PremiumGateProps {
  children: React.ReactNode
  feature: string
  fallback?: React.ReactNode
}

export function PremiumGate({ children, feature, fallback }: PremiumGateProps) {
  const { data: session } = useSession()
  const { isGuest } = useGuest()
  const [showModal, setShowModal] = useState(false)
  
  // TODO: Replace with actual premium check from backend
  const isPremium = false // Check user's premium status
  
  if (isGuest || !session || !isPremium) {
    return (
      <>
        {fallback || (
          <div className="content-card flex flex-col items-center gap-4 p-8 text-center">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full animate-pulse"
                style={{
                  background: 'radial-gradient(circle, rgba(var(--accent) / .3), transparent)',
                }}
              />
              <div className="ui-liquid-icon relative z-10">
                <Lock className="h-8 w-8 text-[rgb(var(--accent))]" />
              </div>
            </div>
            <div className="space-y-2">
              <PremiumBadge size="lg" />
              <h3 className="text-lg font-bold text-[rgb(var(--text))]">Premium Feature</h3>
              <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
                Unlock {feature} and more with Smart Travel Premium
              </p>
            </div>
            <Button
              onClick={() => setShowModal(true)}
              className="btn btn-primary gap-2"
            >
              <Crown className="h-4 w-4" />
              Upgrade to Premium
            </Button>
          </div>
        )}
        <PremiumModal open={showModal} onOpenChange={setShowModal} />
      </>
    )
  }

  return <>{children}</>
}
