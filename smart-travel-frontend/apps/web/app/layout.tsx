// apps/web/app/layout.tsx
import './globals.css'
import Providers from '@/components/providers'

export const metadata = { title: 'Smart Travel', description: 'Plan smarter trips' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className="min-h-screen antialiased transition-colors">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
