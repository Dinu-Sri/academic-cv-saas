export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DeepSeekJsonOptions = {
  messages: AiChatMessage[];
  timeoutMs?: number;
};

export function deepSeekIsConfigured() {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export function deepSeekModel() {
  return process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
}

export function deepSeekReasoningEffort() {
  const effort = (process.env.DEEPSEEK_REASONING_EFFORT || "max").toLowerCase();
  return effort === "high" ? "high" : "max";
}

export async function deepSeekJson<T>({ messages, timeoutMs = 45000 }: DeepSeekJsonOptions): Promise<T> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DeepSeek is not configured. Set DEEPSEEK_API_KEY.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(15000, timeoutMs));

  try {
    const response = await fetch(`${deepSeekBaseUrl()}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: deepSeekModel(),
        response_format: { type: "json_object" },
        thinking: { type: "enabled" },
        reasoning_effort: deepSeekReasoningEffort(),
        stream: false,
        messages
      })
    });

    const payload = (await response.json()) as {
      error?: { message?: string };
      choices?: { message?: { content?: string } }[];
    };

    if (!response.ok) {
      throw new Error(payload.error?.message || "DeepSeek could not complete the request.");
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("DeepSeek returned an empty response.");
    }

    return JSON.parse(content) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function deepSeekBaseUrl() {
  return (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
}
