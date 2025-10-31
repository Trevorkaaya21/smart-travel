import { supa } from './supabase'

export async function listFavorites(email: string) {
  const { data, error } = await supa
    .from('favorites')
    .select('place_id')
    .eq('user_email', email.toLowerCase())
  if (error) throw error
  return (data ?? []).map(r => r.place_id as string)
}

export async function addFavorite(email: string, placeId: string) {
  const { error } = await supa
    .from('favorites')
    .insert({ user_email: email.toLowerCase(), place_id: placeId })
  if (error && !String(error.message).includes('duplicate key')) throw error
}

export async function removeFavorite(email: string, placeId: string) {
  const { error } = await supa
    .from('favorites')
    .delete()
    .eq('user_email', email.toLowerCase())
    .eq('place_id', placeId)
  if (error) throw error
}
