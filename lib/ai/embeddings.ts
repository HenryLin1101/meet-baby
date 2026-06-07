function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY 尚未設定。");
  return key;
}

export async function embedText(text: string): Promise<number[]> {
  const apiKey = getGeminiApiKey();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-2",
        content: { parts: [{ text }] },
      }),
      cache: "no-store",
    }
  );

  const json = (await res.json()) as {
    embedding?: { values: number[] };
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(json.error?.message ?? "Gemini Embeddings API 呼叫失敗。");
  }

  const values = json.embedding?.values;
  if (!Array.isArray(values)) {
    throw new Error("Gemini Embeddings API 回傳格式異常。");
  }

  return values;
}
