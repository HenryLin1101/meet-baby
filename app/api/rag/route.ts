import { getBearerToken, verifyLineAccessToken } from "@/lib/line/auth";
import { getSupabaseAdmin } from "@/lib/db/client";
import { embedText } from "@/lib/ai/embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MatchedChunk = {
  id: number;
  content: string;
  chunk_type: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

type RagRequestBody = {
  question?: string;
  lineGroupId?: string;
};

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY 尚未設定。");
  return key;
}

function getChatModel(): string {
  return process.env.CHAT_MODEL?.trim() || "gemini-2.0-flash";
}

async function askWithContext(question: string, chunks: MatchedChunk[]): Promise<string> {
  const apiKey = getGeminiApiKey();
  const model = getChatModel();

  const context = chunks
    .map((c, idx) => {
      const date = c.metadata?.completedAt
        ? `會議日期：${new Date(c.metadata.completedAt as string).toLocaleDateString("zh-TW")}`
        : null;
      const header = [date, `類型：${c.chunk_type}`].filter(Boolean).join("，");
      return `[來源 ${idx + 1}]（${header}）\n${c.content}`;
    })
    .join("\n\n---\n\n");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: [
                "你是米特寶寶，一個幫助群組成員查詢歷史會議記錄的助手。",
                "請根據下方提供的會議資料回答問題，使用繁體中文，回答要簡潔、準確。",
                "若提供的資料不足以回答，請誠實說明，不要捏造內容。",
                "回答時請使用純文字，不要使用 markdown 語法（不要用 #、*、**、- 等符號）。",
              ].join("\n"),
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: `以下是相關的會議記錄：\n\n${context}\n\n問題：${question}` }],
          },
        ],
      }),
      cache: "no-store",
    }
  );

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(json.error?.message ?? "Gemini API 呼叫失敗。");
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini 回傳格式異常。");
  return text;
}

export async function POST(request: Request) {
  const token = getBearerToken(request.headers.get("Authorization"));
  if (!token) return errorResponse("未提供授權 token。", 401);

  let profile;
  try {
    profile = await verifyLineAccessToken(token);
  } catch {
    return errorResponse("LINE 使用者驗證失敗。", 401);
  }

  let body: RagRequestBody;
  try {
    body = (await request.json()) as RagRequestBody;
  } catch {
    return errorResponse("請求內容不是有效 JSON。", 400);
  }

  const question = body.question?.trim();
  const lineGroupId = body.lineGroupId?.trim();

  if (!question) return errorResponse("question 不可為空。", 400);
  if (!lineGroupId) return errorResponse("lineGroupId 不可為空。", 400);

  const supabase = getSupabaseAdmin();

  // 確認使用者是群組成員
  const { data: groupRow } = await supabase
    .from("chat_groups")
    .select("id")
    .eq("line_group_id", lineGroupId)
    .maybeSingle<{ id: number }>();

  if (!groupRow) return errorResponse("群組不存在。", 404);

  const { data: userRow } = await supabase
    .from("line_users")
    .select("id")
    .eq("line_user_id", profile.lineUserId)
    .maybeSingle<{ id: number }>();

  if (!userRow) return errorResponse("找不到使用者。", 404);

  const { data: membership } = await supabase
    .from("group_memberships")
    .select("id")
    .eq("group_id", groupRow.id)
    .eq("user_id", userRow.id)
    .eq("is_active", true)
    .maybeSingle<{ id: number }>();

  if (!membership) return errorResponse("你不是此群組的成員。", 403);

  // Embed 問題並搜尋相關 chunks
  const queryEmbedding = await embedText(question);

  const { data: chunks, error: matchError } = await supabase.rpc("match_documents", {
    p_group_id: groupRow.id,
    p_embedding: `[${queryEmbedding.join(",")}]`,
    p_match_count: 5,
  });

  if (matchError) {
    return errorResponse("搜尋會議記錄失敗。", 500);
  }

  const matched = (chunks ?? []) as MatchedChunk[];

  if (matched.length === 0) {
    return Response.json({
      answer: "目前這個群組還沒有任何會議記錄，無法回答你的問題。",
      sources: [],
    });
  }

  const answer = await askWithContext(question, matched);

  return Response.json({
    answer,
    sources: matched.map((c) => ({
      chunkType: c.chunk_type,
      metadata: c.metadata,
      similarity: c.similarity,
    })),
  });
}
