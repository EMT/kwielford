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

  return {
    appEnv: runtime.appEnv,
    slackSigningSecret: getRequiredEnv("SLACK_SIGNING_SECRET"),
    slackBotToken: getRequiredEnv("SLACK_BOT_TOKEN"),
    llmApiKey: getOptionalEnv("LLM_API_KEY"),
    llmModel: getOptionalEnv("LLM_MODEL") ?? "gpt-4.1-mini",
    llmBaseUrl: getOptionalEnv("LLM_BASE_URL") ?? "https://api.openai.com/v1",
    llmTimeoutMs: parsePositiveInt(getOptionalEnv("LLM_TIMEOUT_MS"), 20_000),
    llmTemperature: parseTemperature(getOptionalEnv("LLM_TEMPERATURE"), 0.2)
  };
}
