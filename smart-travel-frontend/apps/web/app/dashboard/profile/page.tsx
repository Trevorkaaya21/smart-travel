'use client'

import * as React from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { API_BASE } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { UserRound, Loader2, Pencil, ShieldCheck, Trash2 } from 'lucide-react'

type Profile = {
  display_name?: string | null
  home_base?: string | null
  bio?: string | null
}

async function getProfile(email: string) {
  const res = await fetch(`${API_BASE}/v1/profile?email=${encodeURIComponent(email)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('load_failed')
  const data = await res.json()
  return (data?.profile ?? null) as Profile | null
}

async function saveProfile(payload: Profile, email: string) {
  const res = await fetch(`${API_BASE}/v1/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('save_failed')
  return res.json()
}

async function deleteProfile(email: string) {
  const res = await fetch(`${API_BASE}/v1/profile`, {
    method: 'DELETE',
    headers: { 'x-user-email': email },
  })
  if (!res.ok) throw new Error('delete_failed')
  return res.json()
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const qc = useQueryClient()
  const [displayName, setDisplayName] = React.useState('')
  const [homeBase, setHomeBase] = React.useState('')
  const [bio, setBio] = React.useState('')
  const [editing, setEditing] = React.useState(false)

  const profileQuery = useQuery({
    queryKey: ['profile', email],
    queryFn: () => getProfile(email!),
    enabled: status === 'authenticated' && !!email,
  })

  React.useEffect(() => {
    const profile = profileQuery.data
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setHomeBase(profile.home_base ?? '')
      setBio(profile.bio ?? '')
    } else {
      setDisplayName('')
      setHomeBase('')
      setBio('')
    }
  }, [profileQuery.data])

  const saveMut = useMutation({
    mutationFn: () => saveProfile({ display_name: displayName, home_base: homeBase, bio }, email!),
    onSuccess: () => {
      toast.success('Profile updated')
      setEditing(false)
      qc.invalidateQueries({ queryKey: ['profile', email] })
    },
    onError: () => toast.error('Could not save profile right now.'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteProfile(email!),
    onSuccess: () => {
      toast.success('Profile cleared')
      setDisplayName('')
      setHomeBase('')
      setBio('')
      qc.invalidateQueries({ queryKey: ['profile', email] })
    },
    onError: () => toast.error('Unable to delete profile.'),
  })

  if (status !== 'authenticated' || !email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        <div className="content-card max-w-lg">
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold text-[rgb(var(--text))]">Sign in to personalize Smart Travel</h1>
            <p className="text-sm text-[color-mix(in_oklab,rgb(var(--text))_72%,rgb(var(--muted))_28%)]">
              Build your explorer card so AI recommendations match your vibe. Connect Google to continue.
            </p>
            <Button
              onClick={() => signIn('google')}
              className="btn btn-primary w-full justify-center"
            >
              Sign in with Google
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const isLoading = profileQuery.isLoading

  return (
    <div className="flex h-full flex-col gap-8 text-[rgb(var(--text))]">
      <header className="content-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-[color-mix(in_oklab,rgb(var(--text))_65%,rgb(var(--muted))_35%)]">Profile</p>
            <h1 className="text-3xl font-semibold md:text-4xl">Craft your traveler identity</h1>
            <p className="max-w-2xl text-sm text-[color-mix(in_oklab,rgb(var(--text))_72%,rgb(var(--muted))_28%)]">
              Share your name, home base, and interests so Smart Travel tailors itineraries, tone, and suggestions just for you.
            </p>
          </div>
          <div className="content-subtle px-5 py-4 text-xs uppercase tracking-[0.3em] text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
            {session?.user?.email}
          </div>
        </div>
      </header>

      <section className="content-card flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/10 text-[rgb(var(--text))]">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Traveler card</div>
              <div className="form-helper">
                {editing ? 'Edit mode' : 'View mode'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setEditing((prev) => !prev)}
              variant="ghost"
              className="btn btn-ghost rounded-2xl px-4 py-2 text-xs font-semibold"
            >
              <Pencil className="h-4 w-4" />
              {editing ? 'Stop editing' : 'Edit details'}
            </Button>
            <Button
              onClick={() => {
                setDisplayName('')
                setHomeBase('')
                setBio('')
                setEditing(true)
              }}
              variant="ghost"
              className="btn btn-ghost rounded-2xl px-4 py-2 text-xs font-semibold"
            >
              <ShieldCheck className="h-4 w-4" />
              Reset fields
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 text-[rgb(var(--text))]">
          <ProfileField
            label="Display name"
            placeholder="Adventurous Alex"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            editing={editing}
            loading={isLoading}
          />
          <ProfileField
            label="Home base"
            placeholder="Lisbon, Portugal"
            value={homeBase}
            onChange={(e) => setHomeBase(e.target.value)}
            editing={editing}
            loading={isLoading}
          />
        </div>

        <ProfileTextarea
          label="Bio & travel style"
          placeholder="Weekend explorer, coffee obsessed, chasing architecture and hidden record stores."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          editing={editing}
          loading={isLoading}
        />

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => saveMut.mutate()}
            disabled={!editing || saveMut.isPending}
            className="btn btn-primary rounded-2xl px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveMut.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </span>
            ) : (
              'Save changes'
            )}
          </Button>
          <Button
            onClick={() => {
              if (deleteMut.isPending) return
              if (window.confirm('Delete your Smart Travel profile? Your trips remain safe.')) {
                deleteMut.mutate()
              }
            }}
            disabled={deleteMut.isPending}
            variant="ghost"
            className="btn btn-ghost rounded-2xl px-5 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-60"
          >
            {deleteMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Remove profile
          </Button>
        </div>
      </section>
    </div>
  )
}

function ProfileField({
  label,
  value,
  onChange,
  editing,
  loading,
  placeholder,
}: {
  label: string
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  editing: boolean
  loading: boolean
  placeholder: string
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="form-label">{label}</span>
      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={!editing || loading}
        className="input-surface"
      />
    </label>
  )
}

function ProfileTextarea({
  label,
  value,
  onChange,
  editing,
  loading,
  placeholder,
}: {
  label: string
  value: string
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
  editing: boolean
  loading: boolean
  placeholder: string
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="form-label">{label}</span>
      <Textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={!editing || loading}
        className="textarea-surface min-h-[120px]"
      />
    </label>
  )
}
