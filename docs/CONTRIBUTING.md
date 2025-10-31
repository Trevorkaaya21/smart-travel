# Contributing Guide

## Branching & Workflow

- Default branches: `main` (production) and `develop` (integration).
- Create feature branches off `develop`: `feature/<name>`, `fix/<issue>`, `chore/<task>`.
- Keep branches focused; submit PRs early for review.

## Commit Style

- Prefer [Conventional Commits](https://www.conventionalcommits.org/#summary):
  - `feat: add mobile discover screen`
  - `fix(api): handle storage upload failures`
  - `chore: update dependencies`
- Rebase merges are preferred over merge commits to keep history linear.

## Pull Request Checklist

- [ ] `pnpm install` (if dependencies changed)
- [ ] `pnpm lint` (or targeted `pnpm --filter <pkg> lint`)
- [ ] Tests updated or added where applicable
- [ ] Docs/README updated if behaviour changed
- [ ] No secrets checked in (`git diff` should show no `.env` changes)

## Coding Guidelines

- TypeScript strict mode is enabled; fix type errors rather than suppressing them.
- Use shared utilities/components from `smart-travel-frontend/packages/*` when possible.
- Keep server routes consistent with existing REST pattern (`/v1/...`).
- For React Query, ensure query keys include relevant inputs (`['trip-items', tripId]`).

## Secrets & Access

- Never commit real keys. Use `.env.*.example` templates.
- If new environment variables are required, document them in `docs/ENVIRONMENT.md`.

## Release Process

1. Merge feature branch into `develop`.
2. Run CI (lint + tests) and address failures.
3. Create a PR from `develop` to `main` for each release.
4. Tag releases (e.g., `v1.0.0`) once deployed.
