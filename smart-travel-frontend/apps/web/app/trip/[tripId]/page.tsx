'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { API_BASE } from '@/lib/configure'
import { ShareButton } from '@/components/trip/share-button'
import { TripChatPanel } from '@/components/trip/trip-chat'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Trip = {
  id: string
  name: string | null
  owner_email: string | null
  is_public?: boolean | null
  share_id?: string | null
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
}

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

function DayColumn(props: { day: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${props.day}` })
  return (
    <div
      ref={setNodeRef}
      className={`timeline-column ${isOver ? 'ring-2 ring-indigo-400/40' : ''}`}
    >
      <div className="mb-2 text-sm font-semibold opacity-80">Day {props.day}</div>
      {props.children}
    </div>
  )
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
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="timeline-item"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab select-none rounded-md border border-white/20 px-2 py-1 text-xs opacity-80 hover:opacity-100 active:cursor-grabbing"
          title="Drag to reorder"
        >
          ⠿
        </button>
        <div className="min-w-0">
          <div className="truncate font-medium">{item.name ?? item.place_id}</div>
          <div className="text-xs opacity-70">
            {item.category} · {item.rating ?? '—'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={item.day ?? 1}
          onChange={(e) => {
            const nextDay = Number(e.currentTarget.value)
            ensureDayVisible(nextDay)
            onEdit(item.id, { day: nextDay })
          }}
          className="timeline-select"
          title="Move to day"
        >
          {Array.from({ length: Math.max(maxDay + 1, item.day ?? 1) }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              Day {d}
            </option>
          ))}
        </select>
        <input
          defaultValue={item.note ?? ''}
          placeholder="note…"
          onBlur={(e) => {
            const v = e.currentTarget.value
            if (v !== (item.note ?? '')) onEdit(item.id, { note: v })
          }}
          className="timeline-input w-44"
        />
        <button
          onClick={() => onDelete(item.id)}
          className="btn btn-ghost text-xs"
        >
          Remove
        </button>
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
  const [visibleDays, setVisibleDays] = React.useState(3)

  const qc = useQueryClient()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const tripQ = useQuery({ queryKey: ['trip', tripId], queryFn: () => fetchTrip(tripId), enabled: !!tripId })
  const itemsQ = useQuery({
    queryKey: ['trip-items', tripId],
    queryFn: () => fetchItems(tripId),
    enabled: !!tripId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  })

  /* rename */
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
    onSettled: () => qc.invalidateQueries({ queryKey: ['trip', tripId] }),
    onSuccess: () => toast('Trip renamed'),
  })

  /* edit item (day/note) */
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

  /* delete item */
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

  /* reorder */
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

  const items = itemsQ.data?.items ?? []
  const byDay = groupByDay(items)
  const highestItemDay = React.useMemo(
    () => items.reduce((max, item) => Math.max(max, item.day ?? 1), 1),
    [items]
  )

  React.useEffect(() => {
    const baseline = Math.max(3, highestItemDay)
    setVisibleDays((prev) => (prev < baseline ? baseline : prev))
  }, [highestItemDay])

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
      // dropped into empty space in that day → append
      const next = sourceDay === destDay
        ? arrayMove(destIds, destIds.indexOf(activeId), destIds.length - 1)
        : [...destIds, activeId]
      reorderMut.mutate({ day: destDay, order: next })
      return
    }

    // dropped over an item → insert before that item
    const overIndex = destIds.indexOf(overId)
    let nextIds: string[]
    if (sourceDay === destDay) {
      const from = destIds.indexOf(activeId)
      const to = overIndex
      nextIds = arrayMove(destIds, from, to)
    } else {
      const without = (byDay[sourceDay] ?? []).map((x) => x.id).filter((id) => id !== activeId)
      const insertAt = Math.max(0, overIndex)
      nextIds = [
        ...destIds.slice(0, insertAt),
        activeId,
        ...destIds.slice(insertAt),
      ]
      // source day shrink is handled optimistically in onMutate by only updating destination
      void without // (no-op: explained)
    }

    reorderMut.mutate({ day: destDay, order: nextIds })
  }

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Trip</h1>
          <span className="text-xs opacity-60">{tripId}</span>
        </div>
        <div className="flex items-center gap-2">
          {tripQ.data?.trip && (
            <ShareButton
              tripId={tripQ.data.trip.id}
              initialPublic={!!tripQ.data.trip.is_public}
              initialShareId={tripQ.data.trip.share_id ?? null}
            />
          )}
          <a href="/dashboard" className="btn">
            ← Back
          </a>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          placeholder="Trip name"
          className="w-72"
        />
        <Button
          onClick={() => {
            if (!email) return toast('Please sign in.')
            const n = nameDraft.trim()
            if (!n) return toast('Name is required')
            renameMut.mutate(n)
          }}
          disabled={renameMut.isPending}
        >
          {renameMut.isPending ? 'Saving…' : 'Save name'}
        </Button>
      </div>

      {items.length === 0 && (
        <div className="card">
          No items yet. Go to Dashboard → search → “➕ Add to Trip”.
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[rgb(var(--text))]">Itinerary board</h2>
        <Button
          onClick={handleAddDay}
          className="btn btn-ghost rounded-full px-4 py-2 text-sm font-semibold"
        >
          + Add day
        </Button>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dayList.map((day) => {
            const list = byDay[day] ?? []
            const ids = list.map((i) => i.id)
            return (
              <DayColumn key={day} day={day}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {list.length === 0 && (
                    <div className="timeline-dropzone">
                      Drop here to add to Day {day}
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

      {tripId ? <TripChatPanel tripId={tripId} /> : null}
    </main>
  )
}
