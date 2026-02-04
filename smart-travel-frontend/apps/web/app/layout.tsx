// apps/web/app/layout.tsx
import './globals.css'
import Providers from '@/components/providers'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export const metadata = {
  title: 'Smart Travel - Plan Smarter Trips',
  description: 'AI-powered travel planning. Discover restaurants, hotels, and attractions. Create itineraries, save favorites, and share your adventures.',
  keywords: 'travel planning, itinerary, AI travel, trip planner, discover places, travel app',
  openGraph: {
    title: 'Smart Travel - Plan Smarter Trips',
    description: 'AI-powered travel planning. Discover places, create itineraries, and share your adventures.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Smart Travel',
    description: 'AI-powered travel planning. Discover places and create itineraries.',
  },
  manifest: '/manifest.json',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen antialiased">
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}
