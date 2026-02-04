# Smart Travel

A multi-platform travel planning app that helps you discover places, build itineraries, and share trips with friends. Search for restaurants, clubs, hotels, or pretty much any place anywhere in the world.

---

## What's Inside

- **Web app** – Next.js 14 with AI-powered place discovery, trip planning, favorites, and a travel diary
- **API** – Fastify backend with Supabase for data, Groq for AI, and free place search (Foursquare + OpenStreetMap)
- **Mobile** – Expo app for iOS and Android, synced with your trips and favorites

Everything runs in a single pnpm workspace so you can lint, build, and run from the root.

---

## Project Structure

```
smart-travel/
├── smart-travel-frontend/apps/web    # Next.js web app
├── smart-travel-backend/services/api # Fastify API
├── smart-travel-mobile               # Expo mobile app
└── docker-compose.yml                # Local containers
```

---

## Tech Stack

**Web** – Next.js 14, React 18, TanStack Query, NextAuth, Tailwind, Lucide icons

**API** – Fastify, TypeScript, Supabase, Zod validation, rate limiting, input sanitization

**Mobile** – Expo Router, React Native, React Query, NativeWind

**Place search** – Foursquare (when configured), OpenStreetMap fallback, Unsplash/Pexels for photos

---

## What's New

- **Universal search** – Find clubs, bars, hotels, restaurants, or any place type. Search naturally: "coffee shops in Paris", "clubs in Miami", "sushi Tokyo"
- **Faster responses** – Caching for geocoding and search results so repeat queries come back quickly
- **Better UX** – Skeleton loading, empty states with clear next steps, and accessibility improvements
- **PWA-ready** – Manifest and metadata so the web app feels more like a native app
- **Scalability** – Pagination on trips, performance indexes, and health checks that verify DB connectivity

---

## Prerequisites

- **Node.js 20** – Expo still needs Node 20 (`nvm use 20` works well)
- **pnpm 9** – `corepack enable` and you're set
- **Supabase CLI** – For local DB and migrations
- **Docker** – For container builds (optional for local dev)

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Run the API (port 4000)
pnpm --filter @smart-travel/api dev

# Run the web app (port 3000) – in another terminal
pnpm --filter @smart-travel/web dev

# Run the mobile app – in another terminal
pnpm --filter @smart-travel/mobile start
```

**Handy commands:**

```bash
pnpm lint        # Lint everything (matches CI)
pnpm typecheck   # Type check
pnpm db:push     # Apply database migrations
pnpm db:seed     # Seed demo data
```

> If the Expo dev server acts up after switching Node versions, try `expo start -c` to clear the Metro cache.

---

## Docker

Build and run with Docker:

```bash
docker compose build
docker compose up
```

Images use multi-stage builds and `pnpm prune --prod` for lean output. The web image includes the compiled Next.js build and the new `public/` assets (e.g. PWA manifest).

---

## CI / CD

GitHub Actions run on push and PR:

1. **Lint & typecheck** – On push to `main` or `develop`, and on pull requests
2. **Build & publish images** – On push to `main`, builds and pushes API and web Docker images to GHCR

Run `pnpm lint` and `pnpm typecheck` before pushing to keep CI green.

---

## Quick QA Checklist

- **Web** – Trip creation, drag-and-drop reordering, chat, collaborator invites
- **API** – Run `pnpm db:push` so migrations are applied before testing
- **Mobile** – Discover and Trips screens; point the app at your local API URL for the emulator

---

## Roadmap

- ✅ Lint, typecheck, and Docker builds stable
- ✅ Universal place search with free APIs
- ✅ Caching, pagination, and performance tweaks
- ⬜ Automated tests (unit + integration)

---

## Tips

```bash
# Clean Turbo cache
pnpm dlx turbo prune

# Lint a single package
pnpm --filter @smart-travel/api lint
pnpm --filter @smart-travel/web lint
pnpm --filter @smart-travel/mobile lint
```

