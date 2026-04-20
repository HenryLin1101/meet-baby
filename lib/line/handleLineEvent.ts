import { messagingApi, webhook } from "@line/bot-sdk";
import path from "path";
import { getCommandByName, normalizeText, routeCommand } from "@/lib/line/commandRouter";
import {
  clearConversationState,
  getConversationState,
  setConversationState,
  type ConversationState,
} from "@/lib/conversation/state";
import type {
  CommandContext,
  ConversationUpdate,
  QuickReplyOption,
} from "@/lib/modules/types";
import { buildLiffUrl } from "@/lib/liff/utils";

type LineEvent = webhook.Event;
type LineMessageEvent = Extract<LineEvent, { type: "message" }>;

const WELCOME_ON_FOLLOW = "歡迎加入好友！有問題隨時傳訊息給我。";
const WELCOME_ON_JOIN = "大家好！我已加入此聊天室，請多指教。";
const COMMAND_NOT_FOUND = "我目前看不懂這個指令，請輸入 /help。";



const CANCEL_KEYWORDS = new Set(["cancel", "取消"]);
const CANCEL_QUICK_REPLY: QuickReplyOption = { label: "取消", text: "取消" };

/** 在群組中沒有 @ 也能喚醒機器人的別名。 */
const BOT_ALIASES = ["米特寶寶", "米特", "米寶", "肥特寶寶", "肥寶"] as const;
const WINDOW_LOCATION_ORIGIN = "https://meet-baby.vercel.app";

function createMessagingClient(channelAccessToken: string) {
  return new messagingApi.MessagingApiClient({ channelAccessToken });
}

function textMessage(text: string, quickReplies?: QuickReplyOption[]) {
  if (!quickReplies || quickReplies.length === 0) {
    return { type: "text" as const, text };
  }
  return {
    type: "text" as const,
    text,
    quickReply: {
      items: quickReplies.map((qr) => ({
        type: "action" as const,
        action: qr.uri
          ? { type: "uri" as const, label: qr.label, uri: qr.uri }
          : { type: "message" as const, label: qr.label, text: qr.text },
      })),
    },
  };
}

function buildFallbackFlexMessage(): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: COMMAND_NOT_FOUND,
    contents: {
      "type": "bubble",
      "size": "kilo",
      "body": {
        "type": "box",
        "layout": "horizontal",
        "spacing": "10px",
        "backgroundColor": "#2C3439",
        "paddingAll": "15px",
        "alignItems": "center",
        "contents": [
          {
            "type": "box",
            "layout": "vertical",
            "cornerRadius": "12px",
            "alignItems": "center",
            "flex": 1,
            "contents": [
              {
                "type": "box",
                "layout": "baseline",
                "justifyContent": "center",
                "contents": [
                  {
                    "type": "icon",
                    "url": WINDOW_LOCATION_ORIGIN + "/icons/calendar_add_on.png",
                    "size": "35px",
                    "scaling": true
                  }
                ]
              },
              {
                "type": "text",
                "text": "預約會議",
                "size": "sm",
                "weight": "bold",
                "color": "#8CE1E6",
                "margin": "8px",
                "align": "center",
                "wrap": true
              }
            ],
            "action": {
              "type": "uri",
              "label": "action",
              "uri": buildLiffUrl("/liff/meeting") ?? ""
            }
          },
          {
            "type": "box",
            "layout": "vertical",
            "cornerRadius": "12px",
            "alignItems": "center",
            "flex": 1,
            "contents": [
              {
                "type": "box",
                "layout": "baseline",
                "justifyContent": "center",
                "contents": [
                  {
                    "type": "icon",
                    "url": WINDOW_LOCATION_ORIGIN + "/icons/dashboard.png",
                    "size": "35px",
                    "scaling": true
                  }
                ]
              },
              {
                "type": "text",
                "text": "儀表板",
                "size": "sm",
                "weight": "bold",
                "color": "#8CE1E6",
                "margin": "8px",
                "align": "center",
                "wrap": true
              }
            ],
            "action": {
              "type": "uri",
              "label": "action",
              "uri": buildLiffUrl("/liff/dashboard") ?? ""
            }
          },
          {
            "type": "box",
            "layout": "vertical",
            "cornerRadius": "12px",
            "alignItems": "center",
            "flex": 1,
            "contents": [
              {
                "type": "box",
                "layout": "baseline",
                "justifyContent": "center",
                "contents": [
                  {
                    "type": "icon",
                    "url": WINDOW_LOCATION_ORIGIN + "/icons/calendar_month.png",
                    "size": "35px",
                    "scaling": true
                  }
                ]
              },
              {
                "type": "text",
                "text": "查看日曆",
                "size": "sm",
                "weight": "bold",
                "color": "#8CE1E6",
                "margin": "8px",
                "align": "center",
                "wrap": true
              }
            ],
            "action": {
              "type": "uri",
              "label": "action",
              "uri": buildLiffUrl("/liff/calendar") ?? ""
            }
          }
        ]
      }
    }
  }
}

/** 若訊息 @ 到本機器人，回傳剝掉該段後的文字；否則回傳 null。 */
function stripBotMention(message: webhook.TextMessageContent): string | null {
  if (!message.mention) return null;
  const self = message.mention.mentionees.find(
    (m) => m.type === "user" && m.isSelf
  );
  if (!self || typeof self.index !== "number" || typeof self.length !== "number") {
    return null;
  }
  const start = self.index;
  const end = start + self.length;
  return (message.text.slice(0, start) + message.text.slice(end)).trim();
}

/** 若文字以別名開頭，回傳去前綴後的文字；否則回傳 null。 */
function stripBotAlias(text: string): string | null {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  // 長別名優先，避免「米特寶寶」被「米特」先吃掉
  const aliases = [...BOT_ALIASES].sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    if (lower.startsWith(alias.toLowerCase())) {
      return trimmed.slice(alias.length).trim();
    }
  }
  return null;
}

/**
 * 判斷是否被叫到，並回傳乾淨的指令文字。
 * - addressed：是否有 @ 或以別名開頭
 * - text：去掉 @ / 別名後的內容（不論 addressed，都可安全拿去後續比對 / routing）
 */
function resolveAddress(message: webhook.TextMessageContent): {
  addressed: boolean;
  text: string;
} {
  const afterMention = stripBotMention(message);
  if (afterMention !== null) {
    // @ 後的文字若仍以別名開頭，一併剝掉
    return { addressed: true, text: stripBotAlias(afterMention) ?? afterMention };
  }
  const afterAlias = stripBotAlias(message.text);
  if (afterAlias !== null) {
    return { addressed: true, text: afterAlias };
  }
  return { addressed: false, text: message.text.trim() };
}

function buildConversationKey(event: LineMessageEvent): string | null {
  const source = event.source;
  if (!source) return null;
  if (source.type === "group") return `group:${source.groupId}:${source.userId ?? "anon"}`;
  if (source.type === "room") return `room:${source.roomId}:${source.userId ?? "anon"}`;
  if (source.type === "user") return `user:${source.userId}`;
  return null;
}

function buildContext(rawText: string): CommandContext {
  return {
    rawText,
    normalizedText: normalizeText(rawText),
    args: [],
  };
}

function applyUpdate(
  conversationKey: string,
  commandName: string,
  update: ConversationUpdate
): void {
  if (!update.next) return;
  if (update.next === "end") {
    clearConversationState(conversationKey);
    return;
  }
  setConversationState(conversationKey, {
    commandName,
    step: update.next.step,
    data: update.next.data,
  });
}

async function reply(
  client: messagingApi.MessagingApiClient,
  replyToken: string,
  text: string,
  quickReplies?: QuickReplyOption[]
) {
  await client.replyMessage({
    replyToken,
    messages: [textMessage(text, quickReplies)],
  });
}

async function replyFlex(
  client: messagingApi.MessagingApiClient,
  replyToken: string,
  message: messagingApi.FlexMessage
) {
  await client.replyMessage({
    replyToken,
    messages: [message],
  });
}

function injectCancelQuickReply(
  quickReplies: QuickReplyOption[] | undefined
): QuickReplyOption[] {
  const existing = quickReplies ?? [];
  const hasCancel = existing.some(
    (qr) =>
      typeof qr.text === "string" &&
      CANCEL_KEYWORDS.has(qr.text.trim().toLowerCase())
  );
  return hasCancel ? existing : [...existing, CANCEL_QUICK_REPLY];
}

async function replyUpdate(
  client: messagingApi.MessagingApiClient,
  replyToken: string,
  update: ConversationUpdate,
  willBeInFlow: boolean
) {
  const quickReplies = willBeInFlow
    ? injectCancelQuickReply(update.quickReplies)
    : update.quickReplies;
  await reply(client, replyToken, update.reply, quickReplies);
}

/** 處理已在多輪流程中的下一則訊息；回傳是否已處理。 */
async function handleContinuedConversation(
  client: messagingApi.MessagingApiClient,
  event: LineMessageEvent,
  conversationKey: string,
  activeState: ConversationState,
  rawText: string
): Promise<boolean> {
  const cmd = getCommandByName(activeState.commandName);
  if (!cmd?.continueConversation) {
    clearConversationState(conversationKey);
    return false;
  }

  const update = await cmd.continueConversation(activeState, buildContext(rawText));
  applyUpdate(conversationKey, cmd.name, update);
  // 多輪回覆中，除非明確結束，否則仍在流程裡 → 加上取消按鈕
  const willBeInFlow = update.next !== "end";
  if (event.replyToken) {
    await replyUpdate(client, event.replyToken, update, willBeInFlow);
  }
  return true;
}

async function handleTextMessage(
  client: messagingApi.MessagingApiClient,
  event: LineMessageEvent
): Promise<void> {
  if (event.message.type !== "text") return;
  const token = event.replyToken;
  if (!token) return;

  const { addressed, text: cleanedText } = resolveAddress(event.message);
  const conversationKey = buildConversationKey(event);
  const activeState = conversationKey ? getConversationState(conversationKey) : null;

  // 全域 cancel：有對話就清掉；沒對話就忽略
  if (CANCEL_KEYWORDS.has(normalizeText(cleanedText))) {
    if (conversationKey && activeState) {
      clearConversationState(conversationKey);
      await reply(client, token, "已取消目前的流程。");
    }
    return;
  }

  // 已在多輪對話中：不要求 mention，直接交給該 command 繼續（cleanedText 已去掉 @/別名）
  if (conversationKey && activeState) {
    const handled = await handleContinuedConversation(
      client,
      event,
      conversationKey,
      activeState,
      cleanedText
    );
    if (handled) return;
  }

  // 新對話：必須有叫到 bot（@ 或別名）才會觸發
  if (!addressed) return;

  const routed = routeCommand(cleanedText);
  if (!routed) {
    await replyFlex(client, token, buildFallbackFlexMessage());
    return;
  }

  const update = await routed.command.start(routed.context);
  if (conversationKey) {
    applyUpdate(conversationKey, routed.command.name, update);
  }
  const willBeInFlow = !!update.next && update.next !== "end";
  await replyUpdate(client, token, update, willBeInFlow);
}

type LineEventHandler = (
  client: messagingApi.MessagingApiClient,
  event: LineEvent
) => Promise<void>;

const eventHandlers: Partial<Record<LineEvent["type"], LineEventHandler>> = {
  follow: async (client, event) => {
    if (event.type !== "follow") return;
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [textMessage(WELCOME_ON_FOLLOW)],
    });
  },
  join: async (client, event) => {
    if (event.type !== "join") return;
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [textMessage(WELCOME_ON_JOIN)],
    });
  },
  message: async (client, event) => {
    if (event.type !== "message") return;
    await handleTextMessage(client, event);
  },
};

/**
 * 處理單一 Webhook 事件。
 */
export async function handleLineEvent(
  client: messagingApi.MessagingApiClient,
  event: LineEvent
): Promise<void> {
  // 後台「聊天」啟用時事件常為 standby，此時 reply 多數會被 LINE 拒絕（400）
  if (event.mode === "standby") return;

  const handler = eventHandlers[event.type];
  if (!handler) return;
  await handler(client, event);
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
