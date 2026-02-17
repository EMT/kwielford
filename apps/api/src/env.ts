import { getRuntimeConfig } from "@kweilford/config";

export interface ApiConfig {
  appEnv: ReturnType<typeof getRuntimeConfig>["appEnv"];
  slackSigningSecret: string;
  slackBotToken: string;
  allowedSlashCommands: string[];
  defaultWorkspaceId?: string;
}

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

function parseAllowedCommands(raw: string | undefined): string[] {
  const value = raw ?? "/kweilford-summary";
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getApiConfig(): ApiConfig {
  const runtime = getRuntimeConfig();

  return {
    appEnv: runtime.appEnv,
    slackSigningSecret: getRequiredEnv("SLACK_SIGNING_SECRET"),
    slackBotToken: getRequiredEnv("SLACK_BOT_TOKEN"),
    allowedSlashCommands: parseAllowedCommands(getOptionalEnv("SLACK_ALLOWED_COMMANDS")),
    defaultWorkspaceId: getOptionalEnv("DEFAULT_WORKSPACE_ID")
  };
}
