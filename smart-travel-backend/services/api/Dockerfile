# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY smart-travel-backend/services/api/package.json smart-travel-backend/services/api/package.json

RUN pnpm install --filter @smart-travel/api... --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @smart-travel/api... build
RUN pnpm prune --prod

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/smart-travel-backend/services/api/package.json ./
COPY --from=build /app/smart-travel-backend/services/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules

EXPOSE 4000
CMD ["node", "dist/server.js"]
