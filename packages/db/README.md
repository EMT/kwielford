# @kwielford/db

Neon + Drizzle data layer for Kwielford.

## Environment

- `DATABASE_URL`: Neon/Postgres connection string.

## Commands

- `pnpm --filter @kwielford/db db:generate`
- `pnpm --filter @kwielford/db db:migrate`
- `pnpm --filter @kwielford/db db:studio`

## Core tables

- `workspaces`
- `users`
- `agent_tasks`
- `agent_runs`
- `messages`
- `audit_events`
