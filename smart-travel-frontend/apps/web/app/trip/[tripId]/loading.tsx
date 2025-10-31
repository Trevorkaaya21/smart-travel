export default function Loading() {
    return (
      <main className="p-6 space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-7 w-48 rounded bg-white/80 dark:bg-white/10" />
          <div className="h-8 w-28 rounded bg-white/80 dark:bg-white/10" />
        </div>
        <div className="h-10 w-72 rounded bg-white/80 dark:bg-white/10" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/60 dark:bg-white/5 p-3">
              <div className="h-4 w-20 rounded bg-white/80 dark:bg-white/10 mb-3" />
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j} className="mb-2 h-11 rounded bg-white/80 dark:bg-white/10" />
              ))}
            </div>
          ))}
        </div>
      </main>
    )
  }