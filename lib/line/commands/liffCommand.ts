import {
  CommandHandlerBase,
  type ConversationUpdate,
} from "@/lib/modules/types";
import { buildLiffUrl, MISSING_LIFF_ENV_MSG } from "@/lib/liff/utils";

export class LiffCommand extends CommandHandlerBase {
  readonly name = "liff";
  readonly keywords = ["liff", "表單", "form"] as const;

  start(): ConversationUpdate {
    const url = buildLiffUrl("/liff/dashboard");
    if (!url) {
      return {
        reply: MISSING_LIFF_ENV_MSG,
      };
    }
    return {
      reply: `Dashboard：\n${url}`,
      quickReplies: [{ label: "開啟 Dashboard", uri: url }],
    };
  }
}
