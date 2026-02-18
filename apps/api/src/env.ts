import { getRuntimeConfig } from "@kwielford/config";

export interface ApiConfig {
  appEnv: ReturnType<typeof getRuntimeConfig>["appEnv"];
  slackSigningSecret: string;
  slackBotToken: string;
  llmApiKey?: string;
  llmModel: string;
  llmBaseUrl: string;
  llmTimeoutMs: number;
  llmTemperature: number;
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

function parseTemperature(raw: string | undefined, defaultValue: number): number {
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(1, Math.max(0, parsed));
}

export function getApiConfig(): ApiConfig {
  const runtime = getRuntimeConfig();
  const llmApiKey = getOptionalEnv("AI_GATEWAY_API_KEY");
  const llmModel = getOptionalEnv("AI_GATEWAY_MODEL") ?? "openai/gpt-4.1-mini";
  const llmBaseUrl = getOptionalEnv("AI_GATEWAY_BASE_URL") ?? "https://ai-gateway.vercel.sh/v1/ai";
  const llmTimeoutMs = parsePositiveInt(getOptionalEnv("AI_GATEWAY_TIMEOUT_MS"), 20_000);
  const llmTemperature = parseTemperature(getOptionalEnv("AI_GATEWAY_TEMPERATURE"), 0.2);

  return {
    appEnv: runtime.appEnv,
    slackSigningSecret: getRequiredEnv("SLACK_SIGNING_SECRET"),
    slackBotToken: getRequiredEnv("SLACK_BOT_TOKEN"),
    llmApiKey,
    llmModel,
    llmBaseUrl,
    llmTimeoutMs,
    llmTemperature
  };
}
