'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Home, MapPin, Plus, Minus, Trash2, GripVertical, Pencil, Check, X, Compass, ExternalLink, NotebookPen, CalendarDays, Star, MapPinned, AlertTriangle } from 'lucide-react'
import { API_BASE } from '@/lib/api'
import { cleanTripName, computeTripDays } from '@/lib/trip-utils'
import { ShareButton } from '@/components/trip/share-button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type Trip = {
  id: string
  name: string | null
  owner_email: string | null
  is_public?: boolean | null
  share_id?: string | null
  start_date?: string | null
  end_date?: string | null
}

type TripItem = {
  id: string
  place_id: string
  day: number
  note: string | null
  created_at: string
  name?: string | null
  category?: string | null
  rating?: number | null
  lat?: number | null
  lng?: number | null
}

const EMPTY_ITEMS: TripItem[] = []

/* ---------- API helpers ---------- */

async function fetchTrip(id: string) {
  const r = await fetch(`${API_BASE}/v1/trips/${id}`, { cache: 'no-store' })
  if (!r.ok) throw new Error('trip_load_failed')
  return r.json() as Promise<{ trip: Trip }>
}

async function fetchItems(id: string) {
  const r = await fetch(`${API_BASE}/v1/trips/${id}/items`, { cache: 'no-store' })
  if (!r.ok) throw new Error('items_load_failed')
  return r.json() as Promise<{ items: TripItem[] }>
}

async function deleteItem(tripId: string, itemId: string, email: string) {
  const r = await fetch(`${API_BASE}/v1/trips/${tripId}/items/${itemId}`, {
    method: 'DELETE',
    headers: { 'x-user-email': email },
  })
  if (!r.ok) throw new Error('delete_failed')
  return r.json()
}

async function patchItem(tripId: string, itemId: string, email: string, patch: Partial<Pick<TripItem, 'day' | 'note'>>) {
  const r = await fetch(`${API_BASE}/v1/trips/${tripId}/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify(patch),
  })
  if (!r.ok) throw new Error('update_failed')
  return r.json()
}

async function reorderDay(tripId: string, day: number, order: string[], email: string) {
  const r = await fetch(`${API_BASE}/v1/trips/${tripId}/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ day, order }),
  })
  if (!r.ok) throw new Error('reorder_failed')
  return r.json()
}

async function renameTrip(tripId: string, name: string, email: string) {
  const r = await fetch(`${API_BASE}/v1/trips/${tripId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-user-email': email },
    body: JSON.stringify({ name }),
  })
  if (!r.ok) throw new Error('rename_failed')
  return r.json() as Promise<{ ok: true; name: string }>
}

/* ---------- DnD helpers ---------- */

function findItemDay(itemsByDay: Record<number, TripItem[]>, itemId: string) {
  for (const [dayStr, list] of Object.entries(itemsByDay)) {
    if (list.some(i => i.id === itemId)) return Number(dayStr)
  }
  return null
}

function groupByDay(items: TripItem[]) {
  const map: Record<number, TripItem[]> = {}
  for (const it of items) {
    const d = it.day ?? 1
    if (!map[d]) map[d] = []
    map[d].push(it)
  }
  for (const d of Object.keys(map)) {
    map[Number(d)].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }
  return map
}

/* ---------- UI subcomponents ---------- */

const DAY_ACCENT_COLORS = [
  { border: 'rgb(6, 182, 212)', bg: 'rgba(6, 182, 212, 0.08)' },
  { border: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.08)' },
  { border: 'rgb(249, 115, 22)', bg: 'rgba(249, 115, 22, 0.08)' },
  { border: 'rgb(34, 197, 94)', bg: 'rgba(34, 197, 94, 0.08)' },
  { border: 'rgb(236, 72, 153)', bg: 'rgba(236, 72, 153, 0.08)' },
  { border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.08)' },
  { border: 'rgb(245, 158, 11)', bg: 'rgba(245, 158, 11, 0.08)' },
]

function DayColumn({
  day,
  itemCount,
  canRemove,
  onRemoveDay,
  children,
}: {
  day: number
  itemCount: number
  canRemove: boolean
  onRemoveDay: (day: number) => void
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })
  const accent = DAY_ACCENT_COLORS[(day - 1) % DAY_ACCENT_COLORS.length]

  return (
    <div
      ref={setNodeRef}
      className="rounded-2xl border transition-all duration-200 overflow-hidden"
      style={{
        borderColor: isOver ? accent.border : 'var(--glass-border)',
        background: 'var(--glass-bg)',
        boxShadow: isOver
          ? `0 0 0 2px ${accent.border}40, var(--shadow-md)`
          : 'var(--shadow-sm)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Day header with accent gradient */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          background: accent.bg,
          borderBottom: `1px solid var(--glass-border)`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: accent.border }}
          >
            {day}
          </div>
          <div>
            <div className="text-sm font-bold text-[rgb(var(--text))]">Day {day}</div>
            <div className="text-[10px] text-[rgb(var(--muted))]">
              {itemCount} {itemCount === 1 ? 'place' : 'places'}
            </div>
          </div>
        </div>
        {canRemove && (
          <button
            onClick={() => onRemoveDay(day)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-[rgb(var(--muted))] transition hover:bg-red-500/10 hover:text-red-400"
            title={itemCount > 0 ? `Remove Day ${day} (moves ${itemCount} place(s) to Day 1)` : `Remove Day ${day}`}
          >
            <Minus className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Items */}
      <div className="space-y-2 p-3">
        {children}
      </div>
    </div>
  )
}

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#f97316',
  hotel: '#3b82f6',
  attraction: '#a855f7',
  bar: '#ec4899',
  nightlife: '#ec4899',
  museum: '#8b5cf6',
  park: '#22c55e',
  beach: '#06b6d4',
  cafe: '#f59e0b',
  shopping: '#e11d48',
}

function getCategoryColor(category?: string | null): string {
  if (!category) return 'rgb(var(--accent))'
  const key = category.toLowerCase()
  for (const [k, v] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes(k)) return v
  }
  return 'rgb(var(--accent))'
}

function ItemRow({
  item,
  onDelete,
  onEdit,
  maxDay,
  ensureDayVisible,
}: {
  item: TripItem
  onDelete: (id: string) => void
  onEdit: (id: string, patch: Partial<Pick<TripItem, 'day' | 'note'>>) => void
  maxDay: number
  ensureDayVisible: (day: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    scale: isDragging ? '1.03' : '1',
  }
  const catColor = getCategoryColor(item.category)

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}
      className="group flex gap-3 rounded-xl border p-3 transition-all duration-200 hover:shadow-[var(--shadow-md)]"
      role="listitem"
      aria-label={item.name ?? item.place_id}
    >
      {/* Category color strip */}
      <div
        className="w-1 shrink-0 rounded-full"
        style={{ background: catColor }}
      />

      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-2">
        {/* Top: drag handle + name + actions */}
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab rounded-md p-1 text-[rgb(var(--muted))] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--glass-bg-hover)] hover:text-[rgb(var(--text))] active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-[rgb(var(--text))]">
                {item.name ?? item.place_id}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[rgb(var(--muted))]">
              {item.category && (
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: catColor }} />
                  {item.category}
                </span>
              )}
              {item.rating != null && item.rating > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {item.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            {item.lat != null && item.lng != null && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-1.5 text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--accent))]/10 hover:text-[rgb(var(--accent))]"
                title="Open in Google Maps"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              onClick={() => onDelete(item.id)}
              className="rounded-lg p-1.5 text-[rgb(var(--muted))] transition hover:bg-red-500/10 hover:text-red-400"
              title="Remove place"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Bottom: note + day selector */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={item.day ?? 1}
            onChange={(e) => {
              const nextDay = Number(e.currentTarget.value)
              ensureDayVisible(nextDay)
              onEdit(item.id, { day: nextDay })
            }}
            className="timeline-select rounded-lg text-[11px]"
            title="Move to day"
          >
            {Array.from({ length: Math.max(maxDay + 1, item.day ?? 1) }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>Day {d}</option>
            ))}
          </select>
          <input
            defaultValue={item.note ?? ''}
            placeholder="Add a note…"
            onBlur={(e) => {
              const v = e.currentTarget.value
              if (v !== (item.note ?? '')) onEdit(item.id, { note: v })
            }}
            className="timeline-input flex-1 min-w-0 rounded-lg text-[11px]"
          />
        </div>
      </div>
    </div>
  )
}

/* ---------- Page component ---------- */

export default function TripPage() {
  const params = useParams<{ tripId: string | string[] }>()
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId
  const { data: session } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const [visibleDays, setVisibleDays] = React.useState(1)
  const [isRenaming, setIsRenaming] = React.useState(false)

  const qc = useQueryClient()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const tripQ = useQuery({ queryKey: ['trip', tripId], queryFn: () => fetchTrip(tripId), enabled: !!tripId })
  const tripDaysFromDates = React.useMemo(
    () => computeTripDays(tripQ.data?.trip?.start_date, tripQ.data?.trip?.end_date),
    [tripQ.data?.trip?.start_date, tripQ.data?.trip?.end_date],
  )
  const itemsQ = useQuery({
    queryKey: ['trip-items', tripId],
    queryFn: () => fetchItems(tripId),
    enabled: !!tripId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  })

  const [nameDraft, setNameDraft] = React.useState<string>('')
  React.useEffect(() => {
    setNameDraft(tripQ.data?.trip?.name ?? '')
  }, [tripQ.data?.trip?.name])

  const renameMut = useMutation({
    mutationFn: (name: string) => renameTrip(tripId, name, email!),
    onMutate: async (name) => {
      await qc.cancelQueries({ queryKey: ['trip', tripId] })
      const prev = qc.getQueryData<{ trip: Trip }>(['trip', tripId])
      if (prev) qc.setQueryData(['trip', tripId], { trip: { ...prev.trip, name } })
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['trip', tripId], ctx.prev)
      toast('Rename failed')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['trip', tripId] })
      setIsRenaming(false)
    },
    onSuccess: () => toast('Trip renamed'),
  })

  const editMut = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<Pick<TripItem, 'day' | 'note'>> }) =>
      patchItem(tripId, vars.id, email!, vars.patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ['trip-items', tripId] })
      const prev = qc.getQueryData<{ items: TripItem[] }>(['trip-items', tripId])
      if (prev) {
        const items = prev.items.map((it) => (it.id === id ? { ...it, ...patch } as TripItem : it))
        qc.setQueryData(['trip-items', tripId], { items })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['trip-items', tripId], ctx.prev)
      toast('Update failed')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['trip-items', tripId] }),
  })

  const delMut = useMutation({
    mutationFn: (itemId: string) => deleteItem(tripId, itemId, email!),
    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: ['trip-items', tripId] })
      const prev = qc.getQueryData<{ items: TripItem[] }>(['trip-items', tripId])
      if (prev) {
        qc.setQueryData(['trip-items', tripId], { items: prev.items.filter((x) => x.id !== itemId) })
      }
      return { prev }
    },
    onError: (_e, _itemId, ctx) => {
      if (ctx?.prev) qc.setQueryData(['trip-items', tripId], ctx.prev)
      toast('Delete failed')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['trip-items', tripId] }),
  })

  const reorderMut = useMutation({
    mutationFn: (vars: { day: number; order: string[] }) => reorderDay(tripId, vars.day, vars.order, email!),
    onMutate: async ({ day, order }) => {
      await qc.cancelQueries({ queryKey: ['trip-items', tripId] })
      const prev = qc.getQueryData<{ items: TripItem[] }>(['trip-items', tripId])
      if (prev) {
        const other = prev.items.filter((it) => it.day !== day || !order.includes(it.id))
        const dest = order
          .map((id) => prev.items.find((x) => x.id === id))
          .filter(Boolean)
          .map((x) => ({ ...(x as TripItem), day }))
        const next = [...other, ...dest].sort((a, b) =>
          a.day === b.day
            ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            : a.day - b.day
        )
        qc.setQueryData(['trip-items', tripId], { items: next })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['trip-items', tripId], ctx.prev)
      toast('Reorder failed')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['trip-items', tripId] }),
  })

  const items = React.useMemo(
    () => itemsQ.data?.items ?? EMPTY_ITEMS,
    [itemsQ.data?.items]
  )
  const byDay = React.useMemo(() => groupByDay(items), [items])
  const highestItemDay = React.useMemo(
    () => items.reduce((max, item) => Math.max(max, item.day ?? 1), 1),
    [items]
  )

  React.useEffect(() => {
    const baseline = Math.max(tripDaysFromDates, highestItemDay)
    setVisibleDays((prev) => (prev < baseline ? baseline : prev))
  }, [highestItemDay, tripDaysFromDates])

  const ensureDayVisible = React.useCallback((day: number) => {
    if (!Number.isFinite(day)) return
    setVisibleDays((prev) => (day > prev ? day : prev))
  }, [])

  const dayList = React.useMemo(
    () => Array.from({ length: visibleDays }, (_, i) => i + 1),
    [visibleDays]
  )

  const handleAddDay = React.useCallback(() => {
    setVisibleDays((prev) => prev + 1)
  }, [])

  const handleRemoveDay = React.useCallback((day: number) => {
    if (!email) return toast('Please sign in.')
    const itemsInDay = byDay[day] ?? []

    if (itemsInDay.length > 0 && day !== 1) {
      for (const item of itemsInDay) {
        editMut.mutate({ id: item.id, patch: { day: 1 } })
      }
      toast(`Moved ${itemsInDay.length} place(s) to Day 1`)
    }

    setVisibleDays((prev) => Math.max(1, prev - 1))

    const itemsAbove = items.filter((it) => it.day > day)
    for (const item of itemsAbove) {
      editMut.mutate({ id: item.id, patch: { day: item.day - 1 } })
    }
  }, [byDay, items, email, editMut])

  const onDragEnd = (e: DragEndEvent) => {
    if (!email) return toast('Please sign in.')
    const activeId = String(e.active.id)
    const overId = e.over?.id ? String(e.over.id) : null
    if (!overId) return

    const sourceDay = findItemDay(byDay, activeId)
    if (!sourceDay) return

    let destDay: number | null = null
    if (overId.startsWith('day-')) {
      destDay = Number(overId.slice(4))
    } else {
      destDay = findItemDay(byDay, overId)
    }
    if (!destDay) return

    const destIds = (byDay[destDay] ?? []).map((x) => x.id)
    ensureDayVisible(destDay)

    if (overId.startsWith('day-')) {
      const next = sourceDay === destDay
        ? arrayMove(destIds, destIds.indexOf(activeId), destIds.length - 1)
        : [...destIds, activeId]
      reorderMut.mutate({ day: destDay, order: next })
      return
    }

    const overIndex = destIds.indexOf(overId)
    let nextIds: string[]
    if (sourceDay === destDay) {
      nextIds = arrayMove(destIds, destIds.indexOf(activeId), overIndex)
    } else {
      const insertAt = Math.max(0, overIndex)
      nextIds = [
        ...destIds.slice(0, insertAt),
        activeId,
        ...destIds.slice(insertAt),
      ]
    }
    reorderMut.mutate({ day: destDay, order: nextIds })
  }

  if (tripQ.isLoading || itemsQ.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded bg-slate-200 dark:bg-white/10" />
        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-white/10" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border p-6 space-y-3" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
              <div className="h-5 w-3/5 rounded bg-slate-200 dark:bg-white/10" />
              <div className="h-4 w-2/5 rounded bg-slate-200 dark:bg-white/10" />
              <div className="h-4 w-4/5 rounded bg-slate-200 dark:bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (tripQ.isError || itemsQ.isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="content-card flex flex-col items-center gap-4 py-12 text-center">
          <div className="rounded-full p-3" style={{ background: 'rgba(var(--error) / 0.1)' }}>
            <AlertTriangle className="h-6 w-6 text-[rgb(var(--error))]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[rgb(var(--text))]">Couldn&apos;t load this trip</h3>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">Check your connection and try again.</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => { tripQ.refetch(); itemsQ.refetch() }} className="btn btn-primary">Try again</button>
            <Link href="/dashboard/trips" className="btn">Back to trips</Link>
          </div>
        </div>
      </div>
    )
  }

  const tripName = cleanTripName(tripQ.data?.trip?.name ?? 'Trip')

  return (
    <main className="space-y-6 p-4 md:p-6">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--muted))]" aria-label="Breadcrumb">
        <Link href="/dashboard" className="transition hover:text-[rgb(var(--text))]">Dashboard</Link>
        <span aria-hidden>/</span>
        <Link href="/dashboard/trips" className="transition hover:text-[rgb(var(--text))]">My Trips</Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-[rgb(var(--text))]" aria-current="page">{tripName}</span>
      </nav>

      {/* Header */}
      <div className="content-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {isRenaming ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Trip name"
                  className="input-surface w-56 text-lg font-semibold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const n = nameDraft.trim()
                      if (!n || !email) return
                      renameMut.mutate(n)
                    }
                    if (e.key === 'Escape') {
                      setNameDraft(tripQ.data?.trip?.name ?? '')
                      setIsRenaming(false)
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const n = nameDraft.trim()
                    if (!n || !email) return
                    renameMut.mutate(n)
                  }}
                  disabled={renameMut.isPending}
                  className="rounded-lg p-2 text-green-500 transition hover:bg-green-500/10"
                  title="Save"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setNameDraft(tripQ.data?.trip?.name ?? '')
                    setIsRenaming(false)
                  }}
                  className="rounded-lg p-2 text-[rgb(var(--muted))] transition hover:bg-[var(--glass-bg-hover)]"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[rgb(var(--text))] md:text-3xl">{tripName}</h1>
                <button
                  onClick={() => setIsRenaming(true)}
                  className="rounded-lg p-1.5 text-[rgb(var(--muted))] transition hover:bg-[var(--glass-bg-hover)] hover:text-[rgb(var(--text))]"
                  title="Rename trip"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tripQ.data?.trip && (
              <ShareButton
                tripId={tripQ.data.trip.id}
                initialPublic={!!tripQ.data.trip.is_public}
                initialShareId={tripQ.data.trip.share_id ?? null}
              />
            )}
            <Link
              href={`/dashboard?addToTrip=${encodeURIComponent(tripId)}`}
              className="btn btn-primary rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <Compass className="h-3.5 w-3.5" />
              Add places
            </Link>
            <Link
              href={`/dashboard/diary?tripId=${encodeURIComponent(tripId)}&tripName=${encodeURIComponent(tripName)}`}
              className="btn btn-ghost rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <NotebookPen className="h-3.5 w-3.5" />
              Diary
            </Link>
            <Link href="/dashboard/trips" className="btn btn-ghost rounded-xl px-3 py-2 text-xs font-semibold">
              <Home className="h-3.5 w-3.5" />
              My Trips
            </Link>
          </div>
        </div>

        {/* Trip stats */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[rgb(var(--muted))]">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1" style={{ borderColor: 'var(--glass-border)' }}>
            <MapPin className="h-3 w-3" />
            {items.length} {items.length === 1 ? 'place' : 'places'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1" style={{ borderColor: 'var(--glass-border)' }}>
            {visibleDays} {visibleDays === 1 ? 'day' : 'days'}
          </span>
          {tripQ.data?.trip?.start_date && tripQ.data?.trip?.end_date && (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1" style={{ borderColor: 'var(--glass-border)' }}>
              {new Date(tripQ.data.trip.start_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              {' – '}
              {new Date(tripQ.data.trip.end_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div
          className="flex flex-col items-center gap-5 rounded-2xl border-2 border-dashed py-16 text-center"
          style={{ borderColor: 'rgba(var(--accent) / 0.3)', background: 'rgba(var(--accent) / 0.04)' }}
        >
          <div className="relative">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(var(--accent) / 0.15)' }}
            >
              <MapPinned className="h-8 w-8 text-[rgb(var(--accent))]" />
            </div>
            <div
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full text-white"
              style={{ background: 'rgb(var(--accent))' }}
            >
              <Plus className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-[rgb(var(--text))]">Start building your itinerary</h3>
            <p className="mx-auto max-w-sm text-sm text-[rgb(var(--muted))]">
              Search for restaurants, attractions, and hidden gems to add to your trip.
            </p>
          </div>
          <Link
            href={`/dashboard?addToTrip=${encodeURIComponent(tripId)}`}
            className="btn btn-primary rounded-2xl px-6 py-3 text-sm font-semibold"
          >
            <Compass className="h-4 w-4" />
            Discover places
          </Link>
        </div>
      )}

      {/* Itinerary board header */}
      <div
        className="flex items-center justify-between gap-3 rounded-2xl border px-5 py-4"
        style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'rgba(var(--accent) / 0.12)' }}
          >
            <CalendarDays className="h-5 w-5 text-[rgb(var(--accent))]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[rgb(var(--text))]">Itinerary board</h2>
            <p className="text-[11px] text-[rgb(var(--muted))]">Drag and drop to organize your days</p>
          </div>
        </div>
        <button
          onClick={handleAddDay}
          className="btn btn-primary rounded-xl px-4 py-2.5 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" />
          Add day
        </button>
      </div>

      {/* Day columns */}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dayList.map((day) => {
            const list = byDay[day] ?? []
            const ids = list.map((i) => i.id)
            const canRemove = visibleDays > 1
            return (
              <DayColumn
                key={day}
                day={day}
                itemCount={list.length}
                canRemove={canRemove}
                onRemoveDay={handleRemoveDay}
              >
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {list.length === 0 && (
                    <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center" style={{ borderColor: 'rgba(var(--accent) / 0.2)', background: 'rgba(var(--accent) / 0.03)' }}>
                      <MapPin className="h-5 w-5 text-[rgb(var(--accent))] opacity-50" />
                      <p className="text-xs text-[rgb(var(--muted))]">Drop places here</p>
                    </div>
                  )}
                  {list.map((it) => (
                    <ItemRow
                      key={it.id}
                      item={it}
                      maxDay={visibleDays}
                      ensureDayVisible={ensureDayVisible}
                      onDelete={(id) => {
                        if (!email) return toast('Please sign in.')
                        delMut.mutate(id)
                      }}
                      onEdit={(id, patch) => {
                        if (!email) return toast('Please sign in.')
                        editMut.mutate({ id, patch })
                      }}
                    />
                  ))}
                </SortableContext>
              </DayColumn>
            )
          })}
        </div>
      </DndContext>
    </main>
  )
}
