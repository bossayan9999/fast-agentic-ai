"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { v4 as uuidv4 } from "uuid";

type StepId = "query" | "intent" | "planning" | "tools" | "execution" | "answer" | "response";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const STEPS: { id: StepId; label: string; sub: string; color: string }[] = [
  { id: "query", label: "User Query", sub: "Waiting for input...", color: "emerald" },
  { id: "intent", label: "Intent Analysis", sub: "Understand Request", color: "orange" },
  { id: "planning", label: "Task Planning", sub: "Generate Plan", color: "amber" },
  { id: "tools", label: "Plugins & Tools", sub: "MCP Tools", color: "blue" },
  { id: "execution", label: "Action Execution", sub: "Perform Tasks", color: "cyan" },
  { id: "answer", label: "Answer Generator", sub: "Compose Response", color: "rose" },
  { id: "response", label: "User Response", sub: "Deliver Answer", color: "emerald" },
];

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I am **Fast Agentic AI**.\n\n1. Click **⚙️ Add API key** (top right)\n2. Get a key at [openrouter.ai/keys](https://openrouter.ai/keys)\n3. Paste it and click **Save & use**\n\nThen try: What is 2^10 + 15?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [showSettings, setShowSettings] = useState(false);
  const [activeStep, setActiveStep] = useState<StepId | null>(null);
  const [doneSteps, setDoneSteps] = useState<Set<StepId>>(new Set());
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>(["System ready."]);
  const [status, setStatus] = useState<"idle" | "running" | "ready" | "error">("idle");
  const [queryPreview, setQueryPreview] = useState("Waiting...");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const k = localStorage.getItem("faai_openrouter_key");
      const m = localStorage.getItem("faai_openrouter_model");
      if (k) setApiKey(k);
      if (m) setModel(m);
      if (!k) setShowSettings(true);
    } catch {}
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  };

  const resetVisual = () => {
    setActiveStep(null);
    setDoneSteps(new Set());
    setProgress(0);
    setQueryPreview("Waiting...");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isRunning) return;
    if (!apiKey.trim()) {
      setShowSettings(true);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: "assistant",
          content:
            "⚠️ Please add your OpenRouter API key first (⚙️ top right). Get one at https://openrouter.ai/keys",
        },
      ]);
      return;
    }
    setInput("");
    setIsRunning(true);
    setStatus("running");
    resetVisual();
    setQueryPreview(text.length > 45 ? text.slice(0, 45) + "…" : text);
    setMessages((prev) => [...prev, { id: uuidv4(), role: "user", content: text }]);

    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-6)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

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
              addLog("🧠 " + event.message);
            if (event.type === "tool" && event.message)
              addLog("🔧 " + event.message);
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
                    "⚠️ **Error**: " +
                    event.message +
                    "\n\nOpen ⚙️ Settings and check your key: https://openrouter.ai/keys",
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
          content: "⚠️ **Error**: " + err.message,
        },
      ]);
    } finally {
      setIsRunning(false);
      if (status !== "error") setStatus("ready");
    }
  };

  const handleReset = () => {
    if (isRunning) return;
    resetVisual();
    setLogs(["System ready."]);
    setStatus("idle");
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Session reset. Ready for a new query.",
      },
    ]);
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
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br/>");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg">
              🤖
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-blue-400">Fast</span>{" "}
                <span className="text-white">Agentic</span>{" "}
                <span className="text-orange-400">AI</span>
              </h1>
              <p className="text-xs text-slate-400">
                OpenRouter · MCP Tools · Obsidian Vault
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-2.5 py-1 rounded-full border ${
                status === "running"
                  ? "bg-blue-950 text-blue-300 border-blue-800"
                  : status === "ready"
                    ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                    : status === "error"
                      ? "bg-rose-950 text-rose-300 border-rose-800"
                      : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {status === "running"
                ? "● Running"
                : status === "ready"
                  ? "● Ready"
                  : status === "error"
                    ? "● Error"
                    : "○ Idle"}
            </span>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
            >
              ⚙️ {apiKey ? "Key set" : "Add API key"}
            </button>
            <button
              onClick={handleReset}
              disabled={isRunning}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-slate-900 border border-blue-800/50 rounded-2xl p-5">
            <div className="flex justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-200">
                ⚙️ Connect OpenRouter
              </h2>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-xs text-slate-400"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              1. Open{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline"
              >
                openrouter.ai/keys
              </a>
              {" "}→ create key → paste below → Save
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  API key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                >
                  <option value="openai/gpt-4o-mini">
                    openai/gpt-4o-mini (recommended)
                  </option>
                  <option value="openai/gpt-4o">openai/gpt-4o</option>
                  <option value="anthropic/claude-3.5-sonnet">
                    anthropic/claude-3.5-sonnet
                  </option>
                  <option value="google/gemini-2.0-flash-001">
                    google/gemini-2.0-flash-001
                  </option>
                  <option value="deepseek/deepseek-chat">
                    deepseek/deepseek-chat
                  </option>
                </select>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.setItem(
                        "faai_openrouter_key",
                        apiKey.trim()
                      );
                      localStorage.setItem("faai_openrouter_model", model);
                    } catch {}
                    setShowSettings(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm"
                >
                  Save &amp; use
                </button>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl border border-blue-700 text-blue-300 text-sm"
                >
                  Get key ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">
              📊 Pipeline
            </h2>
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="space-y-2">
              {STEPS.map((step) => {
                const isActive = activeStep === step.id;
                const isDone = doneSteps.has(step.id);
                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border border-slate-700 bg-slate-900/50 ${
                      isActive ? "opacity-100" : isDone ? "opacity-90" : "opacity-45"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm ${
                        step.color === "emerald"
                          ? "bg-emerald-600"
                          : step.color === "orange"
                            ? "bg-orange-500"
                            : step.color === "amber"
                              ? "bg-amber-500"
                              : step.color === "blue"
                                ? "bg-blue-500"
                                : step.color === "cyan"
                                  ? "bg-cyan-500"
                                  : "bg-rose-500"
                      }`}
                    >
                      {isActive ? "⏳" : isDone ? "✓" : "○"}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-slate-200">{step.label}</div>
                      <div className="text-xs text-slate-400 truncate">
                        {step.id === "query" ? queryPreview : step.sub}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-slate-400 mb-2">Log</h3>
            <div className="h-32 overflow-y-auto text-[11px] text-slate-400 font-mono space-y-1">
              {logs.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </section>

        <section className="lg:col-span-7 flex flex-col">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col h-[calc(100vh-9rem)] min-h-[480px]">
            <div className="px-5 py-3 border-b border-slate-800 text-sm text-slate-200">
              Agent Chat
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs ${
                      m.role === "user"
                        ? "bg-emerald-600"
                        : "bg-gradient-to-br from-blue-500 to-purple-600"
                    }`}
                  >
                    {m.role === "user" ? "U" : "AI"}
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm ${
                      m.role === "user"
                        ? "bg-emerald-700 text-white"
                        : "bg-slate-800 border border-slate-600 text-slate-200"
                    }`}
                    dangerouslySetInnerHTML={{
                      __html: formatMarkdown(m.content),
                    }}
                  />
                </div>
              ))}
              {isRunning && (
                <div className="text-slate-400 text-sm">Thinking…</div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 border-t border-slate-800">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter your query..."
                  disabled={isRunning}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100"
                />
                <button
                  type="submit"
                  disabled={isRunning || !input.trim()}
                  className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
