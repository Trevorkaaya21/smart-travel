
import Sidebar from '@/components/shell/sidebar'

export const metadata = { title: 'Dashboard • Smart Travel' }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto grid max-w-6xl grid-cols-[280px_1fr] gap-6 p-6">
      <aside className="sticky top-6 h-[calc(100dvh-3rem)]">
        <Sidebar />
      </aside>
      <main>{children}</main>
    </section>
  )
}