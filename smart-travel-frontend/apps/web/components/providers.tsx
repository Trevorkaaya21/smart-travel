'use client'

import * as React from 'react'
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { ToastContainer } from '@/components/ui/toast-container'

// Optimized QueryClient configuration for speed and scalability
const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min - fewer refetches for trips, profile, favorites
      gcTime: 15 * 60 * 1000, // 15 min - keep in cache for fast back-navigation
      retry: (failureCount: number, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) return false
        // Retry up to 2 times for network/server errors
        return failureCount < 2
      },
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Reduce unnecessary refetches
      refetchOnReconnect: true,
      refetchOnMount: true,
      // Enable request deduplication
      structuralSharing: true,
    },
    mutations: {
      retry: 1, // Retry mutations once on failure
      retryDelay: 1000,
    },
  },
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // Use useState to ensure QueryClient is only created once per app instance
  const [qc] = React.useState(() => new QueryClient(queryClientConfig))

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="st-theme">
      <SessionProvider>
        <QueryClientProvider client={qc}>
          {children}
          <ToastContainer />
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
