import { useState } from 'react'
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, SafeAreaView } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { fetchTrips } from '../src/lib/api'
import type { Trip } from '../src/types'

export default function TripsScreen() {
  const [email, setEmail] = useState('')
  const [trips, setTrips] = useState<Trip[]>([])

  const tripMutation = useMutation({
    mutationFn: fetchTrips,
    onSuccess: (data) => setTrips(data.trips ?? []),
  })

  async function loadTrips() {
    const trimmed = email.trim()
    if (!trimmed) return
    await tripMutation.mutateAsync(trimmed)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050713', padding: 20 }}>
      <View style={{ gap: 12 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>My Trips</Text>
        <Text style={{ color: '#C7D2FE', fontSize: 14 }}>
          Enter the email associated with your Smart Travel account to load synchronized itineraries.
        </Text>
      </View>

      <View style={{ marginTop: 20, gap: 12 }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@example.com"
          placeholderTextColor="#94A3B8"
          style={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            color: '#FFFFFF',
            borderRadius: 18,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            borderWidth: 1,
            borderColor: 'rgba(148,163,184,0.35)'
          }}
        />
        <Pressable
          onPress={loadTrips}
          disabled={tripMutation.isPending}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#6D28D9' : '#7C3AED',
            paddingVertical: 14,
            borderRadius: 18,
            alignItems: 'center',
            opacity: tripMutation.isPending ? 0.6 : 1
          })}
        >
          {tripMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>Sync Trips</Text>
          )}
        </Pressable>
      </View>

      {tripMutation.isError ? (
        <Text style={{ color: '#F87171', marginTop: 16 }}>Unable to load trips. Verify the email and try again.</Text>
      ) : null}

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              marginTop: 18,
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(148,163,184,0.25)',
              backgroundColor: 'rgba(255,255,255,0.08)'
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>{item.name}</Text>
            <Text style={{ color: '#A5B4FC', marginTop: 4, fontSize: 12 }}>
              Created {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          tripMutation.isPending ? null : (
            <Text style={{ color: '#94A3B8', marginTop: 32, textAlign: 'center' }}>
              Trips will appear here after you synchronize.
            </Text>
          )
        }
      />
    </SafeAreaView>
  )
}
