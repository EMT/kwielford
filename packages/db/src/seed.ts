import { createDb } from "./client.js";
import { workspaces } from "./schema.js";

function getRequiredEnv(name: string): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const value = env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  return env[name] || undefined;
}

export interface SeedWorkspaceInput {
  name: string;
  slug: string;
  slackTeamId?: string;
}

export async function seedWorkspace(input: SeedWorkspaceInput): Promise<string> {
  const db = createDb();

  const rows = await db
    .insert(workspaces)
    .values({
      name: input.name,
      slug: input.slug,
      slackTeamId: input.slackTeamId ?? null
    })
    .onConflictDoUpdate({
      target: workspaces.slug,
      set: {
        name: input.name,
        slackTeamId: input.slackTeamId ?? null,
        updatedAt: new Date()
      }
    })
    .returning({
      id: workspaces.id
    });

  const workspace = rows[0];
  if (!workspace) {
    throw new Error("Failed to seed workspace.");
  }

  return workspace.id;
}

async function main(): Promise<void> {
  const workspaceName = getRequiredEnv("SEED_WORKSPACE_NAME");
  const workspaceSlug = getRequiredEnv("SEED_WORKSPACE_SLUG");
  const slackTeamId = getOptionalEnv("SEED_SLACK_TEAM_ID");

  const workspaceId = await seedWorkspace({
    name: workspaceName,
    slug: workspaceSlug,
    slackTeamId
  });

  console.log(`Seeded workspace: ${workspaceId}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown seed error";
    console.error(message);
    process.exitCode = 1;
  });
}
