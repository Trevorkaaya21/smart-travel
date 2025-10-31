export type Place = {
  id: string
  name: string
  category?: string | null
  rating?: number | null
  lat?: number | null
  lng?: number | null
  photo_url?: string | null
  because?: string | null
  photo_credit?: string | null
}

export type Trip = {
  id: string
  name: string
  owner_email: string
  created_at: string
}
