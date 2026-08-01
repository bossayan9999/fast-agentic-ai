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
      content: `Hello! I am **Fast Agentic AI** powered by OpenRouter + MCP tools.\n\nPipeline: Intent → Plan → Tools (web_search, calculator, code_execute, memory) → Execute → Answer\n\nVault: [obsidian-agent-vault](https://github.com/bossayan9999/obsidian-agent-vault)\n\nTry: "Search the web for latest agentic AI frameworks" or "What is 2^10 + 15?"`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const [activeStep, setActiveStep] = useState<StepId | null>(null);
  const [doneSteps, setDoneSteps] = useState<Set<StepId>>(new Set());
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>(["System ready. Awaiting user query..."]);
  const [status, setStatus] = useState<"idle" | "running" | "ready" | "error">("idle");
  const [queryPreview, setQueryPreview] = useState("Waiting for input...");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  };

  const resetVisual = () => {
    setActiveStep(null);
    setDoneSteps(new Set());
    setProgress(0);
    setQueryPreview("Waiting for input...");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isRunning) return;
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
        body: JSON.stringify({ message: text, sessionId, history }),
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
              setProgress(Math.round(((STEPS.findIndex((s) => s.id === event.step) + 1) / STEPS.length) * 100));
              if (event.message) addLog(event.message);
            }
            if (event.type === "log" && event.message) addLog(event.message);
            if (event.type === "memory" && event.message) addLog("🧠 " + event.message);
            if (event.type === "tool" && event.message) addLog("🔧 " + event.message);
            if (event.type === "content" && event.content) {
              if (!currentAssistantId) {
                currentAssistantId = uuidv4();
                setMessages((prev) => [...prev, { id: currentAssistantId!, role: "assistant", content: event.content }]);
              } else {
                const isFinalish = event.content.length > 200 || !event.content.startsWith("**");
                if (isFinalish) {
                  setMessages((prev) => prev.map((m) => (m.id === currentAssistantId ? { ...m, content: event.content } : m)));
                } else {
                  currentAssistantId = uuidv4();
                  setMessages((prev) => [...prev, { id: currentAssistantId!, role: "assistant", content: event.content }]);
                }
              }
            }
            if (event.type === "done") {
              setDoneSteps(new Set(STEPS.map((s) => s.id)));
              setActiveStep(null);
              setProgress(100);
              setStatus("ready");
              addLog("Feedback Loop active — ready for next query.");
            }
            if (event.type === "error") {
              setStatus("error");
              addLog("Error: " + event.message);
              setMessages((prev) => [...prev, { id: uuidv4(), role: "assistant", content: "⚠️ **Error**: " + event.message + "\n\nMake sure `OPENROUTER_API_KEY` is set in `.env.local`." }]);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setStatus("error");
      addLog("Error: " + err.message);
      setMessages((prev) => [...prev, { id: uuidv4(), role: "assistant", content: "⚠️ **Error**: " + err.message }]);
    } finally {
      setIsRunning(false);
      if (status !== "error") setStatus("ready");
    }
  };

  const handleReset = () => {
    if (isRunning) return;
    resetVisual();
    setLogs(["System ready. Awaiting user query..."]);
    setStatus("idle");
    setMessages([{ id: "welcome", role: "assistant", content: "Session reset. Ready for a new query." }]);
  };

  function formatMarkdown(text: string): string {
    return text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg text-white text-lg">🤖</div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-blue-400">Fast</span> <span className="text-white">Agentic</span>{" "}
                <span className="text-orange-400">AI</span> <span className="text-slate-300">Engineering Loop</span>
              </h1>
              <p className="text-xs text-slate-400">OpenRouter · MCP Tools · Obsidian Vault · Cloudflare ready</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded-full border ${
              status === "running" ? "bg-blue-950 text-blue-300 border-blue-800" :
              status === "ready" ? "bg-emerald-950 text-emerald-300 border-emerald-800" :
              status === "error" ? "bg-rose-950 text-rose-300 border-rose-800" :
              "bg-slate-800 text-slate-400 border-slate-700"
            }`}>{status === "running" ? "● Running" : status === "ready" ? "● Ready" : status === "error" ? "● Error" : "○ Idle"}</span>
            <button onClick={handleReset} disabled={isRunning} className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition disabled:opacity-50">Reset</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">📊 Agentic Pipeline</h2>
            <div className="mb-5">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5"><span>Progress</span><span>{progress}%</span></div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="space-y-2.5">
              {STEPS.map((step) => {
                const isActive = activeStep === step.id;
                const isDone = doneSteps.has(step.id);
                return (
                  <div key={step.id} className={`transition-all ${isActive ? "opacity-100 scale-[1.02]" : isDone ? "opacity-90" : "opacity-45"}`}>
                    <div className={`flex items-center gap-3 p-3 rounded-xl border bg-slate-900/50 border-slate-700`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white text-sm ${
                        step.color === "emerald" ? "bg-emerald-600" : step.color === "orange" ? "bg-orange-500" :
                        step.color === "amber" ? "bg-amber-500" : step.color === "blue" ? "bg-blue-500" :
                        step.color === "cyan" ? "bg-cyan-500" : "bg-rose-500"
                      }`}>{isActive ? "⏳" : isDone ? "✓" : "○"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-200">{step.label}</div>
                        <div className="text-xs text-slate-400 truncate">{step.id === "query" ? queryPreview : step.sub}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl p-4 bg-gradient-to-br from-teal-950/60 to-cyan-950/40 border border-teal-800/40">
              <div className="text-sm font-semibold text-teal-200 mb-1">MCP</div>
              <div className="text-[10px] text-teal-400/80 mb-2">Meta-Controller & Planner</div>
              <ul className="text-xs text-slate-300 space-y-1"><li>• Coordinate Actions</li><li>• Tool Selection</li><li>• Synthesize Results</li></ul>
            </div>
            <div className="rounded-xl p-4 bg-gradient-to-br from-violet-950/60 to-purple-950/40 border border-violet-800/40">
              <div className="text-sm font-semibold text-violet-200 mb-1">Memory & Tools</div>
              <div className="text-[10px] text-violet-400/80 mb-2">Vault + Plugins</div>
              <ul className="text-xs text-slate-300 space-y-1"><li>• Obsidian Vault</li><li>• web_search · calculator</li><li>• code_execute</li></ul>
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-slate-400 mb-2">🖥️ Execution Log</h3>
            <div className="h-40 overflow-y-auto text-[11px] text-slate-400 space-y-1 font-mono">
              {logs.map((l, i) => <div key={i}>{l}</div>)}
              <div ref={logEndRef} />
            </div>
          </div>
        </section>

        <section className="lg:col-span-7 flex flex-col">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl flex flex-col h-[calc(100vh-9rem)] min-h-[520px]">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-medium text-slate-200">Agent Chat</span>
              </div>
              <div className="text-xs text-slate-500">OpenRouter · MCP · Feedback Loop</div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs ${
                    m.role === "user" ? "bg-gradient-to-br from-emerald-500 to-green-600" : "bg-gradient-to-br from-blue-500 to-purple-600"
                  }`}>{m.role === "user" ? "U" : "AI"}</div>
                  <div className={`rounded-2xl px-4 py-3 max-w-[85%] ${
                    m.role === "user" ? "bg-gradient-to-br from-emerald-600 to-green-700 text-white rounded-tr-md" : "bg-slate-800 border border-slate-600 rounded-tl-md text-slate-200"
                  }`}>
                    <div className="text-sm" dangerouslySetInnerHTML={{ __html: formatMarkdown(m.content) }} />
                  </div>
                </div>
              ))}
              {isRunning && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs">AI</div>
                  <div className="bg-slate-800 border border-slate-600 rounded-2xl rounded-tl-md px-4 py-3">
                    <div className="flex gap-1"><span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" /><span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{animationDelay:"0.2s"}} /><span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{animationDelay:"0.4s"}} /></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 border-t border-slate-800">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter your query..." disabled={isRunning}
                  className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60" autoComplete="off" />
                <button type="submit" disabled={isRunning || !input.trim()}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed">Send</button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
