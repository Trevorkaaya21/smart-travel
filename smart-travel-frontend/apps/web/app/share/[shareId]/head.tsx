import { API_BASE } from '@/lib/configure'

export default async function Head({ params }: { params: { shareId: string } }) {
  const url = `${API_BASE}/v1/share/${params.shareId}`
  let title = 'Shared Trip'
  let description = 'View this shared Smart Travel itinerary.'

  try {
    const r = await fetch(url, { cache: 'no-store' })
    if (r.ok) {
      const json = await r.json()
      title = json?.trip?.name ? `${json.trip.name} • Shared Trip` : title
      const count = Array.isArray(json?.items) ? json.items.length : 0
      description = `An itinerary with ${count} item${count === 1 ? '' : 's'}.`
    }
  } catch {
    // fall back to defaults
  }

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
    </>
  )
}