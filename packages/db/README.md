# @kweilford/db

Neon + Drizzle data layer for Kweilford.

## Environment

- `DATABASE_URL`: Neon/Postgres connection string.

## Commands

- `pnpm --filter @kweilford/db db:generate`
- `pnpm --filter @kweilford/db db:migrate`
- `pnpm --filter @kweilford/db db:studio`

## Core tables

- `workspaces`
- `users`
- `agent_tasks`
- `agent_runs`
- `messages`
- `audit_events`
