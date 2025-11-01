# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY smart-travel-frontend/apps/web/package.json smart-travel-frontend/apps/web/package.json

RUN pnpm install --filter @smart-travel/web... --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @smart-travel/web... build
RUN pnpm prune --prod

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/smart-travel-frontend/apps/web/package.json ./
COPY --from=build /app/smart-travel-frontend/apps/web/next.config.mjs ./next.config.mjs
COPY --from=build /app/smart-travel-frontend/apps/web/.next ./.next
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
