# Environment Configuration

This monorepo contains separate runtime environments:

1. **API service** (`smart-travel-backend/services/api`)
2. **Next.js web app** (`smart-travel-frontend/apps/web`)
3. **Expo mobile app** (`smart-travel-mobile`)

Each package has an environment template that should be copied, renamed, and populated before running locally or in CI.

| Package | Local file | Template | Key variables |
| --- | --- | --- | --- |
| API | `.env` | `.env.docker.example` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, `SUPABASE_STORAGE_BUCKET`, `GOOGLE_AI_STUDIO_API_KEY`, `GOOGLE_PLACES_API_KEY` |
| Web | `.env.local` | `.env.local` (already example) / `.env.docker` | `NEXTAUTH_URL`, `NEXT_PUBLIC_API_URL`, Google OAuth client/secret |
| Mobile | `.env` | `.env.example` | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SITE_URL`, `EXPO_PUBLIC_GOOGLE_MAPS_KEY` |

## Supabase

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE` are required for the API to access the database and storage bucket.
- Ensure a storage bucket named `diary-photos` exists (or update `SUPABASE_STORAGE_BUCKET` accordingly).

## Google OAuth / Maps / Places

- Web app requires Google OAuth credentials for NextAuth.
- Maps/Places keys are used by both web and mobile clients.
- Gemini (AI Studio) key is used server side for itinerary generation.

## Notes

- Example files are **never** committed with real secrets.
- Docker-specific envs (`.env.docker`) should contain production-safe values and can be overridden per deployment environment.
