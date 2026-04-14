import { messagingApi, webhook } from "@line/bot-sdk";
import { routeCommand } from "@/lib/line/commandRouter";

type LineEvent = webhook.Event;

const WELCOME_ON_FOLLOW = "歡迎加入好友！有問題隨時傳訊息給我。";
const WELCOME_ON_JOIN = "大家好！我已加入此聊天室，請多指教。";
const COMMAND_NOT_FOUND = "我目前看不懂這個指令，請輸入 help 或 /help。";

function createMessagingClient(channelAccessToken: string) {
  return new messagingApi.MessagingApiClient({ channelAccessToken });
}

function textMessage(text: string) {
  return { type: "text" as const, text };
}

function isBotMentioned(
  message: webhook.TextMessageContent
): boolean {
  if (!message.mention) return false;
  return message.mention.mentionees.some((mentionee) => mentionee.type === "user" && mentionee.isSelf);
}

/**
 * 處理單一 Webhook 事件（Follow / Join 歡迎訊息、文字訊息回聲）。
 */
export async function handleLineEvent(
  client: messagingApi.MessagingApiClient,
  event: LineEvent
): Promise<void> {
  // 後台「聊天」啟用時事件常為 standby，此時 reply 多數會被 LINE 拒絕（400）
  if (event.mode === "standby") {
    return;
  }

  switch (event.type) {
    case "follow":
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [textMessage(WELCOME_ON_FOLLOW)],
      });
      return;
    case "join":
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [textMessage(WELCOME_ON_JOIN)],
      });
      return;
    case "message": {
      const token = event.replyToken;
      if (!token) return;

      if (event.message.type === "text") {
        // Only run commands if bot is mentioned
        if (!isBotMentioned(event.message)) return;

        const routedCommand = routeCommand(event.message.text);
        const replyText = routedCommand
          ? (await routedCommand.handler(routedCommand.context)).text
          : COMMAND_NOT_FOUND;

        await client.replyMessage({
          replyToken: token,
          messages: [textMessage(replyText)],
        });
      }
      return;
    }
    default:
      return;
  }
}

/**
 * 批次處理 Webhook 事件陣列。
 */
export async function handleLineEvents(
  events: LineEvent[],
  channelAccessToken: string
): Promise<void> {
  if (events.length === 0) return;
  const client = createMessagingClient(channelAccessToken);
  await Promise.all(events.map((event) => handleLineEvent(client, event)));
}
