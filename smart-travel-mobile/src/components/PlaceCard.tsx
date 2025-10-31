import { View, Text, Image, Pressable } from 'react-native'
import type { Place } from '../types'

type Props = {
  place: Place
  onPress?: () => void
}

export function PlaceCard({ place, onPress }: Props) {
  const image =
    place.photo_url ??
    `https://images.unsplash.com/placeholder-photos/extra-large.jpg?auto=format&fit=crop&w=900&q=80`

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        overflow: 'hidden',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: pressed ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginBottom: 16
      })}
    >
      <Image
        source={{ uri: image }}
        accessibilityLabel={place.name}
        style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: '#0f172a' }}
      />
      <View style={{ padding: 16, gap: 6 }}>
        <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>{place.name}</Text>
        <Text style={{ color: '#A5B4FC', fontSize: 12 }}>
          {(place.category ?? 'point of interest').toString()}
          {place.rating ? ` · ★ ${place.rating.toFixed(1)}` : ''}
        </Text>
        {place.because ? (
          <Text style={{ color: '#CBD5F5', fontSize: 12 }}>{place.because}</Text>
        ) : null}
      </View>
    </Pressable>
  )
}
