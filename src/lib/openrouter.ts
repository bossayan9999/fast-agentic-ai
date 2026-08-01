/** OpenRouter client via fetch – Edge / Cloudflare compatible */

export const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletion = {
  choices: { message: { role: string; content: string | null } }[];
};

/** Optional per-request overrides (from the web UI) */
export type ChatOptions = {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  apiKey?: string;
};

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ChatCompletion> {
  const apiKey =
    options.apiKey ||
    process.env.OPENROUTER_API_KEY ||
    "";

  if (!apiKey) {
    throw new Error(
      "No OpenRouter API key. Paste your key in the app settings (⚙️) or set OPENROUTER_API_KEY. Get one free at https://openrouter.ai/keys"
    );
  }

  const model = options.model || DEFAULT_MODEL;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Fast Agentic AI Engineering Loop",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.max_tokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      detail = j?.error?.message || j?.message || detail;
    } catch {
      // keep text
    }
    if (res.status === 401) {
      throw new Error(
        `OpenRouter 401 – invalid API key. Get a new key at https://openrouter.ai/keys and paste it in ⚙️ Settings.`
      );
    }
    if (res.status === 404) {
      throw new Error(
        `OpenRouter 404 – model not found ("${model}"). Pick another model in ⚙️ Settings (e.g. openai/gpt-4o-mini).`
      );
    }
    throw new Error(`OpenRouter error ${res.status}: ${detail}`);
  }

  return res.json();
}
