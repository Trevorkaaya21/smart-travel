'use client'

import * as React from 'react'
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { ToastContainer } from '@/components/ui/toast-container'

const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = React.useState(() => new QueryClient(queryClientConfig))

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <SessionProvider>
        <QueryClientProvider client={qc}>
          {children}
          <ToastContainer />
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
