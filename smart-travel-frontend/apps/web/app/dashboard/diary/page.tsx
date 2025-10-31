'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, BookOpenCheck, PenSquare } from 'lucide-react'
import { API_BASE } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Diary = { id: string; title: string; created_at: string }

async function listDiaries(email: string) {
  const res = await fetch(`${API_BASE}/v1/diary?user_email=${encodeURIComponent(email)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('load_failed')
  return res.json() as Promise<{ diaries: Diary[] }>
}

async function createDiary(title: string, email: string) {
  const res = await fetch(`${API_BASE}/v1/diary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error('create_failed')
  return res.json()
}

export default function DiaryPage() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const qc = useQueryClient()
  const [title, setTitle] = React.useState('My Travel Diary')

  const diariesQuery = useQuery({
    queryKey: ['diaries', email],
    queryFn: () => listDiaries(email!),
    enabled: status === 'authenticated' && !!email,
  })

  const createMut = useMutation({
    mutationFn: () => createDiary(title.trim() || 'Untitled entry', email!),
    onSuccess: () => {
      toast.success('Diary created')
      qc.invalidateQueries({ queryKey: ['diaries', email] })
    },
    onError: () => toast.error('Could not create diary entry.'),
  })

  if (status !== 'authenticated' || !email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="content-card max-w-lg space-y-4">
          <h1 className="text-4xl font-semibold text-[rgb(var(--text))]">Sign in to capture your travel stories</h1>
          <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
            Keep notes, photos, and reflections from every journey. Connect Google to continue.
          </p>
          <Button
            onClick={() => signIn('google')}
            className="btn btn-primary w-full justify-center rounded-2xl px-5 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-80"
          >
            Sign in with Google
          </Button>
        </div>
      </div>
    )
  }

  const diaries = diariesQuery.data?.diaries ?? []

  return (
    <div className="flex h-full flex-col gap-8 text-[rgb(var(--text))]">
      <header className="content-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-[color-mix(in_oklab,rgb(var(--text))_65%,rgb(var(--muted))_35%)]">
              My travel diary
            </p>
            <h1 className="text-3xl font-semibold md:text-4xl">Collect the moments between departure and arrival</h1>
            <p className="max-w-2xl text-sm text-[color-mix(in_oklab,rgb(var(--text))_72%,rgb(var(--muted))_28%)]">
              Chronicle each adventure with mood, highlights, and sensory details. Diaries link with your itineraries so you can relive the story anytime.
            </p>
          </div>
          <div
            className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-[color-mix(in_oklab,rgb(var(--text))_65%,rgb(var(--muted))_35%)]"
            style={{ border: '1px solid rgba(var(--border) / .55)', background: 'rgba(var(--surface-muted) / .4)' }}
          >
            {diaries.length} journal{diaries.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>

      <section className="content-card space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Start a new entry</h2>
            <p className="form-helper uppercase tracking-[0.3em]">Name the chapter, then fill it in later</p>
          </div>
          <div className="content-subtle flex w-full flex-col gap-3 p-4 md:w-auto md:flex-row md:items-center">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sunrise memories in Bali"
              className="input-surface md:w-72"
            />
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
              className="btn btn-primary rounded-2xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
            >
              {createMut.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <PenSquare className="h-4 w-4" />
                  Create entry
                </span>
              )}
            </Button>
          </div>
        </div>

        {diariesQuery.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="content-subtle h-44 animate-pulse" />
            ))}
          </div>
        ) : diaries.length === 0 ? (
          <div className="content-card flex flex-col items-center justify-center gap-4 text-center text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
            <BookOpenCheck className="h-8 w-8 text-[rgb(var(--accent))]" />
            <p className="max-w-sm text-sm">
              You haven&apos;t written any entries yet. Start by creating one above, then capture your reflections after each day.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {diaries.map((diary) => (
              <Link
                key={diary.id}
                href={`/dashboard/diary/${diary.id}`}
                className="content-card flex h-full flex-col justify-between text-sm transition hover:-translate-y-[2px]"
              >
                <div className="space-y-3">
                  <span className="form-label">Diary entry</span>
                  <h3 className="text-lg font-semibold text-[rgb(var(--text))]">{diary.title}</h3>
                </div>
                <div className="text-xs uppercase tracking-[0.3em] text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
                  {new Date(diary.created_at).toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
