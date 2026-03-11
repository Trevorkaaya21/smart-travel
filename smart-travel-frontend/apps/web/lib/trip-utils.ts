/**
 * Utility functions for trip images and user display
 */

/**
 * Strip date patterns from trip names saved with embedded dates.
 * "Boston • Feb 19, 2026"            → "Boston"
 * "dubai • Feb 24, 2026 - Feb 26, 2026" → "dubai"
 * "Trip to Miami Design District"    → "Trip to Miami Design District"
 */
export function cleanTripName(name: string): string {
  return name
    .replace(/\s*[•·]\s*\w{3,9}\s+\d{1,2},?\s+\d{4}\s*[-–]\s*\w{3,9}\s+\d{1,2},?\s+\d{4}/gi, '')
    .replace(/\s*[•·]\s*\w{3,9}\s+\d{1,2},?\s+\d{4}/gi, '')
    .trim() || name
}

/**
 * Compute trip duration in days from start/end date strings (YYYY-MM-DD).
 * Returns 1 when dates are equal or missing.
 */
export function computeTripDays(start?: string | null, end?: string | null): number {
  if (!start || !end) return 1
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const diff = Math.round((e.getTime() - s.getTime()) / 86_400_000)
  return Math.max(1, diff + 1)
}

/**
 * Extract location keyword from trip name for image lookup.
 */
export function extractLocationFromTripName(tripName: string): string {
  let location = cleanTripName(tripName)

  location = location.replace(/^trip\s+to\s+/i, '').trim()

  const words = location.split(/\s+/)
  const firstWord = words[0] || location

  return firstWord.toLowerCase()
}

/**
 * Generate a fallback image URL for a location
 * Uses a curated Unsplash photo for generic travel imagery
 */
export function getTripImageUrl(tripName: string, width = 800, height = 600): string | null {
  const location = extractLocationFromTripName(tripName)
  
  if (!location || location.length < 2) return null
  
  // Use a high-quality generic travel image from Unsplash
  // This is a fallback - real photos come from Google Places/Foursquare
  return `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=${width}&h=${height}&fit=crop`
}

/**
 * Convert email to display username
 * Examples:
 * - "trevkkaaya@gmail.com" → "Trevkkaaya"
 * - "john.doe@example.com" → "John Doe"
 * - "jane_smith@company.co" → "Jane Smith"
 */
export function emailToUsername(email: string | null | undefined): string {
  if (!email) return 'Guest'
  
  // Get part before @
  const localPart = email.split('@')[0]
  
  // Replace dots and underscores with spaces
  const withSpaces = localPart.replace(/[._-]/g, ' ')
  
  // Capitalize first letter of each word
  const capitalized = withSpaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
  
  return capitalized
}

/**
 * Get initials from email for avatar
 * Examples:
 * - "trevkkaaya@gmail.com" → "T"
 * - "john.doe@example.com" → "JD"
 */
export function getInitialsFromEmail(email: string | null | undefined): string {
  if (!email) return 'G'
  
  const username = emailToUsername(email)
  const words = username.split(' ')
  
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  
  return username.slice(0, 2).toUpperCase()
}
