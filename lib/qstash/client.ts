import { Client } from "@upstash/qstash";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 尚未設定。`);
  }
  return value;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("APP_BASE_URL 尚未設定。");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getAppBaseUrlOrThrow(): string {
  const explicitBaseUrl = process.env.APP_BASE_URL?.trim();
  if (explicitBaseUrl) {
    return normalizeBaseUrl(explicitBaseUrl);
  }

  const productionUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ?? process.env.VERCEL_URL?.trim();
  if (productionUrl) {
    return normalizeBaseUrl(productionUrl);
  }

  throw new Error(
    "APP_BASE_URL 尚未設定，且無法從 Vercel 環境變數推導公開網址。"
  );
}

export function createQStashClient(token = requireEnv("QSTASH_TOKEN")) {
  return new Client({ token });
}

export function getEventReminderCallbackUrl(): string {
  return new URL("/api/qstash/event-reminder", getAppBaseUrlOrThrow()).toString();
}
