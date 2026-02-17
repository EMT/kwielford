# Kwielford Channel-Agnostic Architecture

Status date: 2026-02-17

## Product position

Kwielford is a general AI assistant. Slack is the first communication channel, not the product boundary.

## Architecture principle

Use a layered model so channels stay thin:

1. Core domain (`what Kwielford does`)
- Task contracts, planning/execution logic, permission and audit model.
- No Slack-specific payloads, formatting, or API types.

2. Application services (`how tasks run`)
- Use-case orchestration (`queue run`, `execute run`, `persist`, `emit events`).
- Depends on interfaces, not channel SDKs.

3. Channel adapters (`how users talk to Kwielford`)
- Protocol parsing, signature verification, channel UX updates, and outbound messages.
- Maps channel payloads to application commands and maps outputs back to channel UX.

4. Delivery/runtime (`where code is hosted`)
- Route handlers, workflow runtime, CLI command process, deploy wiring.

## Current boundary map (repo)

### Core domain

- `packages/core/src/tasks/thread-summary.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/config/src/index.ts`

Notes:
- `summarizeThread` is channel-agnostic.
- `formatThreadSummaryText` is a neutral plain-text formatter.
- Slack-specific rendering lives in `apps/slack/src/formatters/thread-summary.ts`.

### Application services

- `packages/app/src/thread-summary-flow.ts`

Notes:
- Thread summary orchestration has been moved to a channel-agnostic package.
- API routes and Slack adapter now import app-level contracts from `@kwielford/app`.

### Slack channel adapter

Inbound and protocol:
- `apps/slack/src/inbound/thread-summary-command-handler.ts`
- `apps/slack/src/inbound/assistant-events-handler.ts`
- `apps/slack/src/parsers/slash-command.ts`
- `apps/slack/src/security/verify-slack-signature.ts`

Outbound and channel UX:
- `apps/slack/src/adapters/slack-web-api.ts`
- `apps/slack/src/formatters/thread-summary.ts`
- `apps/slack/manifest.ai-assistant.yaml`

### Delivery/runtime wiring

- `apps/api/src/routes/slack-thread-summary-command.ts`
- `apps/api/src/routes/slack-assistant-events.ts`
- `apps/api/app/api/slack/thread-summary/route.ts`
- `apps/api/app/api/slack/assistant/events/route.ts`
- `apps/api/src/adapters/vercel-workflow-thread-summary-dispatcher.ts`
- `apps/api/src/workflows/thread-summary-workflow.ts`
- `apps/cli/src/cli.ts`

## Boundary gaps to close

1. More task flows need to move into `@kwielford/app` as they are introduced.
2. Permission and policy checks should become explicit app-layer contracts before adding new high-impact actions.
3. Workspace/user identity resolution for channels should be standardized behind app-layer interfaces.

## Recommended refactor sequence

1. Continue building `packages/app` (introduced on 2026-02-17) as the channel-agnostic application layer.
- Keep task orchestration and use-case contracts in this package.

2. Keep `@kwielford/slack` strictly as channel adapter.
- Keep only Slack signature, parsers, Slack Web API client, Slack-specific response formatting, manifest assets.

3. Keep channel-specific rendering in adapters.
- Keep `packages/core` focused on task output structures and channel-neutral helpers.

4. Standardize adapter contracts per task.
- Inbound contract: `ChannelCommand -> ApplicationCommand`.
- Outbound contract: `ApplicationResult -> ChannelResponse`.

5. Add next adapters without core changes.
- Web app, email, or voice adapters should implement the same command/result contracts.

## Near-term definition of done

For each new task (summary, drafting, extraction):

- Core and app layers compile without channel dependencies.
- Slack adapter translates to/from those contracts.
- CLI uses the same app contracts.
- Audit events include `triggerSource` and actor metadata independent of channel.
