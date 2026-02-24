/**
 * Utility functions for trip images and user display
 */

/**
 * Extract location from trip name and fetch relevant image from Unsplash
 * Examples:
 * - "Boston • Feb 19, 2026" → "boston"
 * - "Trip to Miami Design District" → "miami"
 * - "Washington • Feb 5, 2026" → "washington"
 */
export function extractLocationFromTripName(tripName: string): string {
  // Remove date patterns like "• Feb 19, 2026"
  let location = tripName.replace(/[•·]\s*\w+\s+\d+,?\s+\d{4}/g, '').trim()
  
  // Remove "Trip to" prefix
  location = location.replace(/^trip\s+to\s+/i, '').trim()
  
  // Take first meaningful word (usually the location)
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
