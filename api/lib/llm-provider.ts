/**
 * LLM Provider Router
 * Supports: openai, anthropic, google (gemini)
 */

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCallOptions {
  provider: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmResult {
  content: string;
  tokensUsed?: number;
  latencyMs: number;
}

// ─── Model Registry ───
// Maps friendly names to exact API model IDs. Falls back to raw name if not listed.
const MODEL_REGISTRY: Record<string, Record<string, string>> = {
  openai: {
    "gpt-4o": "gpt-4o",
    "gpt-4o-mini": "gpt-4o-mini",
    "gpt-4-turbo": "gpt-4-turbo",
    "gpt-4": "gpt-4",
    "gpt-3.5-turbo": "gpt-3.5-turbo",
  },
  anthropic: {
    "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-latest": "claude-3-5-sonnet-20241022",
    "claude-3-opus": "claude-3-opus-20240229",
    "claude-3-sonnet": "claude-3-sonnet-20240229",
    "claude-3-haiku": "claude-3-haiku-20240307",
  },
  google: {
    "gemini-1.5-pro": "gemini-1.5-pro",
    "gemini-1.5-flash": "gemini-1.5-flash",
    "gemini-pro": "gemini-pro",
    "gemini-1.5-pro-latest": "gemini-1.5-pro-latest",
    "gemini-1.5-flash-latest": "gemini-1.5-flash-latest",
  },
};

function resolveModelId(provider: string, model: string): string {
  const registry = MODEL_REGISTRY[provider.toLowerCase()];
  if (registry && registry[model.toLowerCase()]) {
    return registry[model.toLowerCase()];
  }
  // Passthrough: allow users to specify exact API model IDs
  return model;
}

// ─── OpenAI ───
async function callOpenAI(opts: LlmCallOptions): Promise<LlmResult> {
  const start = Date.now();
  const modelId = resolveModelId("openai", opts.model);

  const allMessages: LlmMessage[] = [
    { role: "system", content: opts.systemPrompt },
    ...opts.messages.map((m) => ({ role: m.role as LlmMessage["role"], content: m.content })),
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      messages: allMessages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { total_tokens: number };
  };

  const content = data.choices?.[0]?.message?.content ?? "";
  return { content, tokensUsed: data.usage?.total_tokens, latencyMs: Date.now() - start };
}

// ─── Anthropic ───
async function callAnthropic(opts: LlmCallOptions): Promise<LlmResult> {
  const start = Date.now();
  const modelId = resolveModelId("anthropic", opts.model);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      system: opts.systemPrompt,
      messages: opts.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };

  const content = data.content?.find((c) => c.type === "text")?.text ?? "";
  const tokensUsed = data.usage
    ? data.usage.input_tokens + data.usage.output_tokens
    : undefined;

  return { content, tokensUsed, latencyMs: Date.now() - start };
}

// ─── Google Gemini ───
async function callGoogle(opts: LlmCallOptions): Promise<LlmResult> {
  const start = Date.now();
  const modelId = resolveModelId("google", opts.model);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${opts.apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: opts.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      systemInstruction: {
        parts: [{ text: opts.systemPrompt }],
      },
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        maxOutputTokens: opts.maxTokens ?? 2048,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Gemini API error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    usageMetadata?: { totalTokenCount?: number };
  };

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return {
    content,
    tokensUsed: data.usageMetadata?.totalTokenCount,
    latencyMs: Date.now() - start,
  };
}

// ─── Public Router ───
export async function callLlm(opts: LlmCallOptions): Promise<LlmResult> {
  const provider = opts.provider.toLowerCase();

  switch (provider) {
    case "openai":
      return callOpenAI(opts);
    case "anthropic":
      return callAnthropic(opts);
    case "google":
      return callGoogle(opts);
    default:
      throw new Error(
        `Unsupported provider "${opts.provider}". Supported: openai, anthropic, google.`
      );
  }
}

// ─── Quick connectivity test (used by agent-router.ts) ───
// ─── Embedding generation ───
export async function createEmbedding(
  provider: string,
  apiKey: string,
  text: string,
  model = "text-embedding-3-small"
): Promise<number[]> {
  const p = provider.toLowerCase();

  if (p === "openai") {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI embedding error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return data.data[0].embedding;
  }

  // Fallback: for other providers, use OpenAI-compatible endpoint if available
  if (p === "google") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google embedding error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { embedding?: { values: number[] } };
    if (!data.embedding?.values) throw new Error("Google embedding response missing values");
    return data.embedding.values;
  }

  throw new Error(`Embedding not implemented for provider: ${provider}`);
}

export async function testProviderConnection(
  provider: string,
  apiKey: string,
  _model?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const p = provider.toLowerCase();
    if (p === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true };
    }
    if (p === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true };
    }
    if (p === "google") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
