type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: { message?: string };
};

function getOpenAIApiKeyOrThrow(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY 尚未設定。");
  }
  return key;
}

function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
}

export type ActionItem = {
  item: string;
  owner: string;
  due: string;
};

export type MeetingSummary = {
  topic: string;
  bullets: string[];
  decisions: string[];
  actionItems: ActionItem[];
};

export async function summarizeMeetingTranscript(input: {
  title?: string;
  transcript: string;
}): Promise<MeetingSummary> {
  const apiKey = getOpenAIApiKeyOrThrow();
  const model = getOpenAIModel();
  const today = new Date().toISOString().slice(0, 10);

  const transcript = input.transcript.trim();
  if (!transcript) {
    throw new Error("逐字稿內容為空。");
  }

  const schema = {
    name: "meeting_summary",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: { type: "string" },
        bullets: { type: "array", items: { type: "string" } },
        decisions: { type: "array", items: { type: "string" } },
        actionItems: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              item: { type: "string" },
              owner: { type: "string" },
              due: { type: "string" },
            },
            required: ["item", "owner", "due"],
          },
        },
      },
      required: ["topic", "bullets", "decisions", "actionItems"],
    },
  } as const;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You are a helpful assistant that summarizes meeting transcripts in Traditional Chinese. Be concise, factual, and avoid hallucinating. If information is missing, omit it. When speaker names appear in the transcript, use those exact names in owner fields.",
        },
        {
          role: "user",
          content: [
            input.title?.trim()
              ? `會議標題：${input.title.trim()}`
              : "會議標題：未提供",
            `今天日期：${today}（若逐字稿出現相對時間，如「明天 / 下週一」，請以今天為基準換算）`,
            [
              "請根據逐字稿產出：會議主軸（topic）、重點摘要（bullets 5-10 點）、決策（decisions）、待辦事項（actionItems）。",
              "待辦事項(actionItems) 統一包含：會後要完成的任務、會議中指派的分工與負責範圍。每一筆都必須是獨立條目 item。",
              "owner：負責人姓名。若逐字稿能辨識發言者／被指派人，請填入該姓名；僅在完全無法判斷時才回傳空字串。",
              "item：具體要做的事或負責範圍（一句話）。",
              "due：若逐字稿明確提到截止日才填寫，否則回傳空字串，不要推測或編造日期。",
            ].join("\n"),
            "逐字稿如下：",
            transcript,
          ].join("\n"),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schema.name,
          schema: schema.schema,
        },
      },
    }),
    cache: "no-store",
  });

  const json = (await response.json()) as OpenAIResponse;
  if (!response.ok) {
    throw new Error(json.error?.message ?? "OpenAI API 呼叫失敗。");
  }

  const text = extractResponseText(json)?.trim();
  if (!text) {
    throw new Error("OpenAI 回傳格式異常（缺少文字輸出）。");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("OpenAI 回傳不是有效 JSON。");
  }

  if (!isMeetingSummary(parsed)) {
    throw new Error("OpenAI 回傳 JSON schema 不符合預期。");
  }
  return parsed;
}

function extractResponseText(response: OpenAIResponse): string | null {
  const direct = response.output_text?.trim();
  if (direct) return direct;

  const output = response.output ?? [];
  for (const item of output) {
    const contents = item?.content ?? [];
    for (const content of contents) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        const text = content.text.trim();
        if (text) return text;
      }
      if (!content?.type && typeof content?.text === "string") {
        const text = content.text.trim();
        if (text) return text;
      }
    }
  }
  return null;
}

function isMeetingSummary(value: unknown): value is MeetingSummary {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.topic !== "string") return false;
  if (!Array.isArray(v.bullets) || !v.bullets.every((x) => typeof x === "string")) {
    return false;
  }
  if (!Array.isArray(v.decisions) || !v.decisions.every((x) => typeof x === "string")) {
    return false;
  }
  if (!Array.isArray(v.actionItems)) return false;
  for (const item of v.actionItems) {
    if (!item || typeof item !== "object") return false;
    const r = item as Record<string, unknown>;
    if (typeof r.item !== "string") return false;
    if (typeof r.owner !== "string") return false;
    if (typeof r.due !== "string") return false;
  }
  return true;
}

function formatActionItemLine(item: ActionItem, index: number): string {
  const due = item.due.trim();
  const suffix = due ? `（截止：${due}）` : "";
  return `${index}. ${item.item.trim()}${suffix}`;
}

function appendActionItemsGroupedByOwner(
  lines: string[],
  items: ActionItem[],
  maxItems = 30
): void {
  const valid = items.filter((a) => a.item.trim()).slice(0, maxItems);
  if (valid.length === 0) return;

  const byOwner = new Map<string, ActionItem[]>();
  const unassigned: ActionItem[] = [];

  for (const entry of valid) {
    const owner = entry.owner.trim();
    if (!owner) {
      unassigned.push(entry);
      continue;
    }
    const list = byOwner.get(owner) ?? [];
    list.push(entry);
    byOwner.set(owner, list);
  }

  lines.push("");
  lines.push("待辦事項：");

  for (const [owner, ownerItems] of byOwner) {
    lines.push("");
    lines.push(`【${owner}】`);
    ownerItems.slice(0, 12).forEach((entry, idx) => {
      lines.push(formatActionItemLine(entry, idx + 1));
    });
  }

  if (unassigned.length > 0) {
    lines.push("");
    lines.push("【待確認負責人】");
    unassigned.slice(0, 8).forEach((entry, idx) => {
      lines.push(formatActionItemLine(entry, idx + 1));
    });
  }
}

export function formatMeetingSummaryForLine(input: {
  title?: string;
  summary: MeetingSummary;
  sourceUrl?: string;
}): string {
  const lines: string[] = [];
  lines.push("【會議總結】");
  if (input.title?.trim()) lines.push(`標題：${input.title.trim()}`);
  lines.push(`主軸：${input.summary.topic.trim() || "（未取得）"}`);

  if (input.summary.bullets.length > 0) {
    lines.push("");
    lines.push("重點：");
    input.summary.bullets.slice(0, 10).forEach((b, idx) => {
      lines.push(`${idx + 1}. ${b}`);
    });
  }

  if (input.summary.decisions.length > 0) {
    lines.push("");
    lines.push("決策：");
    input.summary.decisions.slice(0, 10).forEach((d, idx) => {
      lines.push(`${idx + 1}. ${d}`);
    });
  }

  appendActionItemsGroupedByOwner(lines, input.summary.actionItems);

  if (input.sourceUrl?.trim()) {
    lines.push("");
    lines.push(`逐字稿連結：${input.sourceUrl.trim()}`);
  }

  return lines.join("\n");
}
