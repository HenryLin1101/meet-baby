import {
  CommandHandlerBase,
  type ConversationUpdate,
} from "@/lib/modules/types";

function buildLiffUrl(): string | null {
  const id = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  return id ? `https://liff.line.me/${id}` : null;
}

export class LiffCommand extends CommandHandlerBase {
  readonly name = "liff";
  readonly keywords = ["liff", "表單", "form"] as const;

  start(): ConversationUpdate {
    const url = buildLiffUrl();
    if (!url) {
      return {
        reply: "尚未設定 LIFF，請先在伺服器環境變數加入 NEXT_PUBLIC_LIFF_ID。",
      };
    }
    return {
      reply: `預約會議表單：\n${url}`,
      quickReplies: [{ label: "開啟表單", uri: url }],
    };
  }
}
