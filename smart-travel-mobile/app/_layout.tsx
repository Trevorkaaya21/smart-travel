import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  const [client] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={client}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#050713' },
          headerTintColor: '#ffffff',
          contentStyle: { backgroundColor: '#050713' }
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Discover' }} />
        <Stack.Screen name="trips" options={{ title: 'My Trips' }} />
      </Stack>
    </QueryClientProvider>
  )
}
