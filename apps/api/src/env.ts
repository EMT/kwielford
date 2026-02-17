import { getRuntimeConfig } from "@kwielford/config";

export interface ApiConfig {
  appEnv: ReturnType<typeof getRuntimeConfig>["appEnv"];
  slackSigningSecret: string;
  slackBotToken: string;
  allowedSlashCommands: string[];
  defaultWorkspaceId?: string;
  aiGatewayApiKey?: string;
  aiGatewayModel: string;
  aiGatewayBaseUrl: string;
  aiSummaryTimeoutMs: number;
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
  const value = raw ?? "/kwielford-summary";
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parsePositiveInt(raw: string | undefined, defaultValue: number): number {
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
}

export function getApiConfig(): ApiConfig {
  const runtime = getRuntimeConfig();

  return {
    appEnv: runtime.appEnv,
    slackSigningSecret: getRequiredEnv("SLACK_SIGNING_SECRET"),
    slackBotToken: getRequiredEnv("SLACK_BOT_TOKEN"),
    allowedSlashCommands: parseAllowedCommands(getOptionalEnv("SLACK_ALLOWED_COMMANDS")),
    defaultWorkspaceId: getOptionalEnv("DEFAULT_WORKSPACE_ID"),
    aiGatewayApiKey: getOptionalEnv("AI_GATEWAY_API_KEY"),
    aiGatewayModel: getOptionalEnv("AI_GATEWAY_MODEL") ?? "openai/gpt-4.1-mini",
    aiGatewayBaseUrl: getOptionalEnv("AI_GATEWAY_BASE_URL") ?? "https://ai-gateway.vercel.sh/v1",
    aiSummaryTimeoutMs: parsePositiveInt(getOptionalEnv("AI_SUMMARY_TIMEOUT_MS"), 20_000)
  };
}
