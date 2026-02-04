'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { API_BASE } from '@/lib/api'

type Props = {
  tripId: string
  initialPublic: boolean
  initialShareId: string | null
}

export function ShareButton({ tripId, initialPublic, initialShareId }: Props) {
  const { data: session } = useSession()
  const email = (session?.user as any)?.email as string | undefined

  const [isPublic, setIsPublic] = React.useState(initialPublic)
  const [shareId, setShareId] = React.useState<string | null>(initialShareId)

  React.useEffect(() => setIsPublic(initialPublic), [initialPublic])
  React.useEffect(() => setShareId(initialShareId), [initialShareId])

  const shareUrl = React.useMemo(
    () => (isPublic && shareId ? `${window.location.origin}/share/${shareId}` : null),
    [isPublic, shareId]
  )

  const toggle = async () => {
    if (!email) {
      toast('Please sign in')
      return
    }
    const prevPublic = isPublic
    const prevShare = shareId
    const desired = !isPublic

    try {
      setIsPublic(desired)
      const r = await fetch(`${API_BASE}/v1/trips/${tripId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify({ make_public: desired }),
      })
      if (!r.ok) throw new Error('share_toggle_failed')
      const data = (await r.json()) as { is_public: boolean; share_id: string | null }
      setIsPublic(data.is_public)
      setShareId(data.share_id)
      toast.success(data.is_public ? 'Trip is now public' : 'Trip is now private')
    } catch {
      setIsPublic(prevPublic)
      setShareId(prevShare)
      toast.error('Could not update sharing')
    }
  }

  const copy = async () => {
    if (!shareUrl) {
      toast('Make trip public first')
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Share link copied', { description: shareUrl })
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        className="btn"
        title={isPublic ? 'Make Private' : 'Make Public'}
      >
        {isPublic ? 'Make Private' : 'Make Public'}
      </button>
      <button
        onClick={copy}
        className="card"
        disabled={!isPublic || !shareId}
        title="Copy share link"
      >
        Copy Link
      </button>
    </div>
  )
}