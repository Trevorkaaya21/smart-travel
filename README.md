# Smart Travel Monorepo

A full-stack travel planner featuring:

- **Next.js web app** (`smart-travel-frontend/apps/web`)
- **Fastify API** (`smart-travel-backend/services/api`)
- **Expo mobile app** (`smart-travel-mobile`)
- Shared Tailwind UI + utilities (`smart-travel-frontend/packages/*`)

The project now includes container recipes and mobile scaffolding while preserving the pnpm/Turbo workflow.

---

## 1. Prerequisites

| Tool | Notes |
| --- | --- |
| **Node.js 20** | Recommended via `nvm use 20`. (Expo CLI is not yet compatible with Node 22.) |
| **pnpm 9** | Comes with `corepack enable`. |
| **Supabase CLI** | `brew install supabase/tap/supabase` for local Postgres. |
| **Docker (optional)** | Required for containerized runs (`docker compose`). |
| **Expo CLI** | Installed automatically when running mobile scripts via pnpm. |

---

## 2. Environment Configuration

Environment templates are provided per package:

| Package | Template | Copy to |
| --- | --- | --- |
| API service | `smart-travel-backend/services/api/.env.docker.example` | `.env` (local dev) & `.env.docker` |
| Web app | `smart-travel-frontend/apps/web/.env.local` | `.env.local` & `.env.docker` |
| Mobile app | `smart-travel-mobile/.env.example` | `.env` |

After copying, set:

- Supabase `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, and `SUPABASE_STORAGE_BUCKET`
- Google OAuth client + secret (web)
- Google Maps / Places API keys
- Gemini (Google AI Studio) key + model

Additional notes are available in `docs/ENVIRONMENT.md`.

---

## 3. Installing & Running

```bash
# Install dependencies
pnpm install

# Fastify API (port 4000 by default)
pnpm --filter @smart-travel/api dev

# Next.js web app (port 3000)
pnpm --filter @smart-travel/web dev -- --port 3000

# Expo mobile - requires Node 20 and Expo Go / simulator
pnpm --filter @smart-travel/mobile run start
```

> Tip: if the Expo server fails with a port error, restart under Node 20 (`nvm use 20`) and retry.

Shared scripts:

```bash
# Lint all packages
pnpm lint

# Type-check
pnpm typecheck

# Run targeted commands
pnpm --filter @smart-travel/api lint
pnpm --filter @smart-travel/web lint
```

---

## 4. Docker Workflow

The repo now includes Dockerfiles for the API and web app plus a root compose file.

```bash
docker compose build
docker compose up
```

Ensure `.env.docker` files exist for both services before starting containers.

---

## 5. Git Workflow & Branching

- Default branches: `main` (production) and `develop` (integration).
- Feature work: create feature branches off `develop` (e.g., `feature/mobile-auth`).
- Use conventional commits (`feat:`, `fix:`, etc.) when possible.
- Secrets must never be committed—stick to the provided `.env.*.example` files.

Refer to `docs/CONTRIBUTING.md` for PR checklist and coding standards.

---

## 6. Testing & QA

- Web and API linting via `pnpm lint`.
- Add unit/integration tests under each package (`apps/web`, `services/api`, `mobile`) as they grow.
- Manual checklist: AI search, trip creation, diary photo upload, mobile Discover/Trips screens.

---

## 7. Deployment Overview

Deployment guidance (CI/CD, hosting options, secrets) is captured in `docs/DEPLOYMENT.md`.

At a glance:

- Build + push Docker images from GitHub Actions to a container registry.
- Deploy API on Fly.io / Render / AWS.
- Deploy web app (Next.js) via Vercel or Docker host.
- Expo mobile builds handled through EAS (or CI) with staging/production profiles.

---

## 8. Useful Commands

```bash
# Seeds / migrations (Supabase CLI required)
pnpm db:push    # apply migrations
pnpm db:seed    # optional seed

# Turbo cache clean
pnpm dlx turbo prune
```

---

## 9. Roadmap Snapshot

- ✅ Web & API performance pass
- ✅ Expo mobile scaffold
- ⬜ GitHub CI/CD workflows
- ⬜ Shared chat/itinerary feature

See `docs/ROADMAP.md` for the up-to-date feature backlog.
