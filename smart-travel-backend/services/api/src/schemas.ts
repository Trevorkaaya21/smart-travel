/**
 * Input validation schemas (OWASP: validate all inputs, reject unexpected fields).
 * All user input is schema-based with type checks and length limits.
 * Use .strip() to reject unknown keys and prevent mass assignment.
 */

import { z } from 'zod'

/** Max lengths to prevent DoS and abuse */
const LIMITS = {
  stringShort: 100,
  stringMedium: 500,
  stringLong: 10_000,
  bodyMax: 50_000,
  query: 200,
  email: 254,
  uuid: 36,
} as const

/** Email: format + length */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(LIMITS.email)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/i, 'invalid_email')

/** UUID v4 pattern (used by schemas that extend with .refine etc.) */
const _uuidSchema = z.string().uuid().max(LIMITS.uuid)

/** Optional string with limit */
const str = (max: number = LIMITS.stringShort) => z.string().trim().max(max).optional()

/** Required string with limit */
const strRequired = (max: number = LIMITS.stringShort) => z.string().trim().min(1).max(max)

// --- AI ---
export const aiSearchBodySchema = z
  .object({
    q: strRequired(300),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    radius: z.number().int().min(100).max(50_000).optional(),
    profile: z.record(z.unknown()).optional(),
  })
  .strict()

export const aiSuggestBodySchema = z
  .object({
    prompt: strRequired(LIMITS.stringLong),
  })
  .strict()

// --- Trips ---
export const tripsPostBodySchema = z
  .object({
    name: strRequired(200).default('New Trip'),
  })
  .strict()

export const tripItemsPostBodySchema = z
  .object({
    place_id: strRequired(500),
    day: z.number().int().min(1).max(365).optional(),
    note: str(LIMITS.stringMedium).optional(),
    place: z
      .object({
        id: z.string().max(500),
        name: z.string().max(200).optional(),
        category: z.string().max(100).optional(),
        rating: z.number().nullable().optional(),
        lat: z.number().nullable().optional(),
        lng: z.number().nullable().optional(),
        photo: z.string().max(2000).nullable().optional(),
        photo_credit: z.string().max(200).nullable().optional(),
      })
      .passthrough()
      .optional(),
  })
  .strict()

// --- Favorites ---
export const favoritesBodySchema = z
  .object({
    place_id: strRequired(500),
    place: z.record(z.unknown()).optional(),
  })
  .strict()

// --- Profile ---
export const profilePutBodySchema = z
  .object({
    display_name: str(120).nullable().optional(),
    home_base: str(200).nullable().optional(),
    bio: str(LIMITS.stringMedium).nullable().optional(),
    avatar_url: z.string().url().max(2000).nullable().optional(),
    travel_name: z.string().trim().max(80).regex(/^[a-zA-Z0-9_-]*$/, 'travel_name_alphanumeric').nullable().optional(),
  })
  .strict()

export const profileAvatarBodySchema = z
  .object({
    image: z.string().min(50).max(2_000_000),
  })
  .strict()

// --- Chat ---
const chatOtherUserSchema = z
  .object({
    other_email: str(LIMITS.email).optional(),
    otherEmail: str(LIMITS.email).optional(),
    other_travel_name: str(80).optional(),
    other_travelName: str(80).optional(),
  })
  .strict()
  .refine(
    (d) =>
      (d.other_email ?? d.otherEmail) ||
      (d.other_travel_name ?? d.other_travelName),
    { message: 'other_user_required' }
  )

export { chatOtherUserSchema as chatConversationsPostBodySchema }

export const chatMessagesPostBodySchema = z
  .object({
    body: str(LIMITS.stringLong).optional(),
    message: str(LIMITS.stringLong).optional(),
  })
  .strict()
  .transform((d) => (d.body ?? d.message ?? '').trim())
  .refine((s) => s.length > 0, { message: 'body_required' })
  .refine((s) => s.length <= LIMITS.stringLong, { message: 'body_too_long' })

// --- Query params ---
export const profileGetQuerySchema = z.object({
  email: emailSchema,
})

export const usersSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(LIMITS.query),
})

export const placeImageQuerySchema = z.object({
  q: strRequired(200),
})

export const tripsGetQuerySchema = z.object({
  owner_email: emailSchema,
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

/** Parse body and return 400 with clear error if invalid */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  return schema.parse(body)
}

/** Parse query and return 400 with clear error if invalid */
export function parseQuery<T>(schema: z.ZodType<T>, query: unknown): T {
  return schema.parse(query)
}
