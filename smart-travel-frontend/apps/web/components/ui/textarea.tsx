'use client'
import * as React from 'react'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`w-full min-h-[120px] rounded-xl border border-slate-300 dark:border-white/15 bg-white/60 dark:bg-white/5 p-3 outline-none focus:ring-2 focus:ring-white/20 ${className}`}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'
