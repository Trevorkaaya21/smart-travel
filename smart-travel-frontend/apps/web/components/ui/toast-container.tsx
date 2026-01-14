'use client'

import { Toaster } from 'sonner'

export function ToastContainer() {
  return (
    <Toaster
      richColors
      position="top-right"
      toastOptions={{
        style: {
          background: 'linear-gradient(165deg, rgba(var(--surface) / .98), rgba(var(--surface-muted) / .85))',
          border: '1px solid rgba(var(--border) / .5)',
          borderRadius: '1rem',
          backdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: '0 8px 32px rgba(var(--shadow-color) / .15)',
        },
        classNames: {
          success: 'border-[rgb(var(--success))]/30',
          error: 'border-[rgb(var(--error))]/30',
          warning: 'border-[rgb(var(--warning))]/30',
          info: 'border-[rgb(var(--accent))]/30',
        },
      }}
    />
  )
}
