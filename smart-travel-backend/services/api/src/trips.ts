import { supa } from './supabase'

export async function getOrCreateDefaultTrip(ownerEmail: string) {
  const email = ownerEmail.toLowerCase()
  const { data: existing, error: e1 } = await supa
    .from('trips').select('*').eq('owner_email', email)
    .order('created_at', { ascending: true }).limit(1)
  if (e1) throw e1
  if (existing?.length) return existing[0]

  const { data, error: e2 } = await supa
    .from('trips').insert({ owner_email: email, name: 'My Trip' })
    .select('*').single()
  if (e2) throw e2
  return data
}

