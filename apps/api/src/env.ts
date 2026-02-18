import { getRuntimeConfig } from "@kwielford/config";

export interface ApiConfig {
  appEnv: ReturnType<typeof getRuntimeConfig>["appEnv"];
  slackSigningSecret: string;
  slackBotToken: string;
}

function getRequiredEnv(name: string): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const value = env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getApiConfig(): ApiConfig {
  const runtime = getRuntimeConfig();

  return {
    appEnv: runtime.appEnv,
    slackSigningSecret: getRequiredEnv("SLACK_SIGNING_SECRET"),
    slackBotToken: getRequiredEnv("SLACK_BOT_TOKEN")
  };
}
