# Smart Travel Monorepo

Smart Travel is a multi-platform travel planning suite composed of:

- A **Next.js 14** web experience with itinerary timelines, trip chat, collaborator invites, and shared dashboards.
- A **Fastify TypeScript API** backed by Supabase for persistence and authentication utilities.
- An **Expo Router mobile companion** targeting iOS/Android with React Query powered data access.
- Shared UI primitives, tailwind configs, and utilities delivered through Turborepo workspaces.

All projects live in a single pnpm workspace so linting, builds, and Docker packaging can be orchestrated from the root.

---

## Repository Layout

```
smart-travel/
├── smart-travel-frontend/apps/web        # Next.js 14 App Router client
├── smart-travel-backend/services/api     # Fastify API service
├── smart-travel-mobile                   # Expo Router mobile app
├── smart-travel-frontend/packages        # Shared UI libs & config
├── docs                                  # Extended docs (env, deployment, roadmap)
└── docker-compose.yml                    # Local container orchestration
```

Recent highlights:

- Trip itinerary UI now enforces correct hook ordering and memoization for predictable renders.
- Trip chat supports collaborator invites with clipboard link sharing and scroll management.
- GitHub Actions lint stage runs against the flat `eslint.config.js` used across all packages.
- Docker images rely on `pnpm prune --prod` for lean outputs without deprecated flags.

---

## Tech Stack

**Web (`apps/web`)**

- Next.js 14 (App Router) + React 18, TanStack Query, NextAuth for OAuth, Tailwind, Lucide icons.
- Turbo-repo build orchestration, ESLint via shared flat config, Prettier optional.

**API (`services/api`)**

- Fastify + TypeScript, Supabase client for data access, Zod validation.
- Built with `pnpm --filter @smart-travel/api... build`, emits to `dist/`.

**Mobile (`smart-travel-mobile`)**

- Expo Router 3, React Native 0.74, React Query, NativeWind styling.
- Linting re-uses root ESLint config (`eslint .`) instead of Expo’s ad-hoc installer.

**Tooling & infra**

- pnpm 9 via Corepack, Turbo 2.x, Node.js 20 baseline (Expo CLI currently requires ≤20).
- Supabase CLI for local Postgres & storage.
- Dockerfiles per service plus GitHub Actions workflows for linting and image builds.

---

## Prerequisites

| Tool                   | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| Node.js 20.x           | `nvm use 20` recommended; Expo tooling is not Node 22 ready.  |
| pnpm 9.x               | Automatically enabled via `corepack enable`.                  |
| Supabase CLI           | Local DB + migrations (`brew install supabase/tap/supabase`). |
| Docker                 | For container builds & GitHub parity.                         |
| Xcode / Android Studio | For running native Expo builds.                               |

---

## Environment Variables

Environment templates live near each package:

| Package | Template                                                      | Destination                 |
| ------- | ------------------------------------------------------------- | --------------------------- |
| API     | `smart-travel-backend/services/api/.env.docker.example`       | `.env`, `.env.docker`       |
| Web     | `smart-travel-frontend/apps/web/.env.example` & `.env.docker` | `.env.local`, `.env.docker` |
| Mobile  | `smart-travel-mobile/.env.example`                            | `.env`                      |

Populate with:

- Supabase project URL, service role key, storage bucket.
- Google OAuth client ID/secret (web).
- Google Maps / Places API key.
- Gemini / Google AI Studio key & model (for AI itinerary features).

Extended guidance: `docs/ENVIRONMENT.md`.

---

## Install & Run

```bash
# Install all workspace deps
pnpm install

# Run everything (in separate shells)
pnpm --filter @smart-travel/api dev       # Fastify API on :4000
pnpm --filter @smart-travel/web dev       # Next dev server on :3000
pnpm --filter @smart-travel/mobile start  # Expo dev menu (requires Node 20)
```

Common scripts:

```bash
pnpm lint          # Workspace lint (mirrors CI)
pnpm typecheck     # Type-only checks
pnpm db:push       # Apply Supabase migrations
pnpm db:seed       # Seed demo data
```

> Expo tip: if dev server fails after switching Node versions, clear Metro cache (`expo start -c`).

---

## Docker & Deployment

Dockerfiles exist for the API and web app; both leverage multi-stage builds with pnpm workspaces:

```bash
docker compose build
docker compose up
```

Notes:

- `pnpm prune --prod` now trims dependencies without deprecated `--filter` flags.
- The web Docker image copies the compiled `.next/` output; there is currently no `public/` directory to copy.
- Ensure `.env.docker` files exist before running compose or CI builds.

Deployment references for Render, Vercel, Fly.io, and Expo EAS live in `docs/DEPLOYMENT.md`.

---

## Continuous Integration

GitHub Actions currently ship two main workflows:

1. **Lint** – runs `pnpm lint` against the workspace flat config (web, API, mobile).
2. **Build & publish images** – builds Docker images for the web and API with the adjusted prune steps.

Before pushing, run `pnpm lint`; this matches the CI gate. For Docker parity, `docker compose build` locally should mirror the pipeline.

---

## QA Notes

- Web: verify trip creation, drag/drop reordering, chat auto-scroll, and collaborator invitations.
- API: confirm Supabase migrations (`db/migrations`) apply cleanly before running.
- Mobile: test Discover and Trips screens, ensure React Query fetches succeed against local API (emulator needs API URL via `.env`).

---

## Roadmap Snapshot

- ✅ Web/API lint & build stability (React hook fixes, pnpm pruning updates).
- ✅ GitHub pipelines for lint + Docker builds (passing after latest changes).
- ✅ Expo lint integration through shared ESLint config.
- ⬜ Automated tests (unit + integration) per package.

For the full backlog, see `docs/ROADMAP.md`.

---

## Useful One-liners

```bash
# Regenerate Next.js types
pnpm --filter @smart-travel/web next telemetry disable

# Clean Turbo cache
pnpm dlx turbo prune

# Targeted linting
pnpm --filter @smart-travel/api lint
pnpm --filter @smart-travel/web lint
pnpm --filter @smart-travel/mobile lint
```
