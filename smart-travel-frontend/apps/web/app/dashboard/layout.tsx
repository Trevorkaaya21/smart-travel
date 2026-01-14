// apps/web/app/dashboard/layout.tsx
import Sidebar from '@/components/shell/sidebar'

export const metadata = { title: 'Smart Travel • Dashboard' }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-6 md:flex-row md:px-8 lg:pt-10">
      <div 
        className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-700"
        style={{
          background: `
            radial-gradient(circle at top left, rgba(var(--accent) / .12), transparent 50%),
            radial-gradient(circle at bottom right, rgba(139, 92, 246, .1), transparent 55%),
            radial-gradient(circle at center, rgba(59, 130, 246, .08), transparent 60%)
          `
        }}
      />
      <div className="md:sticky md:top-10 md:h-[calc(100dvh-5rem)] md:w-[320px] md:shrink-0">
        <Sidebar />
      </div>
      <main className="content-shell flex-1">
        {children}
      </main>
    </section>
  )
}
