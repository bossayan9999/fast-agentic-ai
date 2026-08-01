/** OpenRouter client via fetch – Edge / Cloudflare compatible */

export const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletion = {
  choices: { message: { role: string; content: string | null } }[];
};

export async function chatCompletion(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {}
): Promise<ChatCompletion> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to your environment variables."
    );
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "https://fast-agentic-ai.pages.dev",
      "X-Title": "Fast Agentic AI Engineering Loop",
    },
    body: JSON.stringify({
      model: options.model || DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.max_tokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}
