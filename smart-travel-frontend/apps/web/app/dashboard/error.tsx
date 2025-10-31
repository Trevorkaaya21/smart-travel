'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="p-6">
      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
        <div className="text-sm opacity-80 mb-4">{error.message || 'Please try again.'}</div>
        <button
          onClick={reset}
          className="btn"
        >
          Retry
        </button>
      </div>
    </main>
  )
}