# Channel-Agnostic Architecture

## Goal

Keep Kwielford assistant behavior channel-neutral while channel adapters provide transport-specific wiring.

## Current Scope

1. Improvement planning conversations.
2. Incremental access rollout planning across channels/tools.

## Package Boundaries

- `apps/api`
  - Receives Slack assistant events.
  - Verifies signatures and forwards events to Slack inbound handlers.
- `apps/slack`
  - Implements Slack Web API adapter.
  - Handles assistant thread lifecycle and replies.
- `packages/core`
  - Provides shared health/runtime utilities.
- `packages/db`
  - Provides data models and repositories.

## Event Flow

1. Slack sends assistant event to `/api/slack/assistant/events`.
2. API verifies request signature.
3. Assistant inbound handler chooses response mode (roadmap/topic/access).
4. Slack adapter posts reply and optional UX updates (title/suggested prompts).

## Design Rules

- Keep channel-specific parsing and API calls inside `apps/slack`.
- Keep API route modules thin wrappers with no product logic.
- Keep assistant response strategy explicit and testable in inbound handlers.
