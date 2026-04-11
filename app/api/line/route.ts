import {
  LINE_SIGNATURE_HTTP_HEADER_NAME,
  validateSignature,
  webhook,
} from "@line/bot-sdk";
import { handleLineEvents } from "@/lib/line/handleLineEvent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelSecret || !channelAccessToken) {
    return new Response("LINE env not configured", { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get(LINE_SIGNATURE_HTTP_HEADER_NAME);

  if (!signature || !validateSignature(rawBody, channelSecret, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body: webhook.CallbackRequest;
  try {
    body = JSON.parse(rawBody) as webhook.CallbackRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const events = body.events ?? [];

  try {
    await handleLineEvents(events, channelAccessToken);
  } catch {
    return new Response("Handler error", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
