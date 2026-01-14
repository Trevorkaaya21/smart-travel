// apps/web/app/layout.tsx
import './globals.css'
import Providers from '@/components/providers'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export const metadata = { 
  title: 'Smart Travel - Plan Smarter Trips',
  description: 'AI-powered travel planning with Google Maps integration. Create personalized itineraries, discover amazing places, and share your adventures.',
  keywords: 'travel planning, itinerary, AI travel, trip planner, travel app',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#8b5cf6' },
    { media: '(prefers-color-scheme: dark)', color: '#a855f7' }
  ]
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen antialiased">
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}
