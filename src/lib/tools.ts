/**
 * Tool registry inspired by Model Context Protocol (MCP).
 * Each tool has a name, description, input schema, and async execute function.
 */

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  summary?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  execute: (args: Record<string, any>) => Promise<ToolResult>;
}

async function webSearch(args: { query: string; max_results?: number }): Promise<ToolResult> {
  const query = (args.query || "").trim();
  if (!query) return { success: false, error: "query is required" };
  const max = Math.min(args.max_results || 5, 8);
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FastAgenticAI/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const results: { title: string; snippet: string; url?: string }[] = [];
    if (data.AbstractText) {
      results.push({
        title: data.Heading || "Summary",
        snippet: data.AbstractText,
        url: data.AbstractURL,
      });
    }
    if (Array.isArray(data.RelatedTopics)) {
      for (const t of data.RelatedTopics.slice(0, max)) {
        if (t.Text) {
          results.push({
            title: t.Text.split(" - ")[0] || "Related",
            snippet: t.Text,
            url: t.FirstURL,
          });
        } else if (t.Topics) {
          for (const sub of t.Topics.slice(0, 2)) {
            if (sub.Text) {
              results.push({
                title: sub.Text.split(" - ")[0] || "Related",
                snippet: sub.Text,
                url: sub.FirstURL,
              });
            }
          }
        }
      }
    }
    if (results.length === 0) {
      results.push({
        title: "Search note",
        snippet: `No instant answer for "${query}". Consider refining the query or using a dedicated search API (Serper / Tavily / Brave).`,
      });
    }
    return {
      success: true,
      data: results.slice(0, max),
      summary: `Found ${Math.min(results.length, max)} result(s) for "${query}"`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Web search failed",
      summary: "Web search unavailable",
    };
  }
}

async function codeExecute(args: { code: string; language?: string }): Promise<ToolResult> {
  const code = (args.code || "").trim();
  const lang = (args.language || "javascript").toLowerCase();
  if (!code) return { success: false, error: "code is required" };
  if (lang !== "javascript" && lang !== "js") {
    return {
      success: false,
      error: `Language "${lang}" not supported in this sandbox. Only javascript expressions are allowed.`,
      summary: "Unsupported language",
    };
  }
  const forbidden = [
    /require\s*\(/i, /import\s+/i, /process\./i, /global/i, /Function\s*\(/i,
    /eval\s*\(/i, /fetch\s*\(/i, /XMLHttpRequest/i, /child_process/i, /fs\./i,
    /__dirname/i, /__filename/i, /constructor/i, /prototype/i,
  ];
  for (const re of forbidden) {
    if (re.test(code)) {
      return { success: false, error: "Code contains blocked patterns for security.", summary: "Blocked by sandbox" };
    }
  }
  try {
    const fn = new Function(`"use strict"; return (${code});`);
    const result = fn();
    return { success: true, data: { result, type: typeof result }, summary: `Evaluated expression → ${JSON.stringify(result)}` };
  } catch (err: any) {
    return { success: false, error: err.message || "Execution error", summary: "Code execution failed" };
  }
}

async function getDateTime(_args: Record<string, any>): Promise<ToolResult> {
  const now = new Date();
  return {
    success: true,
    data: {
      iso: now.toISOString(),
      local: now.toString(),
      unix: Math.floor(now.getTime() / 1000),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    summary: `Current time: ${now.toISOString()}`,
  };
}

async function calculator(args: { expression: string }): Promise<ToolResult> {
  const expr = (args.expression || "").trim();
  if (!expr) return { success: false, error: "expression is required" };
  if (!/^[\d\s+\-*/().%^]+$/.test(expr)) {
    return { success: false, error: "Invalid characters in expression" };
  }
  try {
    const safe = expr.replace(/\^/g, "**");
    const result = new Function(`"use strict"; return (${safe});`)();
    if (typeof result !== "number" || !isFinite(result)) {
      return { success: false, error: "Result is not a finite number" };
    }
    return { success: true, data: { expression: expr, result }, summary: `${expr} = ${result}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export const TOOLS: Record<string, ToolDefinition> = {
  web_search: {
    name: "web_search",
    description: "Search the web for up-to-date information. Use for current events, facts, documentation, or anything that may not be in the knowledge vault.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: { type: "number", description: "Max results (1-8)" },
      },
      required: ["query"],
    },
    execute: webSearch,
  },
  code_execute: {
    name: "code_execute",
    description: "Safely evaluate a simple JavaScript expression (math, JSON, basic logic). No I/O, no network, no system access.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "JavaScript expression to evaluate" },
        language: { type: "string", description: "Only 'javascript' supported" },
      },
      required: ["code"],
    },
    execute: codeExecute,
  },
  calculator: {
    name: "calculator",
    description: "Evaluate a mathematical expression (+ - * / % ^ parentheses).",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Math expression e.g. (2+3)*4^2" },
      },
      required: ["expression"],
    },
    execute: calculator,
  },
  get_datetime: {
    name: "get_datetime",
    description: "Get the current date and time in ISO and local formats.",
    inputSchema: { type: "object", properties: {} },
    execute: getDateTime,
  },
};

export function listTools(): { name: string; description: string; inputSchema: any }[] {
  return Object.values(TOOLS).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

export async function callTool(
  name: string,
  args: Record<string, any> = {}
): Promise<ToolResult> {
  const tool = TOOLS[name];
  if (!tool) {
    return { success: false, error: `Unknown tool: ${name}` };
  }
  try {
    return await tool.execute(args);
  } catch (err: any) {
    return { success: false, error: err.message || "Tool execution failed" };
  }
}
