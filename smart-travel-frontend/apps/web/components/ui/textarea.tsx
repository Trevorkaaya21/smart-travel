'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn('textarea-surface w-full min-h-[120px] p-3', className)}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'
