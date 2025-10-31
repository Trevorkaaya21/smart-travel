'use client'
import * as React from 'react'

type Toast = { id: number; message: string; sub?: string; duration?: number }
let idCounter = 1
const listeners = new Set<(toasts: Toast[]) => void>()
let queue: Toast[] = []

function emit() {
  for (const l of listeners) l(queue)
}

export function toast(message: string, opts?: { sub?: string; duration?: number }) {
  const t: Toast = { id: idCounter++, message, sub: opts?.sub, duration: opts?.duration ?? 2800 }
  queue = [...queue, t]
  emit()
  const timer = setTimeout(() => {
    queue = queue.filter(x => x.id !== t.id)
    emit()
  }, t.duration)
  // return a dismiss fn if ever needed
  return () => {
    clearTimeout(timer)
    queue = queue.filter(x => x.id !== t.id)
    emit()
  }
}

export function ToastViewport() {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  React.useEffect(() => {
    const sub = (t: Toast[]) => setToasts(t)
    listeners.add(sub)
    return () => { listeners.delete(sub) }
  }, [])

  return (
    <div className="fixed right-4 top-4 z-[100] flex w-[320px] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="btn"
        >
          <div className="text-sm font-medium">{t.message}</div>
          {t.sub && <div className="text-xs opacity-75 mt-0.5">{t.sub}</div>}
        </div>
      ))}
    </div>
  )
}