'use client'

import * as React from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { API_BASE, withEmail } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MessageCircle,
  Send,
  Loader2,
  Search,
  UserPlus,
  ArrowLeft,
  UserRound,
} from 'lucide-react'

type Conversation = { id: string; other_email: string; created_at: string }
type ChatMessage = { id: string; sender_email: string; body: string; created_at: string }
type UserSearchHit = { email: string; display_name: string | null; travel_name: string | null; avatar_url: string | null }

async function fetchConversations(email: string): Promise<Conversation[]> {
  const res = await fetch(`${API_BASE}/v1/chat/conversations`, {
    headers: withEmail(undefined, email),
  })
  if (!res.ok) throw new Error('load_failed')
  const d = await res.json()
  return d?.conversations ?? []
}

async function fetchMessages(conversationId: string, email: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/v1/chat/conversations/${conversationId}/messages`, {
    headers: withEmail(undefined, email),
  })
  if (!res.ok) throw new Error('load_failed')
  const d = await res.json()
  return d?.messages ?? []
}

async function searchUsers(q: string, email: string): Promise<UserSearchHit[]> {
  const res = await fetch(
    `${API_BASE}/v1/users/search?q=${encodeURIComponent(q)}`,
    { headers: withEmail(undefined, email) }
  )
  if (!res.ok) return []
  const d = await res.json()
  return d?.users ?? []
}

async function createConversation(
  otherEmailOrTravelName: string,
  email: string,
  isEmail: boolean
): Promise<string> {
  const body = isEmail
    ? { other_email: otherEmailOrTravelName.trim() }
    : { other_travel_name: otherEmailOrTravelName.trim() }
  const res = await fetch(`${API_BASE}/v1/chat/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withEmail(undefined, email) as Record<string, string> },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error ?? 'Could not start conversation')
  }
  const d = await res.json()
  return d?.conversation_id
}

async function sendMessage(conversationId: string, body: string, email: string): Promise<ChatMessage> {
  const res = await fetch(`${API_BASE}/v1/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withEmail(undefined, email) as Record<string, string> },
    body: JSON.stringify({ body: body.trim() }),
  })
  if (!res.ok) throw new Error('send_failed')
  return res.json()
}

function formatTime(s: string) {
  try {
    const d = new Date(s)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    return sameDay ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function initials(email: string, displayName?: string | null, travelName?: string | null) {
  if (displayName?.trim()) {
    const parts = displayName.trim().split(/\s+/).slice(0, 2)
    return parts.map(p => p[0]?.toUpperCase()).join('') || '?'
  }
  if (travelName?.trim()) return travelName.trim().slice(0, 2).toUpperCase()
  const local = email.split('@')[0] || '?'
  return local.slice(0, 2).toUpperCase()
}

export default function TravelChatPage() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [showNewChat, setShowNewChat] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [emailDirect, setEmailDirect] = React.useState('')
  const [messageDraft, setMessageDraft] = React.useState('')
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const authenticated = status === 'authenticated' && !!email

  const conversationsQuery = useQuery({
    queryKey: ['chat', 'conversations', email],
    queryFn: () => fetchConversations(email!),
    enabled: authenticated,
    refetchInterval: 15000,
  })

  const messagesQuery = useQuery({
    queryKey: ['chat', 'messages', selectedId, email],
    queryFn: () => fetchMessages(selectedId!, email!),
    enabled: authenticated && !!selectedId,
    refetchInterval: 5000,
  })

  const searchQueryDebounced = React.useMemo(() => searchQuery.trim(), [searchQuery])
  const usersSearchQuery = useQuery({
    queryKey: ['chat', 'users', searchQueryDebounced, email],
    queryFn: () => searchUsers(searchQueryDebounced, email!),
    enabled: authenticated && showNewChat && searchQueryDebounced.length >= 2,
  })

  const createConvMut = useMutation({
    mutationFn: ({ q, isEmail }: { q: string; isEmail: boolean }) =>
      createConversation(q, email!, isEmail),
    onSuccess: (conversationId) => {
      qc.invalidateQueries({ queryKey: ['chat', 'conversations', email] })
      setSelectedId(conversationId)
      setShowNewChat(false)
      setSearchQuery('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const sendMut = useMutation({
    mutationFn: (body: string) => sendMessage(selectedId!, body, email!),
    onSuccess: () => {
      setMessageDraft('')
      qc.invalidateQueries({ queryKey: ['chat', 'messages', selectedId, email] })
      qc.invalidateQueries({ queryKey: ['chat', 'conversations', email] })
    },
    onError: () => toast.error('Could not send message'),
  })

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesQuery.data])

  if (!authenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        <div className="content-card max-w-lg">
          <div className="space-y-4">
            <MessageCircle className="mx-auto h-12 w-12 text-[rgb(var(--accent))]" />
            <h1 className="text-2xl font-semibold text-[rgb(var(--text))]">Travel Chat</h1>
            <p className="text-sm text-[rgb(var(--text))] opacity-90">
              Message other travelers by email or travel name. Sign in to start chatting.
            </p>
            <Button onClick={() => signIn('google')} className="btn btn-primary w-full">
              Sign in with Google
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const conversations = conversationsQuery.data ?? []
  const messages = messagesQuery.data ?? []
  const selectedConv = conversations.find(c => c.id === selectedId)
  const otherEmail = selectedConv?.other_email ?? ''

  return (
    <div className="flex h-full flex-col text-[rgb(var(--text))]">
      <header className="content-header border-b border-[rgb(var(--border))]/50 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-[rgb(var(--text))] opacity-90">
              Travel Chat
            </p>
            <h1 className="text-3xl font-semibold text-[rgb(var(--text))] md:text-4xl">
              Message travelers
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[rgb(var(--text))] opacity-90">
              Find users by email or travel name and start a conversation.
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 gap-4 rounded-2xl border border-[rgb(var(--border))]/50 p-4 shadow-sm backdrop-blur-xl" style={{ background: 'var(--glass-bg)' }}>
        {/* Left: conversation list */}
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-[rgb(var(--border))]/50 shadow-sm backdrop-blur-xl" style={{ background: 'var(--glass-bg)' }}>
          <div className="border-b border-[rgb(var(--border))]/40 px-4 py-3">
            <span className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text))]">
              Conversations
            </span>
          </div>
          <Button
            onClick={() => {
              setShowNewChat(true)
              setSelectedId(null)
            }}
            className="btn btn-primary mx-3 mt-3 gap-2"
          >
            <UserPlus className="h-4 w-4" />
            New chat
          </Button>
          {conversationsQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[rgb(var(--muted))]" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[rgb(var(--text))] opacity-90">
              No conversations yet. Tap <strong>New chat</strong> to message someone by email or travel name.
            </p>
          ) : (
            <ul className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id)
                      setShowNewChat(false)
                    }}
                    className={cn(
                      'w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition backdrop-blur-sm',
                      selectedId === c.id
                        ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] ring-1 ring-[rgb(var(--accent))]/30'
                        : 'hover:bg-[rgb(var(--glass-bg-hover))] text-[rgb(var(--text))]'
                    )}
                  >
                    <span className="truncate block">{c.other_email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Right: thread or new chat */}
        <main className="flex flex-1 flex-col min-h-0 rounded-xl border border-[rgb(var(--border))]/50 shadow-sm backdrop-blur-xl" style={{ background: 'var(--glass-bg)' }}>
          {showNewChat ? (
            <div className="flex flex-1 flex-col overflow-y-auto p-5">
              <div className="mb-4 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewChat(false)}
                  className="btn btn-ghost gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </div>

              {/* Search section */}
              <section className="content-subtle mb-6 rounded-xl border border-[rgb(var(--border))]/40 p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text))]">
                  Search by travel name or email
                </label>
                <p className="mb-3 text-sm text-[rgb(var(--text))] opacity-90">
                  Type at least 2 characters. Travel names are set in Profile.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. alex_travels or friend@example.com"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-surface flex-1"
                    autoFocus
                  />
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgb(var(--border))]/40 bg-[rgb(var(--surface-muted))]/30 text-[rgb(var(--text))] opacity-80">
                    <Search className="h-5 w-5" />
                  </span>
                </div>
              </section>

              {searchQueryDebounced.length >= 2 && (
                <div className="space-y-2">
                  {usersSearchQuery.isLoading ? (
                    <div className="flex items-center gap-2 py-6 text-sm text-[rgb(var(--text))] opacity-90">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching…
                    </div>
                  ) : usersSearchQuery.data?.length ? (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text))]">
                      Select someone to chat
                    </p>
                  ) : null}
                  {usersSearchQuery.data?.length ? (
                    usersSearchQuery.data.map((u) => (
                      <button
                        key={u.email}
                        type="button"
                        onClick={() =>
                          createConvMut.mutate({
                            q: u.email,
                            isEmail: true,
                          })
                        }
                        disabled={createConvMut.isPending}
                        className="flex w-full items-center gap-3 rounded-xl border border-[rgb(var(--border))]/50 p-3 text-left transition hover:border-[rgb(var(--accent))]/30 backdrop-blur-sm"
                        style={{ background: 'var(--glass-bg)' }}
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] text-sm font-semibold">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            initials(u.email, u.display_name, u.travel_name)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-[rgb(var(--text))] truncate">
                            {u.display_name || u.travel_name || u.email}
                          </div>
                          <div className="text-xs text-[rgb(var(--text))] opacity-80 truncate">
                            {u.email}
                          </div>
                        </div>
                        {createConvMut.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-[rgb(var(--muted))]" />
                        ) : (
                          <MessageCircle className="h-4 w-4 shrink-0 text-[rgb(var(--accent))]" />
                        )}
                      </button>
                    ))
                  ) : !usersSearchQuery.isLoading ? (
                    <p className="py-4 text-sm text-[rgb(var(--text))] opacity-90">
                      No users found. Try a different search or use &quot;Start by email&quot; below.
                    </p>
                  ) : null}
                </div>
              )}

              {/* Start by email section */}
              <section className="content-subtle mt-6 rounded-xl border border-[rgb(var(--border))]/40 p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text))]">
                  Or start by email
                </label>
                <p className="mb-3 text-sm text-[rgb(var(--text))] opacity-90">
                  Enter their email to start a conversation. They&apos;ll see it when they open Travel Chat.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="friend@example.com"
                    value={emailDirect}
                    onChange={(e) => setEmailDirect(e.target.value)}
                    className="input-surface flex-1"
                  />
                  <Button
                    onClick={() => {
                      const e = emailDirect.trim()
                      if (!e || e.length < 3) {
                        toast.error('Enter a valid email')
                        return
                      }
                      createConvMut.mutate({ q: e, isEmail: true })
                    }}
                    disabled={createConvMut.isPending || !emailDirect.trim()}
                    className="btn btn-primary shrink-0"
                  >
                    {createConvMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Start chat'
                    )}
                  </Button>
                </div>
              </section>
            </div>
          ) : selectedId ? (
            <>
              <div className="flex items-center gap-3 border-b border-[rgb(var(--border))]/50 px-4 py-3 backdrop-blur-sm" style={{ background: 'var(--glass-bg)' }}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]">
                  <UserRound className="h-4 w-4" />
                </div>
                <span className="font-semibold text-[rgb(var(--text))] truncate">{otherEmail}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-[rgb(var(--muted))]" />
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = normalizeEmail(m.sender_email) === normalizeEmail(email!)
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'flex',
                          isMe ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[80%] rounded-2xl px-4 py-2 text-sm backdrop-blur-sm',
                            isMe
                              ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--text))] border border-[rgb(var(--accent))]/30'
                              : 'text-[rgb(var(--text))] border border-[rgb(var(--border))]/40'
                          )}
                          style={!isMe ? { background: 'var(--glass-bg)' } : undefined}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p className="mt-1 text-[10px] text-[rgb(var(--text))] opacity-75">
                            {formatTime(m.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <form
                className="flex gap-2 border-t border-[rgb(var(--border))]/40 p-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  const body = messageDraft.trim()
                  if (!body || sendMut.isPending) return
                  sendMut.mutate(body)
                }}
              >
                <Input
                  placeholder="Type a message..."
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  className="input-surface flex-1"
                  disabled={sendMut.isPending}
                />
                <Button
                  type="submit"
                  disabled={!messageDraft.trim() || sendMut.isPending}
                  className="btn btn-primary shrink-0"
                >
                  {sendMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </>
          ) : (
            <div className="content-subtle flex flex-1 flex-col items-center justify-center gap-6 rounded-xl border-2 border-dashed border-[rgb(var(--border))]/50 p-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]">
                <MessageCircle className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[rgb(var(--text))]">
                  No conversation selected
                </h2>
                <p className="mt-2 max-w-sm text-sm text-[rgb(var(--text))] opacity-90">
                  Choose a conversation from the list or start a new chat to message other travelers.
                </p>
              </div>
              <Button
                onClick={() => setShowNewChat(true)}
                className="btn btn-primary gap-2"
              >
                <UserPlus className="h-4 w-4" />
                New chat
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}
