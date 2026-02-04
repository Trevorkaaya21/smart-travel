import Sidebar from '@/components/shell/sidebar'
import { BackendHealthBanner } from '@/components/ui/backend-health-banner'

export const metadata = { title: 'Smart Travel • Dashboard' }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative min-h-[100dvh] w-full bg-[rgb(var(--bg))] transition-colors duration-300">
      {/* Theme-aware fixed background */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[rgb(var(--bg))] transition-colors duration-300"
        aria-hidden
      >
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(245,158,11,0.06),transparent_60%)] dark:opacity-100 opacity-80"
          aria-hidden
        />
      </div>

      <div className="relative flex min-h-[100dvh] w-full flex-col gap-6 px-4 pb-10 pt-6 md:flex-row md:px-6 lg:px-8 lg:pt-8">
        <div className="md:sticky md:top-8 md:h-[calc(100dvh-4rem)] md:w-[280px] md:shrink-0">
          <Sidebar />
        </div>
        <main className="content-shell min-w-0 flex-1">
          <BackendHealthBanner />
          {children}
        </main>
      </div>
    </section>
  )
}
