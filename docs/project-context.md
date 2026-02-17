# Project Context

Status date: 2026-02-17

This file is the source of truth for platform/repository identity details that are easy to mix up.

## Canonical names and scopes

- Product/project name: `Kwielford`
- Local folder path: `/Users/andygott/sites/kwielford`

## GitHub

- Org: `EMT`
- Repository: `EMT/kwielford`
- Remote URL: `https://github.com/EMT/kwielford.git`

## Vercel

- Team (scope): `fieldwork`
- Project: `kwielford-api`
- Production domain: `https://kwielford.com`
- Vercel default domain: `https://kwielford-api.vercel.app`

## Important note

GitHub org and Vercel team names are intentionally different in this setup:

- GitHub uses `EMT`
- Vercel uses `fieldwork`

When running CLI commands, always pass the correct scope for the platform.

## Operational examples

- GitHub repo creation/push target: `EMT/kwielford`
- Vercel pull/link target: `fieldwork/kwielford-api`
