export type AppEnv = "development" | "preview" | "production";

export interface RuntimeConfig {
  appEnv: AppEnv;
}

export function getRuntimeConfig(): RuntimeConfig {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const rawEnv = env.APP_ENV;
  const appEnv: AppEnv =
    rawEnv === "preview" || rawEnv === "production" || rawEnv === "development"
      ? rawEnv
      : "development";

  return { appEnv };
}
