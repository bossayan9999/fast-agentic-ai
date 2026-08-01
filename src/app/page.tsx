"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { v4 as uuidv4 } from "uuid";

type StepId =
  | "query"
  | "intent"
  | "planning"
  | "tools"
  | "execution"
  | "answer"
  | "response";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const STEPS: { id: StepId; label: string }[] = [
  { id: "query", label: "Query" },
  { id: "intent", label: "Intent" },
  { id: "planning", label: "Plan" },
  { id: "tools", label: "Tools" },
  { id: "execution", label: "Execute" },
  { id: "answer", label: "Answer" },
  { id: "response", label: "Done" },
];

const SKILLS = [
  {
    id: "web_search",
    label: "Web Search",
    icon: "\ud83d\udd0d",
    hint: "Search the web for latest agentic AI frameworks",
    desc: "Live web lookup",
  },
  {
    id: "calculator",
    label: "Calculator",
    icon: "\ud83e\uddee",
    hint: "What is 2^10 + 15?",
    desc: "Math expressions",
  },
  {
    id: "code_execute",
    label: "Code",
    icon: "\ud83d\udcbb",
    hint: "Evaluate: [1,2,3].map(x => x*x)",
    desc: "JS sandbox",
  },
  {
    id: "get_datetime",
    label: "DateTime",
    icon: "\ud83d\udd50",
    hint: "What is the current date and time?",
    desc: "Current time",
  },
  {
    id: "memory",
    label: "Vault",
    icon: "\ud83d\udcda",
    hint: "Search my knowledge vault for agentic loops",
    desc: "Obsidian memory",
  },
];

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome to **Fast Agentic OS**.\n\n1. Paste your OpenRouter key in **Settings** (above the chat).\n2. Get a key: [openrouter.ai/keys](https://openrouter.ai/keys)\n3. Click a skill on the left or type a query.\n\nTry: *What is 2^10 + 15?*",
    },
  ]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({
    web_search: true,
    calculator: true,
    code_execute: true,
    get_datetime: true,
    memory: true,
  });
  const [activeStep, setActiveStep] = useState<StepId | null>(null);
  const [doneSteps, setDoneSteps] = useState<Set<StepId>>(new Set());
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>(["Agent OS ready."]);
  const [status, setStatus] = useState<"idle" | "running" | "ready" | "error">(
    "idle"
  );
  const chatEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const k = localStorage.getItem("faai_openrouter_key");
      const m = localStorage.getItem("faai_openrouter_model");
      const t = localStorage.getItem("faai_enabled_tools");
      if (k) setApiKey(k);
      if (m) setModel(m);
      if (t) setEnabledTools(JSON.parse(t));
    } catch {}
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const saveSettings = () => {
    try {
      localStorage.setItem("faai_openrouter_key", apiKey.trim());
      localStorage.setItem("faai_openrouter_model", model);
      localStorage.setItem("faai_enabled_tools", JSON.stringify(enabledTools));
    } catch {}
  };

  const toggleTool = (id: string) => {
    setEnabledTools((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("faai_enabled_tools", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev.slice(-80), `[${time}] ${msg}`]);
  };

  const useSkill = (hint: string) => {
    setInput(hint);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isRunning) return;
    if (!apiKey.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: "assistant",
          content:
            "\u26a0\ufe0f Add your OpenRouter API key in **Settings** (top of this chat). Get one free: https://openrouter.ai/keys",
        },
      ]);
      return;
    }
    setInput("");
    setIsRunning(true);
    setStatus("running");
    setActiveStep(null);
    setDoneSteps(new Set());
    setProgress(0);
    setMessages((prev) => [...prev, { id: uuidv4(), role: "user", content: text }]);

    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-6)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId,
          history,
          apiKey,
          model,
          enabledTools,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Request failed");
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";
      let currentAssistantId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(part.slice(6));
            if (event.type === "step" && event.step) {
              setActiveStep(event.step);
              setDoneSteps((prev) => {
                const next = new Set(prev);
                const idx = STEPS.findIndex((s) => s.id === event.step);
                for (let i = 0; i < idx; i++) next.add(STEPS[i].id);
                return next;
              });
              setProgress(
                Math.round(
                  ((STEPS.findIndex((s) => s.id === event.step) + 1) /
                    STEPS.length) *
                    100
                )
              );
              if (event.message) addLog(event.message);
            }
            if (event.type === "log" && event.message) addLog(event.message);
            if (event.type === "memory" && event.message)
              addLog("\ud83e\udde0 " + event.message);
            if (event.type === "tool" && event.message)
              addLog("\ud83d\udd27 " + event.message);
            if (event.type === "content" && event.content) {
              if (!currentAssistantId) {
                currentAssistantId = uuidv4();
                setMessages((prev) => [
                  ...prev,
                  {
                    id: currentAssistantId!,
                    role: "assistant",
                    content: event.content,
                  },
                ]);
              } else {
                const isFinalish =
                  event.content.length > 200 ||
                  !event.content.startsWith("**");
                if (isFinalish) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === currentAssistantId
                        ? { ...m, content: event.content }
                        : m
                    )
                  );
                } else {
                  currentAssistantId = uuidv4();
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: currentAssistantId!,
                      role: "assistant",
                      content: event.content,
                    },
                  ]);
                }
              }
            }
            if (event.type === "done") {
              setDoneSteps(new Set(STEPS.map((s) => s.id)));
              setActiveStep(null);
              setProgress(100);
              setStatus("ready");
              addLog("Ready for next query.");
            }
            if (event.type === "error") {
              setStatus("error");
              addLog("Error: " + event.message);
              setMessages((prev) => [
                ...prev,
                {
                  id: uuidv4(),
                  role: "assistant",
                  content:
                    "\u26a0\ufe0f **Error**: " +
                    event.message +
                    "\n\nCheck Settings \u2192 API key: https://openrouter.ai/keys",
                },
              ]);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setStatus("error");
      addLog("Error: " + err.message);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: "assistant",
          content: "\u26a0\ufe0f **Error**: " + err.message,
        },
      ]);
    } finally {
      setIsRunning(false);
      if (status !== "error") setStatus("ready");
    }
  };

  function formatMarkdown(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline">$1</a>'
      )
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code class='text-cyan-300'>$1</code>")
      .replace(/\n/g, "<br/>");
  }

  const statusLabel =
    status === "running"
      ? "Running"
      : status === "ready"
        ? "Ready"
        : status === "error"
          ? "Error"
          : "Idle";

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-200">
      <header className="border-b border-slate-800/80 bg-[#0d121c]/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
              OS
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight truncate">
                Fast Agentic OS
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                MCP · Pipeline · OpenRouter · Vault
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${
                status === "running"
                  ? "bg-blue-950/80 text-blue-300 border-blue-700"
                  : status === "ready"
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                    : status === "error"
                      ? "bg-rose-950/80 text-rose-300 border-rose-700"
                      : "bg-slate-900 text-slate-400 border-slate-700"
              }`}
            >
              {status === "running" ? "\u25cf" : status === "ready" ? "\u25cf" : "\u25cb"}{" "}
              {statusLabel}
            </span>
            <span className="hidden sm:inline text-[11px] text-slate-500 px-2">
              {progress}%
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-3 py-3 grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-3.5rem)]">
        <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3 min-h-0 overflow-y-auto">
          <div className="rounded-xl border border-slate-800 bg-[#121826] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Skills & Tools
            </div>
            <div className="space-y-1.5">
              {SKILLS.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900/40 px-2 py-1.5"
                >
                  <button
                    type="button"
                    onClick={() => toggleTool(s.id)}
                    className={`w-8 h-5 rounded-full relative shrink-0 transition ${
                      enabledTools[s.id] ? "bg-blue-600" : "bg-slate-700"
                    }`}
                    title={enabledTools[s.id] ? "Enabled" : "Disabled"}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${
                        enabledTools[s.id] ? "left-3.5" : "left-0.5"
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => useSkill(s.hint)}
                    className="flex-1 flex items-center gap-2 text-left min-w-0 hover:opacity-90"
                  >
                    <span className="text-sm">{s.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">
                        {s.label}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {s.desc}
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-2">
              Toggle = enable for agent · Click label = fill prompt
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#121826] p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Pipeline
              </div>
              <div className="text-[10px] text-slate-500">{progress}%</div>
            </div>
            <div className="h-1 bg-slate-800 rounded-full mb-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {STEPS.map((step) => {
                const isActive = activeStep === step.id;
                const isDone = doneSteps.has(step.id);
                return (
                  <span
                    key={step.id}
                    className={`text-[10px] px-2 py-1 rounded-md border ${
                      isActive
                        ? "bg-blue-600/30 border-blue-500 text-blue-200"
                        : isDone
                          ? "bg-emerald-900/40 border-emerald-800 text-emerald-300"
                          : "bg-slate-900 border-slate-800 text-slate-500"
                    }`}
                  >
                    {isDone ? "\u2713 " : isActive ? "\u2026 " : ""}
                    {step.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#121826] p-3 flex-1 min-h-[120px] flex flex-col">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Activity
            </div>
            <div className="flex-1 overflow-y-auto text-[11px] font-mono text-slate-500 space-y-1">
              {logs.map((l, i) => (
                <div key={i} className="leading-snug">
                  {l}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </aside>

        <section className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 rounded-xl border border-slate-800 bg-[#121826] overflow-hidden">
          <div className="border-b border-slate-800 bg-[#0e1420] px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Settings · OpenRouter
              </div>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-400 hover:text-blue-300 underline"
              >
                Get API key \u2197
              </a>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={saveSettings}
                placeholder="Paste sk-or-v1-... API key here"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  try {
                    localStorage.setItem("faai_openrouter_model", e.target.value);
                  } catch {}
                }}
                className="sm:w-56 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="openai/gpt-4o-mini">gpt-4o-mini</option>
                <option value="openai/gpt-4o">gpt-4o</option>
                <option value="anthropic/claude-3.5-sonnet">
                  claude-3.5-sonnet
                </option>
                <option value="google/gemini-2.0-flash-001">
                  gemini-2.0-flash
                </option>
                <option value="deepseek/deepseek-chat">deepseek-chat</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  saveSettings();
                  addLog("Settings saved.");
                }}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shrink-0"
              >
                Save
              </button>
            </div>
            <div className="text-[10px] text-slate-600">
              Key stored in this browser only ·{" "}
              {apiKey ? (
                <span className="text-emerald-500">Key set</span>
              ) : (
                <span className="text-amber-500">No key yet</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    m.role === "user"
                      ? "bg-emerald-600 text-white"
                      : "bg-gradient-to-br from-blue-500 to-violet-600 text-white"
                  }`}
                >
                  {m.role === "user" ? "U" : "AI"}
                </div>
                <div
                  className={`rounded-xl px-3 py-2 max-w-[88%] text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-emerald-700/90 text-white"
                      : "bg-slate-900/80 border border-slate-800 text-slate-200"
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: formatMarkdown(m.content),
                  }}
                />
              </div>
            ))}
            {isRunning && (
              <div className="text-xs text-slate-500 pl-9 animate-pulse">
                Agent working\u2026
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-800 p-3 bg-[#0e1420]">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message the agent\u2026 or click a skill on the left"
                disabled={isRunning}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={isRunning || !input.trim()}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
