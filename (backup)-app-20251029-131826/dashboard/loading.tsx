export default function Loading() {
    return (
      <main className="p-6 space-y-6 animate-pulse">
        <div className="h-7 w-40 rounded bg-white/80 dark:bg-white/10" />
        <div className="h-10 w-full rounded-2xl bg-white/60 dark:bg-white/5" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/60 dark:bg-white/5 p-4">
              <div className="h-5 w-3/5 rounded bg-white/80 dark:bg-white/10 mb-2" />
              <div className="h-4 w-2/5 rounded bg-white/80 dark:bg-white/10" />
              <div className="h-4 w-4/5 rounded bg-white/80 dark:bg-white/10 mt-3" />
            </div>
          ))}
        </div>
      </main>
    )
  }
  