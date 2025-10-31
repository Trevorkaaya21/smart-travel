'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'

export function useGuest() {
  const { status } = useSession()
  const [guest, setGuest] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const pull = () => {
      const flag = window.localStorage.getItem('st_guest') === '1'
      setGuest(flag)
    }

    pull()
    window.addEventListener('storage', pull)
    return () => window.removeEventListener('storage', pull)
  }, [])

  React.useEffect(() => {
    if (status === 'authenticated' && typeof window !== 'undefined') {
      window.localStorage.removeItem('st_guest')
      setGuest(false)
    }
  }, [status])

  return {
    isGuest: guest && status !== 'authenticated',
  }
}
