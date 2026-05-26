import { Client } from "@upstash/qstash";
import { getAppBaseUrlOrThrow } from "@/lib/qstash/client";
import {
  resolveAutoSummaryFirstScanTime,
  resolveAutoSummaryRetryDelaySeconds,
} from "@/lib/summaries/schedule";

export type SummaryJobPayload = {
  summaryId: number;
};

export type TactiqScanJobPayload = {
  eventId: number;
  attempt?: number;
};

export type PublishedTactiqScanJob = {
  messageId: string;
  scheduledAt: string;
};

export type PublishedSummaryJob = {
  messageId: string;
};

function getQStashTokenOrThrow(): string {
  const token = process.env.QSTASH_TOKEN?.trim();
  if (!token) {
    throw new Error("QSTASH_TOKEN 尚未設定。");
  }
  return token;
}

function createQStashClient(): Client {
  return new Client({ token: getQStashTokenOrThrow() });
}

export function getSummaryCallbackUrl(): string {
  return new URL("/api/qstash/summary", getAppBaseUrlOrThrow()).toString();
}

export function getTactiqScanCallbackUrl(): string {
  return new URL("/api/qstash/tactiq-scan", getAppBaseUrlOrThrow()).toString();
}

export async function publishSummaryJob(
  payload: SummaryJobPayload
): Promise<PublishedSummaryJob> {
  const client = createQStashClient();
  const response = await client.publishJSON<SummaryJobPayload>({
    url: getSummaryCallbackUrl(),
    body: payload,
    // run ASAP; keeping consistent with reminders which rely on QStash scheduling too
    delay: 1,
  });

  const messageId =
    typeof (response as { messageId?: unknown }).messageId === "string"
      ? String((response as { messageId: string }).messageId)
      : null;
  if (!messageId) {
    throw new Error("QStash 回傳缺少 messageId，無法追蹤摘要任務。");
  }

  return { messageId };
}

export async function publishTactiqScanJob(input: {
  eventId: number;
  attempt?: number;
  startsAt?: string;
  endsAt?: string | null;
  delaySeconds?: number;
}): Promise<PublishedTactiqScanJob> {
  const client = createQStashClient();
  const attempt = input.attempt ?? 1;

  let notBefore: number | undefined;
  let scheduledAt: Date;

  if (input.delaySeconds !== undefined) {
    scheduledAt = new Date(Date.now() + input.delaySeconds * 1000);
    notBefore = Math.floor(scheduledAt.getTime() / 1000);
  } else if (attempt <= 1 && input.startsAt) {
    scheduledAt = resolveAutoSummaryFirstScanTime(input.startsAt, input.endsAt ?? null);
    notBefore = Math.floor(scheduledAt.getTime() / 1000);
  } else {
    const delaySec = resolveAutoSummaryRetryDelaySeconds();
    scheduledAt = new Date(Date.now() + delaySec * 1000);
    notBefore = Math.floor(scheduledAt.getTime() / 1000);
  }

  const response = await client.publishJSON<TactiqScanJobPayload>({
    url: getTactiqScanCallbackUrl(),
    body: { eventId: input.eventId, attempt },
    notBefore,
  });

  const messageId =
    typeof (response as { messageId?: unknown }).messageId === "string"
      ? String((response as { messageId: string }).messageId)
      : null;
  if (!messageId) {
    throw new Error("QStash 回傳缺少 messageId，無法追蹤 Tactiq 掃描任務。");
  }

  return { messageId, scheduledAt: scheduledAt.toISOString() };
}

export async function cancelTactiqScanJob(messageId: string): Promise<void> {
  const trimmed = messageId.trim();
  if (!trimmed) return;
  const client = createQStashClient();
  await client.messages.cancel(trimmed);
}

