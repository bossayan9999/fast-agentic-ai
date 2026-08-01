import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/** Quick OpenRouter connectivity check */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = (body.apiKey || process.env.OPENROUTER_API_KEY || "").trim();
    const model = (body.model || "openai/gpt-4o-mini").trim();

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "No API key provided" },
        { status: 400 }
      );
    }
    if (!apiKey.startsWith("sk-or-")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Key should start with sk-or- (OpenRouter). Get one at https://openrouter.ai/keys",
        },
        { status: 400 }
      );
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Fast Agent OS Key Test",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
        max_tokens: 16,
        temperature: 0,
      }),
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 200) };
    }

    if (!res.ok) {
      const msg =
        data?.error?.message ||
        data?.message ||
        text.slice(0, 200) ||
        res.statusText;
      return NextResponse.json({
        ok: false,
        status: res.status,
        error: msg,
        hint:
          res.status === 401
            ? "Invalid key — create a new one at https://openrouter.ai/keys"
            : res.status === 402
              ? "No credits on OpenRouter — add credits or use a free model"
              : res.status === 404
                ? `Model not found: ${model} — try openai/gpt-4o-mini`
                : "Check key, model, and OpenRouter status",
      });
    }

    const reply = data?.choices?.[0]?.message?.content || "";
    return NextResponse.json({
      ok: true,
      model,
      reply: reply.slice(0, 80),
      message: "Connection OK — OpenRouter answered.",
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message || "Network error reaching OpenRouter",
      hint: "Check internet connection and that openrouter.ai is reachable",
    });
  }
}
