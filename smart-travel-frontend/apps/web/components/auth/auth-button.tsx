'use client'

import { useSession, signIn, signOut } from 'next-auth/react'

export function AuthButton() {
  const { data: session, status } = useSession()
  if (status === 'loading') return null

  if (session?.user?.email) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm opacity-80">{session.user.email}</span>
        <button
          onClick={() => signOut()}
          className="btn"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => signIn('google')}
      className="btn"
    >
      Sign in with Google
    </button>
  )
}
