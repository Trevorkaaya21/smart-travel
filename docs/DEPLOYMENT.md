# Deployment Guide

## Branch Strategy

- `main`: production-ready code. Protected branch with required CI checks.
- `develop`: integration branch for staging. Merge feature branches here first.
- Feature branches: `feature/*`, `fix/*`, `chore/*`.

## GitHub Actions

1. **Lint & Typecheck** (`.github/workflows/ci.yml`)  
   Runs on every PR and push to `main`/`develop`.

2. **Build & Publish Images** (`.github/workflows/docker-build.yml`)  
   Builds API and web Docker images and pushes to GHCR on `main`.
   - Tags: `ghcr.io/<owner>/smart-travel-api:<sha>` and `smart-travel-web:<sha>`
   - Extend to push `latest` tags or staging tags as needed.

## Secrets in GitHub

Configure repository secrets for deployment:

| Secret | Description |
| --- | --- |
| `SUPABASE_URL` | If deploying via Actions directly to infrastructure. |
| `SUPABASE_SERVICE_ROLE` | Required for API container runtime (use deploy keys, not dev). |
| `GOOGLE_AI_STUDIO_API_KEY` | AI Studio key for itinerary generation. |
| `GOOGLE_PLACES_API_KEY` | Used by API for search enrichment. |
| `NEXTAUTH_SECRET` | Secure session secret for NextAuth. |
| `NEXTAUTH_URL` | Public URL for production deployment. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth credentials. |
| `EXPO_ACCESS_TOKEN` | Needed for automated EAS builds (optional). |

Use environment-specific secrets (e.g., `PROD_*`, `STAGING_*`) and map them in Actions or infrastructure templates.

## Hosting Options

| Component | Suggested Hosting |
| --- | --- |
| API (Fastify) | Fly.io, Render, Railway, AWS ECS/EKS, or any Docker-capable host. |
| Web (Next.js) | Vercel (with env variables) or Docker-based host (Fly.io, Render). |
| Mobile | Expo EAS builds (iOS/Android), distributed via TestFlight/Play Store. |

For container deployments using the supplied Dockerfiles:

```bash
# API
docker run -p 4000:4000 \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE=... \
  -e SUPABASE_STORAGE_BUCKET=diary-photos \
  -e GOOGLE_AI_STUDIO_API_KEY=... \
  -e GOOGLE_PLACES_API_KEY=... \
  ghcr.io/<owner>/smart-travel-api:<tag>

# Web
docker run -p 3000:3000 \
  -e NEXTAUTH_URL=https://app.example.com \
  -e NEXTAUTH_SECRET=... \
  -e NEXT_PUBLIC_API_URL=https://api.example.com \
  -e GOOGLE_CLIENT_ID=... \
  -e GOOGLE_CLIENT_SECRET=... \
  ghcr.io/<owner>/smart-travel-web:<tag>
```

Ensure the API is accessible to the web/mobile apps via `NEXT_PUBLIC_API_URL`/`EXPO_PUBLIC_API_URL`.

## Mobile Releases

- Create an Expo EAS project (`eas init`).
- Configure `eas.json` with `development`, `preview`, and `production` profiles.
- Use `expo env:extract` to sync `.env` settings for mobile.
- Trigger builds via `eas build --profile production --platform ios|android` or configure a GitHub Action.

## Monitoring & Alerts

- Add logging/monitoring (e.g., Logtail, Datadog, or open-source alternatives).
- Set up uptime checks for API/web endpoints.
- Consider integrating Sentry for error tracking across web/mobile/API.
