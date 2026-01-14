import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[rgb(var(--surface-muted))]/50", className)}
      style={{
        background: 'linear-gradient(90deg, rgba(var(--surface-muted) / .5) 0%, rgba(var(--surface-muted) / .7) 50%, rgba(var(--surface-muted) / .5) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
      {...props}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="content-card space-y-4 animate-fade-in">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </div>
  )
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="content-card animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
          <Skeleton className="h-5 w-2/3 mb-2" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  )
}
