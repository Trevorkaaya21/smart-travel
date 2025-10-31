// apps/web/app/layout.tsx
import './globals.css'
import Providers from '@/components/providers'

export const metadata = { title: 'Smart Travel', description: 'Plan smarter trips' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}