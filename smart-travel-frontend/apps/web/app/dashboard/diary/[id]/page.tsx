'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Camera, Loader2, ArrowLeft, ImageOff } from 'lucide-react'
import { API_BASE } from '@/lib/configure'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type DiaryEntry = {
  id: string
  day: number
  text?: string | null
  photo_url?: string | null
  photo_data?: string | null
  photo_caption?: string | null
  created_at: string
}

type DiaryEntriesResponse = {
  diary?: { title?: string | null }
  items: DiaryEntry[]
}

type AddEntryPayload = {
  text: string
  day: number
  photoData?: string | null
  photoCaption?: string | null
}

async function fetchEntries(id: string, email?: string) {
  const r = await fetch(`${API_BASE}/v1/diary/${id}/entries`, {
    cache: 'no-store',
    headers: email ? { 'x-user-email': email } : undefined,
  })
  if (!r.ok) throw new Error('load_failed')
  return (await r.json()) as DiaryEntriesResponse
}

async function addEntry(id: string, payload: AddEntryPayload, email: string) {
  const body: Record<string, any> = {
    text: payload.text,
    day: payload.day,
  }
  if (payload.photoData) body.photo_data = payload.photoData
  if (payload.photoCaption) body.photo_caption = payload.photoCaption

  const r = await fetch(`${API_BASE}/v1/diary/${id}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let message = 'Could not save entry.'
    try {
      const detail = await r.json()
      message = detail?.message || detail?.error || message
    } catch {
      // ignore parse errors
    }
    const error = new Error(message)
    ;(error as any).status = r.status
    throw error
  }
  return r.json()
}

function useDiaryId() {
  const params = useParams<{ id: string | string[] }>()
  const raw = params?.id
  if (Array.isArray(raw)) return raw[0]
  return raw
}

export default function DiaryDetailPage() {
  const diaryId = useDiaryId()
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const qc = useQueryClient()

  const [text, setText] = React.useState('')
  const [day, setDay] = React.useState<number>(1)
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null)
  const [photoCaption, setPhotoCaption] = React.useState('')

  const entriesQ = useQuery({
    queryKey: ['diary-entries', diaryId, email],
    queryFn: () => fetchEntries(diaryId!, email),
    enabled: !!diaryId && status === 'authenticated' && !!email,
  })

  const addMut = useMutation({
    mutationFn: (payload: AddEntryPayload) => addEntry(diaryId!, payload, email!),
    onSuccess: () => {
      setText('')
      setPhotoPreview(null)
      setPhotoCaption('')
      qc.invalidateQueries({ queryKey: ['diary-entries', diaryId, email] })
      toast.success('Entry added', { description: 'Your memory is saved in the diary.' })
    },
    onError: (error) => {
      const description = error instanceof Error ? error.message : 'Please try again.'
      toast.error('Could not save entry right now.', { description })
    },
  })

  const handleFileChange = async (file: File | null) => {
    if (!file) {
      setPhotoPreview(null)
      setPhotoCaption('')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file.')
      return
    }
    if (file.size > 1.5 * 1024 * 1024) {
      toast('Images should be under 1.5MB for now.')
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      setPhotoPreview(dataUrl)
    } catch (err) {
      console.error(err)
      toast.error('Could not read that photo. Try another one.')
    }
  }

  const groupedEntries = React.useMemo(() => {
    const base = new Map<number, DiaryEntry[]>()
    const items = entriesQ.data?.items ?? []
    for (const entry of items) {
      const dayKey = entry.day ?? 1
      const arr = base.get(dayKey) ?? []
      arr.push(entry)
      base.set(dayKey, arr)
    }
    return Array.from(base.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, list]) => ({
        day,
        list: list.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      }))
  }, [entriesQ.data?.items])

  if (!diaryId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold text-[rgb(var(--text))]">Diary not found.</p>
        <Link href="/dashboard/diary" className="btn btn-primary rounded-2xl px-4 py-2">
          Back to diary
        </Link>
      </div>
    )
  }

  if (status !== 'authenticated' || !email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="content-card max-w-lg space-y-4">
          <h1 className="text-3xl font-semibold text-[rgb(var(--text))]">Sign in to write your travel stories</h1>
          <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
            Capture moments with notes and photos, then revisit them whenever you explore the world again.
          </p>
          <Button
            onClick={() => signIn('google')}
            className="btn btn-primary w-full justify-center rounded-2xl px-5 py-3 text-base font-semibold"
          >
            Sign in with Google
          </Button>
        </div>
      </div>
    )
  }

  const diaryTitle = entriesQ.data?.diary?.title ?? 'Your travel diary'
  const isSaving = addMut.isPending
  const canSubmit = text.trim().length > 0 || !!photoPreview

  return (
    <div className="flex h-full flex-col gap-8 text-[rgb(var(--text))]">
      <header className="content-header space-y-4">
        <Link href="/dashboard/diary" className="btn btn-ghost w-fit rounded-xl px-4 py-2 text-sm font-semibold">
          <ArrowLeft className="h-4 w-4" />
          Back to diary
        </Link>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-[color-mix(in_oklab,rgb(var(--text))_65%,rgb(var(--muted))_35%)]">
            Travel diary
          </p>
          <h1 className="text-3xl font-semibold md:text-4xl">{diaryTitle}</h1>
          <p className="max-w-2xl text-sm text-[color-mix(in_oklab,rgb(var(--text))_72%,rgb(var(--muted))_28%)]">
            Add context, reflections, and photos for each day. Entries sync with your Smart Travel timeline so you can relive the journey in detail.
          </p>
        </div>
      </header>

      <section className="content-card space-y-8">
        <div className="content-subtle space-y-5">
          <div className="grid gap-4 md:grid-cols-[120px_1fr]">
            <label className="form-label" htmlFor="diary-day">
              Day number
            </label>
            <Input
              id="diary-day"
              type="number"
              min={1}
              value={day}
              onChange={(e) => setDay(Math.max(1, Number(e.currentTarget.value) || 1))}
              className="input-surface"
            />
            <label className="form-label" htmlFor="diary-text">
              Story
            </label>
            <Textarea
              id="diary-text"
              value={text}
              onChange={(e) => setText(e.currentTarget.value)}
              placeholder="Describe the mood, the people you met, or the unexpected highlights…"
              className="textarea-surface min-h-[140px]"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[120px_1fr]">
            <span className="form-label">Photo</span>
            <div className="space-y-3">
              <label className="btn btn-ghost inline-flex w-full cursor-pointer justify-center rounded-2xl px-4 py-2 text-sm font-semibold md:w-auto">
                <Camera className="h-4 w-4 text-[rgb(var(--accent))]" />
                Add photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => handleFileChange(e.currentTarget.files?.[0] ?? null)}
                />
              </label>
              {photoPreview ? (
                <div className="content-card flex flex-col gap-3 p-4 md:flex-row md:items-center">
                  <img
                    src={photoPreview}
                    alt="Diary preview"
                    className="h-36 w-36 rounded-2xl object-cover object-center"
                  />
                  <div className="flex-1 space-y-3">
                    <Input
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.currentTarget.value)}
                      placeholder="Add a short caption"
                      className="input-surface"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreview(null)
                          setPhotoCaption('')
                        }}
                        className="btn btn-ghost rounded-2xl px-4 py-2 text-xs font-semibold"
                      >
                        Remove photo
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="content-subtle flex items-center gap-3 p-4 text-sm text-[color-mix(in_oklab,rgb(var(--text))_68%,rgb(var(--muted))_32%)]">
                  <ImageOff className="h-5 w-5 text-[rgb(var(--accent))]" />
                  Snap a quick picture or upload from your library. We keep images lightweight &lt; 1.5MB for smooth sync.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (!canSubmit) {
                  toast('Write a note or add a photo to save an entry.')
                  return
                }
                addMut.mutate({
                  text: text.trim(),
                  day,
                  photoData: photoPreview ?? undefined,
                  photoCaption: photoCaption.trim() || undefined,
                })
              }}
              disabled={!canSubmit || isSaving}
              className="btn btn-primary rounded-2xl px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </span>
              ) : (
                'Save entry'
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          {entriesQ.isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="content-subtle h-48 animate-pulse" />
              ))}
            </div>
          ) : groupedEntries.length === 0 ? (
            <div className="content-card flex flex-col items-center justify-center gap-3 text-center text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
              <Camera className="h-8 w-8 text-[rgb(var(--accent))]" />
              <p className="max-w-sm text-sm">
                No entries yet. Start with a quick note or a photo from today&apos;s adventure.
              </p>
            </div>
          ) : (
            groupedEntries.map(({ day, list }) => (
              <article key={day} className="content-card space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="form-label">Day {day}</span>
                    <h2 className="text-lg font-semibold text-[rgb(var(--text))]">Moments captured</h2>
                  </div>
                  <span className="badge-pro text-[10px]">
                    {list.length} {list.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                <div className="space-y-3">
                  {list.map((entry) => (
                    <div key={entry.id} className="content-subtle space-y-3 p-5">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
                        <span>{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                      {(entry.photo_url ?? entry.photo_data) && (
                        <img
                          src={entry.photo_url ?? entry.photo_data ?? undefined}
                          alt={entry.photo_caption ?? 'Diary entry photo'}
                          className="w-full rounded-2xl object-cover"
                        />
                      )}
                      {entry.photo_caption && (
                        <p className="text-sm italic text-[color-mix(in_oklab,rgb(var(--text))_68%,rgb(var(--muted))_32%)]">
                          {entry.photo_caption}
                        </p>
                      )}
                      {entry.text ? (
                        <p className="whitespace-pre-wrap text-sm text-[color-mix(in_oklab,rgb(var(--text))_74%,rgb(var(--muted))_26%)]">
                          {entry.text}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
