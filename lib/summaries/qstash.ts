import { Client } from "@upstash/qstash";
import { getAppBaseUrlOrThrow } from "@/lib/qstash/client";

export type SummaryJobPayload = {
  summaryId: number;
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

  return { messageId: response.messageId };
}

