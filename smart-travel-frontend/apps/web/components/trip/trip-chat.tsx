'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Send, Users } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useGuest } from '@/lib/useGuest'
import { api, withEmail } from '@/lib/api'

type TripChatResponse = {
  role: 'owner' | 'collaborator'
  collaborators: Array<{
    email: string
    role: 'owner' | 'collaborator'
    invited_by: string | null
    status: string
    created_at: string
  }>
  messages: Array<{
    id: string
    author_email: string
    message: string
    created_at: string
  }>
}

type PostMessageResponse = {
  message?: {
    id: string
    author_email: string
    message: string
    created_at: string
  }
}

type CollaboratorResponse = {
  collaborator: {
    email: string
    role: 'owner' | 'collaborator'
    invited_by: string | null
    status: string
    created_at: string
  }
  duplicate?: boolean
}

function formatTimestamp(value: string) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export function TripChatPanel({ tripId }: { tripId: string }) {
  const { isGuest } = useGuest()
  const { data: session } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const queryClient = useQueryClient()

  const [message, setMessage] = React.useState('')
  const [inviteEmail, setInviteEmail] = React.useState('')
  const messagesRef = React.useRef<HTMLDivElement | null>(null)

  const chatQuery = useQuery({
    queryKey: ['trip-chat', tripId, email],
    enabled: !!tripId && !!email && !isGuest,
    queryFn: async () => {
      const res = await fetch(api(`/v1/trips/${tripId}/chat`), {
        headers: withEmail({}, email),
        cache: 'no-store',
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Could not load chat.')
      }
      return (await res.json()) as TripChatResponse
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  })

  const sendMutation = useMutation({
    mutationFn: async (body: { message: string }) => {
      const res = await fetch(api(`/v1/trips/${tripId}/chat`), {
        method: 'POST',
        headers: withEmail({ 'Content-Type': 'application/json' }, email),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Could not send message.')
      }
      return (await res.json()) as PostMessageResponse
    },
    onSuccess: () => {
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['trip-chat', tripId, email] })
    },
    onError: (err) => {
      const description = err instanceof Error ? err.message : 'Try again.'
      toast.error('Could not send message', { description })
    },
  })

  const inviteMutation = useMutation({
    mutationFn: async (payload: { email: string }) => {
      const res = await fetch(api(`/v1/trips/${tripId}/collaborators`), {
        method: 'POST',
        headers: withEmail({ 'Content-Type': 'application/json' }, email),
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Could not add collaborator.')
      }
      return (await res.json()) as CollaboratorResponse
    },
    onSuccess: (data) => {
      setInviteEmail('')
      queryClient.invalidateQueries({ queryKey: ['trip-chat', tripId, email] })
      if (data.duplicate) {
        toast('Collaborator already added', { description: data.collaborator.email })
      } else {
        const chatLink =
          typeof window !== 'undefined' ? `${window.location.origin}/trip/${tripId}#trip-chat` : null
        if (chatLink) {
          navigator.clipboard?.writeText(chatLink).catch(() => null)
        }
        toast.success('Collaborator added', {
          description: chatLink
            ? `${data.collaborator.email} can open ${chatLink} (link copied)`
            : data.collaborator.email,
        })
      }
    },
    onError: (err) => {
      const description = err instanceof Error ? err.message : 'Try again.'
      toast.error('Invite failed', { description })
    },
  })

  if (isGuest || !email) {
    return (
      <div className="content-card">
        <h2 className="text-lg font-semibold text-[rgb(var(--text))]">Trip chat</h2>
        <p className="mt-2 text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
          Sign in with your Google account to collaborate on this itinerary.
        </p>
      </div>
    )
  }

  if (chatQuery.isLoading) {
    return (
      <div className="content-card text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
        Loading trip chat…
      </div>
    )
  }

  if (chatQuery.isError) {
    return (
      <div className="content-card text-sm text-rose-300">
        Could not load the chat. Refresh to try again.
      </div>
    )
  }

  const data = chatQuery.data
  if (!data) {
    return (
      <div className="content-card text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
        Loading trip chat…
      </div>
    )
  }

  const isOwner = data.role === 'owner'
  const messages = (data.messages ?? []) as TripChatResponse['messages']
  const collaborators = (data.collaborators ?? []) as TripChatResponse['collaborators']

  React.useEffect(() => {
    if (!messagesRef.current) return
    messagesRef.current.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  return (
    <section id="trip-chat" className="content-card space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[rgb(var(--text))]">Trip chat</h2>
          <p className="text-xs uppercase tracking-[0.3em] text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
            Collaborate with your travel party
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
          <Users className="h-4 w-4" />
          {collaborators.length} member{collaborators.length === 1 ? '' : 's'}
        </div>
      </header>

      <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-xs text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
        Messages refresh automatically every few seconds. Share the trip link so collaborators can join this chat.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-4">
          <div
            ref={messagesRef}
            className="content-subtle max-h-[360px] space-y-3 overflow-y-auto p-4 text-sm"
          >
            {messages.length === 0 ? (
              <p className="text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
                No messages yet. Start the conversation!
              </p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="rounded-2xl border border-white/10 bg-white/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-[rgb(var(--text))]">
                      {msg.author_email}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
                      {formatTimestamp(msg.created_at)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[color-mix(in_oklab,rgb(var(--text))_78%,rgb(var(--muted))_22%)] whitespace-pre-wrap">
                    {msg.message}
                  </p>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              const text = message.trim()
              if (!text) {
                toast('Write a message before sending.')
                return
              }
              sendMutation.mutate({ message: text })
            }}
            className="space-y-3"
          >
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Share updates, ask questions, or drop a link…"
              className="textarea-surface min-h-[90px]"
              maxLength={2000}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={sendMutation.isPending}
                className="btn btn-primary inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Send className="h-4 w-4" />
                {sendMutation.isPending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </form>
        </div>

        <aside className="content-subtle h-fit space-y-3 p-4">
          <h3 className="text-sm font-semibold text-[rgb(var(--text))]">Collaborators</h3>
          <div className="space-y-2 text-xs text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
            {collaborators.map((collab) => (
              <div key={`${collab.email}-${collab.created_at}`} className="rounded-xl border border-white/10 bg-white/10 p-3">
                <div className="font-semibold text-[rgb(var(--text))]">{collab.email}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-[color-mix(in_oklab,rgb(var(--text))_65%,rgb(var(--muted))_35%)]">
                  {collab.role}
                </div>
              </div>
            ))}
          </div>

          {isOwner && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const trimmed = inviteEmail.trim().toLowerCase()
                if (!trimmed) {
                  toast('Enter an email address to invite.')
                  return
                }
                inviteMutation.mutate({ email: trimmed })
              }}
              className="space-y-2"
            >
              <label className="form-label">Invite collaborator</label>
              <Input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="friend@example.com"
                className="input-surface"
                type="email"
              />
              <Button
                type="submit"
                disabled={inviteMutation.isPending}
                className="btn btn-ghost w-full rounded-2xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                {inviteMutation.isPending ? 'Inviting…' : 'Send invite'}
              </Button>
            </form>
          )}
        </aside>
      </div>
    </section>
  )
}
