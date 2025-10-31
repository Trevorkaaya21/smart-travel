import { useState } from 'react'
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, SafeAreaView, RefreshControl } from 'react-native'
import { Link } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { aiSearch } from '../src/lib/api'
import type { Place } from '../src/types'
import { PlaceCard } from '../src/components/PlaceCard'

const SUGGESTIONS = [
  '48 hours in Lisbon for foodies',
  'Cozy coffee crawl in Seoul',
  'Sunrise hikes near Cape Town',
  'Live music weekend in Austin'
]

export default function DiscoverScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])

  const searchMutation = useMutation({
    mutationFn: aiSearch,
    onSuccess: (data) => setResults(data.items ?? []),
  })

  async function onSearch(input?: string) {
    const text = (input ?? query).trim()
    if (!text) return
    setQuery(text)
    await searchMutation.mutateAsync({ query: text })
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050713' }}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            tintColor="#ffffff"
            refreshing={searchMutation.isPending}
            onRefresh={() => onSearch(query)}
          />
        }
        ListHeaderComponent={
          <View style={{ padding: 20, gap: 18 }}>
            <View style={{ gap: 6 }}>
              <Text style={{ color: '#A3AED0', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' }}>
                Discover
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700' }}>
                Search the world with Smart Travel
              </Text>
              <Text style={{ color: '#C7D2FE', fontSize: 14, lineHeight: 20 }}>
                Describe the vibe, budget, or must-have experiences and we will fetch curated places powered by Google Maps and AI intent refinement.
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Try “family weekend in Barcelona”"
                placeholderTextColor="#94A3B8"
                autoCapitalize="sentences"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: '#FFFFFF',
                  borderRadius: 18,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(148, 163, 184, 0.35)'
                }}
                returnKeyType="search"
                onSubmitEditing={() => onSearch()}
              />
              <Pressable
                onPress={() => onSearch()}
                disabled={searchMutation.isPending}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#6D28D9' : '#7C3AED',
                  paddingVertical: 14,
                  borderRadius: 18,
                  alignItems: 'center',
                  opacity: searchMutation.isPending ? 0.6 : 1
                })}
              >
                {searchMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>Search</Text>
                )}
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SUGGESTIONS.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => onSearch(suggestion)}
                  style={({ pressed }) => ({
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: 'rgba(148,163,184,0.3)',
                    backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)'
                  })}
                >
                  <Text style={{ color: '#E2E8F0', fontSize: 12 }}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>

            <Link href="/trips" style={{ color: '#A855F7', fontWeight: '600', fontSize: 14 }}>
              View my trips →
            </Link>
          </View>
        }
        renderItem={({ item }) => (
          <PlaceCard place={item} />
        )}
        ListEmptyComponent={
          searchMutation.isPending ? null : (
            <View style={{ padding: 20 }}>
              <Text style={{ color: '#94A3B8', textAlign: 'center' }}>
                Search above to see curated recommendations.
              </Text>
            </View>
          )
        }
        ListFooterComponent={<View style={{ height: 32 }} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      />
    </SafeAreaView>
  )
}
