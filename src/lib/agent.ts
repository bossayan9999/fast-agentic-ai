import { chatCompletion } from "./openrouter";
import {
  searchKnowledge,
  listKnowledgeFiles,
  appendSessionLog,
  getVaultInfo,
} from "./github-memory";
import { callTool, listTools, TOOLS } from "./tools";

export type PipelineStep =
  | "query"
  | "intent"
  | "planning"
  | "tools"
  | "execution"
  | "answer"
  | "response";

export interface AgentEvent {
  type: "step" | "log" | "content" | "done" | "error" | "memory" | "tool";
  step?: PipelineStep;
  message?: string;
  content?: string;
  data?: any;
}

const SYSTEM_PROMPT = `You are the Meta-Controller & Planner (MCP) of a Fast Agentic AI Engineering Loop system.

Your architecture follows this pipeline:
1. Intent Analysis – Understand the user request deeply
2. Task Planning – Generate a clear, ordered plan
3. Plugins & Tools – Decide which tools (memory, web_search, calculator, code_execute, get_datetime) are needed
4. Action Execution – Perform the work and gather results
5. Answer Generation – Compose a high-quality, helpful final response

You have access to:
- Local Knowledge Base (Obsidian-style Vault on GitHub)
- Backup Repo Storage (GitHub)
- Tools: web_search, calculator, code_execute, get_datetime

When relevant, reference or suggest saving important findings back to the knowledge vault.

Be concise, structured, and actionable. Use markdown. Always end with a short suggestion for next steps if useful.`;

/** MCP-style tool selection via LLM */
async function decideTools(
  userQuery: string,
  intent: any
): Promise<{ name: string; args: Record<string, any> }[]> {
  const toolList = listTools()
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  const messages = [
    {
      role: "system" as const,
      content: `You are a tool router for an agentic system. Available tools:\n${toolList}\n\nAlso always consider memory search (handled separately).\n\nReply ONLY with a JSON array of tools to call (can be empty):\n[{"name":"tool_name","args":{...}}]\n\nExamples:\n[{"name":"web_search","args":{"query":"latest AI agents 2026"}}]\n[{"name":"calculator","args":{"expression":"2^10 + 5"}}]\n[]`,
    },
    {
      role: "user" as const,
      content: `Intent: ${JSON.stringify(intent)}\n\nUser query: ${userQuery}`,
    },
  ];

  try {
    const res = await chatCompletion(messages, { temperature: 0.1, max_tokens: 400 });
    const raw = res.choices[0]?.message?.content || "[]";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter((t) => t && t.name && TOOLS[t.name]);
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

export async function* runAgenticLoop(
  userQuery: string,
  sessionId: string,
  history: { role: "user" | "assistant"; content: string }[] = []
): AsyncGenerator<AgentEvent> {
  try {
    yield { type: "step", step: "query", message: "User query received" };
    yield {
      type: "log",
      message: `Query: "${userQuery.slice(0, 120)}${userQuery.length > 120 ? "…" : ""}"`,
    };

    yield { type: "step", step: "intent", message: "Analyzing intent..." };

    const intentMessages = [
      {
        role: "system" as const,
        content: `You are an intent classifier for an agentic AI system.\nReply ONLY with a JSON object (no markdown fences):\n{\n  "intent": "short label",\n  "description": "one sentence",\n  "needs_memory": boolean,\n  "needs_web": boolean,\n  "complexity": "low" | "medium" | "high"\n}`,
      },
      { role: "user" as const, content: userQuery },
    ];

    const intentRes = await chatCompletion(intentMessages, {
      temperature: 0.1,
      max_tokens: 300,
    });
    const intentRaw = intentRes.choices[0]?.message?.content || "{}";
    let intent: any = {
      intent: "general",
      description: "General assistance",
      needs_memory: true,
      needs_web: false,
      complexity: "medium",
    };
    try {
      const cleaned = intentRaw.replace(/```json|```/g, "").trim();
      intent = JSON.parse(cleaned);
    } catch {
      // keep default
    }

    yield {
      type: "log",
      message: `Intent → ${intent.intent}: ${intent.description}`,
    };
    yield {
      type: "content",
      content: `**Intent Analysis**\n${intent.description}`,
    };

    yield { type: "step", step: "planning", message: "Generating plan..." };

    const planMessages = [
      {
        role: "system" as const,
        content: `Create a short numbered task plan (3-6 steps) for the following user request and intent.\nReturn ONLY the numbered list, nothing else.`,
      },
      {
        role: "user" as const,
        content: `Intent: ${intent.intent} – ${intent.description}\n\nUser request: ${userQuery}`,
      },
    ];

    const planRes = await chatCompletion(planMessages, {
      temperature: 0.3,
      max_tokens: 400,
    });
    const plan =
      planRes.choices[0]?.message?.content ||
      "1. Analyze request\n2. Retrieve context\n3. Generate answer";

    yield { type: "log", message: "Task plan generated" };
    yield { type: "content", content: `**Task Plan**\n${plan}` };

    yield { type: "step", step: "tools", message: "Invoking plugins & tools (MCP)..." };

    let memoryContext = "";
    const vault = getVaultInfo();

    if (intent.needs_memory !== false) {
      yield {
        type: "memory",
        message: `Querying Obsidian Vault (${vault.owner}/${vault.repo})...`,
      };
      const hits = await searchKnowledge(userQuery, 4);
      if (hits.length > 0) {
        memoryContext =
          "\n\n### Retrieved from Knowledge Vault (Obsidian-style):\n" +
          hits.map((h) => `**${h.name}** (${h.path})\n${h.snippet}`).join("\n\n");
        yield {
          type: "log",
          message: `Memory → Found ${hits.length} relevant note(s) in vault`,
        };
        yield {
          type: "memory",
          message: `Loaded ${hits.length} note(s) from ${vault.repo}`,
          data: hits.map((h) => h.name),
        };
      } else {
        const files = await listKnowledgeFiles();
        yield {
          type: "log",
          message: `Memory → No keyword matches (${files.length} total notes in vault)`,
        };
      }
    }

    const selectedTools = await decideTools(userQuery, intent);
    let toolContext = "";

    if (selectedTools.length > 0) {
      yield {
        type: "log",
        message: `MCP → Selected tools: ${selectedTools.map((t) => t.name).join(", ")}`,
      };

      for (const t of selectedTools) {
        yield {
          type: "tool",
          message: `Executing tool: ${t.name}`,
          data: t,
        };
        const result = await callTool(t.name, t.args || {});
        yield {
          type: "log",
          message: result.success
            ? `Tool ${t.name} → ${result.summary || "ok"}`
            : `Tool ${t.name} failed: ${result.error}`,
        };
        if (result.success) {
          toolContext += `\n\n### Tool: ${t.name}\n${JSON.stringify(result.data, null, 2)}`;
        }
      }
    } else {
      yield { type: "log", message: "MCP → No extra tools selected" };
    }

    const invoked = [
      "Memory Retrieval",
      ...selectedTools.map((t) => t.name),
      "MCP Coordination",
    ];
    yield {
      type: "content",
      content:
        "**Plugins & Tools (MCP)**\nInvoked: " +
        invoked.map((t) => "`" + t + "`").join(" · "),
    };

    yield {
      type: "step",
      step: "execution",
      message: "MCP coordinating & executing...",
    };
    yield {
      type: "log",
      message: "MCP → Synthesizing results with retrieved context + tool outputs",
    };

    yield { type: "step", step: "answer", message: "Composing final answer..." };

    const finalMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-6),
      {
        role: "user",
        content: `${userQuery}\n\n---\nInternal context for you (do not repeat this block to the user):\nIntent: ${JSON.stringify(intent)}\nPlan:\n${plan}\nVault: ${vault.url}\n${memoryContext}\n${toolContext}\n---\nNow produce the final helpful response to the user.`,
      },
    ];

    const answerRes = await chatCompletion(finalMessages, {
      temperature: 0.5,
      max_tokens: 1800,
    });

    const answer =
      answerRes.choices[0]?.message?.content ||
      "I processed your request but could not generate a response. Please try again.";

    yield { type: "content", content: answer };
    yield { type: "log", message: "Answer composed" };

    appendSessionLog(sessionId, "user", userQuery).catch(() => {});
    appendSessionLog(sessionId, "assistant", answer).catch(() => {});

    yield {
      type: "step",
      step: "response",
      message: "Answer delivered. Feedback loop open.",
    };
    yield { type: "done" };
  } catch (err: any) {
    console.error("Agent loop error:", err);
    yield {
      type: "error",
      message: err.message || "Unknown error in agent loop",
    };
  }
}
