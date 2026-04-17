'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { API_BASE } from '@/lib/api'
import { stringImageUrl } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { UserRound, Loader2, Trash2, MapPinned, Heart, BarChart3, Map, Camera, Pencil, X, MapPin } from 'lucide-react'

type Profile = {
  display_name?: string | null
  home_base?: string | null
  bio?: string | null
  avatar_url?: string | null
  travel_name?: string | null
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

async function uploadAvatar(email: string, dataUrl: string) {
  const res = await fetch(`${API_BASE}/v1/profile/avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ image: dataUrl }),
  })
  if (!res.ok) throw new Error('upload_failed')
  const data = await res.json()
  return data?.url as string
}

async function deleteProfile(email: string) {
  const res = await fetch(`${API_BASE}/v1/profile`, {
    method: 'DELETE',
    headers: { 'x-user-email': email },
  })
  if (!res.ok) throw new Error('delete_failed')
  return res.json()
}

type Stats = { trips_count: number; favorites_count: number; places_in_trips_count: number }

async function getStats(email: string): Promise<Stats> {
  const res = await fetch(`${API_BASE}/v1/stats`, {
    cache: 'no-store',
    headers: { 'x-user-email': email },
  })
  if (!res.ok) return { trips_count: 0, favorites_count: 0, places_in_trips_count: 0 }
  const data = await res.json()
  return {
    trips_count: Number(data?.trips_count) || 0,
    favorites_count: Number(data?.favorites_count) || 0,
    places_in_trips_count: Number(data?.places_in_trips_count) || 0,
  }
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const qc = useQueryClient()
  const [displayName, setDisplayName] = React.useState('')
  const [homeBase, setHomeBase] = React.useState('')
  const [bio, setBio] = React.useState('')
  const [travelName, setTravelName] = React.useState('')
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const avatarInputRef = React.useRef<HTMLInputElement>(null)

  const profileQuery = useQuery({
    queryKey: ['profile', email],
    queryFn: () => getProfile(email!),
    enabled: status === 'authenticated' && !!email,
  })

  const statsQuery = useQuery({
    queryKey: ['stats', email],
    queryFn: () => getStats(email!),
    enabled: status === 'authenticated' && !!email,
  })

  const stats = statsQuery.data ?? { trips_count: 0, favorites_count: 0, places_in_trips_count: 0 }
  const recapLoading = statsQuery.isLoading

  React.useEffect(() => {
    const profile = profileQuery.data
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setHomeBase(profile.home_base ?? '')
      setBio(profile.bio ?? '')
      setTravelName(profile.travel_name ?? '')
      const hasData = !!(profile.display_name || profile.travel_name || profile.bio)
      if (!hasData) setIsEditing(true)
    } else if (profileQuery.isFetched) {
      setDisplayName('')
      setHomeBase('')
      setBio('')
      setTravelName('')
      setIsEditing(true)
    }
  }, [profileQuery.data, profileQuery.isFetched])

  const saveMut = useMutation({
    mutationFn: () =>
      saveProfile(
        { display_name: displayName, home_base: homeBase, bio, travel_name: travelName || null },
        email!
      ),
    onSuccess: () => {
      toast.success('Profile updated')
      qc.invalidateQueries({ queryKey: ['profile', email] })
      setIsEditing(false)
    },
    onError: () => toast.error('Could not save profile right now.'),
  })

  function cancelEditing() {
    const profile = profileQuery.data
    setDisplayName(profile?.display_name ?? '')
    setHomeBase(profile?.home_base ?? '')
    setBio(profile?.bio ?? '')
    setTravelName(profile?.travel_name ?? '')
    setIsEditing(false)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !email) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (JPEG, PNG, WebP).')
      return
    }
    if (file.size > 1024 * 1024) {
      toast.error('Image must be under 1MB.')
      return
    }
    setUploadingAvatar(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = reject
        r.readAsDataURL(file)
      })
      await uploadAvatar(email, dataUrl)
      toast.success('Profile picture updated')
      qc.invalidateQueries({ queryKey: ['profile', email] })
    } catch {
      toast.error('Could not upload picture.')
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  const deleteMut = useMutation({
    mutationFn: () => deleteProfile(email!),
    onSuccess: () => {
      toast.success('Profile cleared')
      setDisplayName('')
      setHomeBase('')
      setBio('')
      setTravelName('')
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

      {/* Travel recap: trips and saved places */}
      <section className="content-card flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgb(var(--accent))]/30 bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[rgb(var(--text))]">Your travel recap</h2>
            <p className="text-xs text-[rgb(var(--muted))]">A quick snapshot of your Smart Travel activity</p>
          </div>
        </div>
        {recapLoading ? (
          <div className="flex items-center gap-2 text-sm text-[rgb(var(--muted))]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="/dashboard/trips"
              className="content-subtle flex items-center gap-4 rounded-xl p-4 transition-all duration-200 hover:translate-y-[-2px] hover:border-[rgb(var(--accent))]/30"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]">
                <MapPinned className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold text-[rgb(var(--text))]">{stats.trips_count}</div>
                <div className="text-sm font-medium text-[rgb(var(--muted))]">Trips planned</div>
              </div>
            </Link>
            <Link
              href="/dashboard/favorites"
              className="content-subtle flex items-center gap-4 rounded-xl p-4 transition-all duration-200 hover:translate-y-[-2px] hover:border-[rgb(var(--accent))]/30"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]">
                <Heart className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold text-[rgb(var(--text))]">{stats.favorites_count}</div>
                <div className="text-sm font-medium text-[rgb(var(--muted))]">Places saved</div>
              </div>
            </Link>
            <div className="content-subtle flex items-center gap-4 rounded-xl p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]">
                <Map className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold text-[rgb(var(--text))]">{stats.places_in_trips_count}</div>
                <div className="text-sm font-medium text-[rgb(var(--muted))]">Places in trips</div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Hidden file input for avatar upload */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleAvatarChange}
        aria-label="Upload profile picture"
      />

      {isEditing ? (
        /* ─── Edit Mode ─── */
        <section className="content-card flex flex-col gap-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border transition hover:opacity-90 disabled:opacity-60"
                style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}
                title="Change profile picture"
              >
                {stringImageUrl(profileQuery.data?.avatar_url) ? (
                  <img src={stringImageUrl(profileQuery.data?.avatar_url)!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-8 w-8 text-[rgb(var(--muted))]" />
                )}
                {uploadingAvatar && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </span>
                )}
                <span className="absolute bottom-0 right-0 rounded-tl p-1" style={{ background: 'rgb(var(--accent))' }}>
                  <Camera className="h-3.5 w-3.5 text-white" />
                </span>
              </button>
              <div>
                <div className="text-sm font-semibold text-[rgb(var(--text))]">Edit traveler card</div>
                <div className="text-xs text-[rgb(var(--muted))]">Click photo to change avatar</div>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-lg p-2 text-[rgb(var(--muted))] transition hover:bg-[var(--glass-bg-hover)] hover:text-[rgb(var(--text))]"
              title="Cancel editing"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-[rgb(var(--text))]">
            <ProfileField label="Display name" placeholder="Adventurous Alex" value={displayName} onChange={(e) => setDisplayName(e.target.value)} loading={isLoading} />
            <ProfileField label="Travel name" placeholder="alex_travels" value={travelName} onChange={(e) => setTravelName(e.target.value)} loading={isLoading} hint="Visible to other travelers on the map" />
            <ProfileField label="Home base" placeholder="Lisbon, Portugal" value={homeBase} onChange={(e) => setHomeBase(e.target.value)} loading={isLoading} />
          </div>

          <ProfileTextarea label="Bio & travel style" placeholder="Weekend explorer, coffee obsessed, chasing architecture and hidden record stores." value={bio} onChange={(e) => setBio(e.target.value)} loading={isLoading} />

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="btn btn-primary rounded-2xl px-6 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveMut.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </span>
              ) : (
                'Save card'
              )}
            </Button>
            <Button
              onClick={cancelEditing}
              variant="ghost"
              className="btn btn-ghost rounded-2xl px-5 py-2 text-sm font-semibold"
            >
              Cancel
            </Button>
            <div className="flex-1" />
            {confirmDelete ? (
              <span className="inline-flex items-center gap-2">
                <Button
                  onClick={() => {
                    deleteMut.mutate()
                    setConfirmDelete(false)
                  }}
                  disabled={deleteMut.isPending}
                  variant="ghost"
                  className="btn btn-ghost rounded-2xl px-4 py-2 text-sm font-semibold bg-red-500/90 text-white hover:bg-red-600 hover:text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm delete'}
                </Button>
                <Button
                  onClick={() => setConfirmDelete(false)}
                  variant="ghost"
                  className="btn btn-ghost rounded-2xl px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </Button>
              </span>
            ) : (
              <Button
                onClick={() => setConfirmDelete(true)}
                disabled={deleteMut.isPending}
                variant="ghost"
                className="btn btn-ghost rounded-2xl px-5 py-2 text-sm font-semibold text-red-400 hover:text-red-500 disabled:cursor-wait disabled:opacity-60"
              >
                {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remove
              </Button>
            )}
          </div>
        </section>
      ) : (
        /* ─── Read-Only Traveler Card ─── */
        <section className="content-card overflow-hidden animate-fade-in">
          {/* Card header with gradient accent */}
          <div
            className="relative -mx-6 -mt-6 mb-6 px-6 pb-6 pt-8"
            style={{
              background: 'linear-gradient(135deg, rgba(var(--accent) / 0.12), rgba(var(--accent-secondary) / 0.08))',
              borderBottom: '1px solid var(--glass-border)',
            }}
          >
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div
                className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 shadow-lg"
                style={{ borderColor: 'rgba(var(--accent) / 0.4)', background: 'var(--glass-bg)' }}
              >
                {stringImageUrl(profileQuery.data?.avatar_url) ? (
                  <img src={stringImageUrl(profileQuery.data?.avatar_url)!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-10 w-10 text-[rgb(var(--muted))]" />
                )}
              </div>

              {/* Name & travel handle */}
              <div className="min-w-0 flex-1 pt-1">
                <h3 className="truncate text-xl font-bold text-[rgb(var(--text))]">
                  {displayName || 'Set your name'}
                </h3>
                {travelName && (
                  <p className="mt-0.5 text-sm font-medium text-[rgb(var(--accent))]">
                    @{travelName}
                  </p>
                )}
                {homeBase && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[rgb(var(--muted))]">
                    <MapPin className="h-3 w-3" />
                    {homeBase}
                  </div>
                )}
              </div>

              {/* Edit button */}
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="btn btn-ghost rounded-xl px-3 py-2 text-xs font-semibold"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit card
              </button>
            </div>
          </div>

          {/* Bio */}
          {bio ? (
            <p className="mb-5 text-sm leading-relaxed text-[rgb(var(--text))] opacity-90">
              {bio}
            </p>
          ) : (
            <p className="mb-5 text-sm italic text-[rgb(var(--muted))]">
              No bio yet. Click &quot;Edit card&quot; to add your travel style.
            </p>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <div className="text-lg font-bold text-[rgb(var(--accent))]">{stats.trips_count}</div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--muted))]">Trips</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <div className="text-lg font-bold text-[rgb(var(--accent))]">{stats.favorites_count}</div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--muted))]">Saved</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <div className="text-lg font-bold text-[rgb(var(--accent))]">{stats.places_in_trips_count}</div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--muted))]">Places</div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function ProfileField({
  label,
  value,
  onChange,
  loading,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  loading: boolean
  placeholder: string
  hint?: string
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="form-label">{label}</span>
      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={loading}
        className="input-surface"
      />
      {hint && <span className="text-[10px] text-[rgb(var(--muted))]">{hint}</span>}
    </label>
  )
}

function ProfileTextarea({
  label,
  value,
  onChange,
  loading,
  placeholder,
}: {
  label: string
  value: string
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
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
        disabled={loading}
        className="textarea-surface min-h-[120px]"
      />
    </label>
  )
}
