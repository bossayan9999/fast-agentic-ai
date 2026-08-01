"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { v4 as uuidv4 } from "uuid";

type StepId = "query" | "intent" | "planning" | "tools" | "execution" | "answer" | "response";
type AgentId = "orchestrator" | "researcher" | "coder" | "writer";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agent?: AgentId;
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

const AGENTS: { id: AgentId; name: string; role: string; color: string }[] = [
  { id: "orchestrator", name: "Orchestrator", role: "Routes tasks & coordinates agents", color: "from-blue-500 to-violet-600" },
  { id: "researcher", name: "Researcher", role: "Web search & knowledge vault", color: "from-cyan-500 to-teal-600" },
  { id: "coder", name: "Coder", role: "Code exec & calculations", color: "from-amber-500 to-orange-600" },
  { id: "writer", name: "Writer", role: "Final answers & summaries", color: "from-rose-500 to-pink-600" },
];

const SKILLS = [
  { id: "web_search", label: "Web Search", icon: "🔍", hint: "Search the web for latest agentic AI frameworks", agent: "researcher" as AgentId },
  { id: "calculator", label: "Calculator", icon: "🧮", hint: "What is 2^10 + 15?", agent: "coder" as AgentId },
  { id: "code_execute", label: "Code", icon: "💻", hint: "Evaluate: [1,2,3].map(x => x*x)", agent: "coder" as AgentId },
  { id: "get_datetime", label: "DateTime", icon: "🕐", hint: "What is the current date and time?", agent: "orchestrator" as AgentId },
  { id: "memory", label: "Vault", icon: "📚", hint: "Search knowledge vault for agentic loops", agent: "researcher" as AgentId },
];

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: "welcome", role: "assistant", agent: "orchestrator",
    content: "Hi — I'm your **Orchestrator**.\n\n1. Paste OpenRouter key under **Settings**\n2. Get key: [openrouter.ai/keys](https://openrouter.ai/keys)\n3. Talk by text, **mic**, or click a skill\n\nTeam: Researcher · Coder · Writer.",
  }]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({
    web_search: true, calculator: true, code_execute: true, get_datetime: true, memory: true,
  });
  const [activeAgent, setActiveAgent] = useState<AgentId>("orchestrator");
  const [activeStep, setActiveStep] = useState<StepId | null>(null);
  const [doneSteps, setDoneSteps] = useState<Set<StepId>>(new Set());
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>(["Multi-agent OS online."]);
  const [status, setStatus] = useState<"idle" | "running" | "ready" | "error">("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [avatarMood, setAvatarMood] = useState<"idle" | "listening" | "thinking" | "speaking" | "error">("idle");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    try {
      const k = localStorage.getItem("faai_openrouter_key");
      const m = localStorage.getItem("faai_openrouter_model");
      const t = localStorage.getItem("faai_enabled_tools");
      const tts = localStorage.getItem("faai_tts");
      if (k) setApiKey(k);
      if (m) setModel(m);
      if (t) setEnabledTools(JSON.parse(t));
      if (tts !== null) setTtsEnabled(tts === "1");
    } catch {}
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);
  useEffect(() => {
    if (status === "running") setAvatarMood("thinking");
    else if (status === "error") setAvatarMood("error");
    else if (listening) setAvatarMood("listening");
    else if (speaking) setAvatarMood("speaking");
    else setAvatarMood("idle");
  }, [status, listening, speaking]);

  const saveSettings = () => {
    try {
      localStorage.setItem("faai_openrouter_key", apiKey.trim());
      localStorage.setItem("faai_openrouter_model", model);
      localStorage.setItem("faai_enabled_tools", JSON.stringify(enabledTools));
      localStorage.setItem("faai_tts", ttsEnabled ? "1" : "0");
    } catch {}
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [...prev.slice(-100), `[${time}] ${msg}`]);
  };

  const speak = (text: string) => {
    if (!ttsEnabled || typeof window === "undefined") return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[#*_`>[\]()]/g, " ").replace(/https?:\/\/\S+/g, "").slice(0, 600);
      const u = new SpeechSynthesisUtterance(clean);
      u.rate = 1.05;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    } catch { setSpeaking(false); }
  };

  const stopSpeak = () => {
    try { window.speechSynthesis.cancel(); } catch {}
    setSpeaking(false);
  };

  const toggleMic = () => {
    const SR = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) {
      setLastError("Speech recognition needs Chrome/Edge.");
      setStatus("error");
      return;
    }
    if (listening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setListening(false);
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
      setListening(false);
      setLastError("Mic: " + (e.error || "error"));
      addLog("STT error: " + (e.error || "unknown"));
    };
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setInput(transcript.trim());
    };
    try { rec.start(); } catch (err: any) { setLastError(err.message || "Mic failed"); }
  };

  const useSkill = (hint: string, agent: AgentId) => {
    setInput(hint);
    setActiveAgent(agent);
    inputRef.current?.focus();
  };

  const toggleTool = (id: string) => {
    setEnabledTools((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem("faai_enabled_tools", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const pickAgentFromStep = (step?: string, logMsg?: string): AgentId => {
    if (step === "tools" || step === "execution") {
      if (logMsg?.includes("web_search") || logMsg?.includes("Memory")) return "researcher";
      if (logMsg?.includes("calculator") || logMsg?.includes("code_execute")) return "coder";
      return "orchestrator";
    }
    if (step === "answer" || step === "response") return "writer";
    if (step === "intent" || step === "planning") return "orchestrator";
    return "orchestrator";
  };

  const finalSpeakFromLast = () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last) speak(last.content);
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isRunning) return;
    if (!apiKey.trim()) {
      setLastError("No API key. Paste OpenRouter key in Settings.");
      setStatus("error");
      setMessages((prev) => [...prev, { id: uuidv4(), role: "system", content: "⚠️ **Missing API key.** Settings (right). https://openrouter.ai/keys" }]);
      return;
    }
    setLastError(null);
    setInput("");
    setIsRunning(true);
    setStatus("running");
    setActiveStep(null);
    setDoneSteps(new Set());
    setProgress(0);
    setActiveAgent("orchestrator");
    stopSpeak();
    setMessages((prev) => [...prev, { id: uuidv4(), role: "user", content: text }]);
    addLog("User → " + text.slice(0, 80));

    const history = messages.filter((m) => m.role === "user" || m.role === "assistant").slice(-6)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    let assistantId: string | null = null;
    let finalAnswer = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, history, apiKey, model, enabledTools }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
              const agent = pickAgentFromStep(event.step, event.message);
              setActiveAgent(agent);
              setDoneSteps((prev) => {
                const next = new Set(prev);
                const idx = STEPS.findIndex((s) => s.id === event.step);
                for (let i = 0; i < idx; i++) next.add(STEPS[i].id);
                return next;
              });
              setProgress(Math.round(((STEPS.findIndex((s) => s.id === event.step) + 1) / STEPS.length) * 100));
              if (event.message) addLog(`[${agent}] ${event.message}`);
            }
            if (event.type === "log" && event.message) {
              const agent = pickAgentFromStep(activeStep || undefined, event.message);
              setActiveAgent(agent);
              addLog(`[${agent}] ${event.message}`);
            }
            if (event.type === "memory" && event.message) {
              setActiveAgent("researcher");
              addLog(`[researcher] ${event.message}`);
            }
            if (event.type === "tool" && event.message) {
              const agent = pickAgentFromStep("tools", event.message);
              setActiveAgent(agent);
              addLog(`[${agent}] ${event.message}`);
            }
            if (event.type === "content" && event.content) {
              finalAnswer = event.content;
              if (!assistantId) {
                assistantId = uuidv4();
                setMessages((prev) => [...prev, { id: assistantId!, role: "assistant", agent: "writer", content: event.content }]);
              } else {
                const isFinalish = event.content.length > 200 || !event.content.startsWith("**");
                if (isFinalish) {
                  setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: event.content, agent: "writer" } : m));
                } else {
                  assistantId = uuidv4();
                  setMessages((prev) => [...prev, { id: assistantId!, role: "assistant", agent: "orchestrator", content: event.content }]);
                }
              }
            }
            if (event.type === "done") {
              setDoneSteps(new Set(STEPS.map((s) => s.id)));
              setActiveStep(null);
              setProgress(100);
              setStatus("ready");
              setActiveAgent("writer");
              addLog("[orchestrator] Pipeline complete.");
              if (finalAnswer) speak(finalAnswer);
            }
            if (event.type === "error") throw new Error(event.message || "Agent error");
          } catch (parseErr: any) {
            if (parseErr?.message && !String(parseErr.message).includes("JSON")) throw parseErr;
          }
        }
      }
    } catch (err: any) {
      const msg = err.message || "Unknown error";
      setStatus("error");
      setLastError(msg);
      addLog("[error] " + msg);
      setMessages((prev) => [...prev, {
        id: uuidv4(), role: "system",
        content: "⚠️ **Error**: " + msg + "\n\n**Tips:** Check key · try gpt-4o-mini · see Activity log",
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  function formatMarkdown(text: string): string {
    return text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline">$1</a>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code class='text-cyan-300 text-xs'>$1</code>")
      .replace(/\n/g, "<br/>");
  }

  const agentMeta = AGENTS.find((a) => a.id === activeAgent) || AGENTS[0];

  return (
    <div className="min-h-screen bg-[#0a0e16] text-slate-200 flex flex-col">
      <header className="border-b border-slate-800 bg-[#0d121c] px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold">OS</div>
          <span className="text-sm font-semibold tracking-wide">Fast Agent OS</span>
        </div>
        <div className={`text-[11px] px-2.5 py-1 rounded-full border ${
          status === "running" ? "border-blue-600 text-blue-300 bg-blue-950/50" :
          status === "ready" ? "border-emerald-600 text-emerald-300 bg-emerald-950/50" :
          status === "error" ? "border-rose-600 text-rose-300 bg-rose-950/50" : "border-slate-700 text-slate-400"
        }`}>{status === "running" ? "● Running" : status === "ready" ? "● Ready" : status === "error" ? "● Error" : "○ Idle"}</div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-0 max-h-[calc(100vh-2.75rem)]">
        <aside className="lg:col-span-3 border-r border-slate-800 bg-[#0c1018] flex flex-col min-h-0 overflow-hidden">
          <div className="p-3 border-b border-slate-800">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Pipeline</div>
            <div className="h-1 bg-slate-800 rounded-full mb-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex flex-col gap-1">
              {STEPS.map((s) => {
                const on = activeStep === s.id;
                const done = doneSteps.has(s.id);
                return (
                  <div key={s.id} className={`text-xs px-2 py-1.5 rounded-md border ${
                    on ? "border-blue-500 bg-blue-950/40 text-blue-200" : done ? "border-emerald-800 bg-emerald-950/20 text-emerald-400" : "border-slate-800 text-slate-600"
                  }`}>{done ? "✓ " : on ? "› " : "· "}{s.label}</div>
                );
              })}
            </div>
          </div>
          <div className="flex-1 p-3 overflow-y-auto min-h-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Activity</div>
            <div className="space-y-1 font-mono text-[10px] text-slate-500">
              {logs.map((l, i) => <div key={i}>{l}</div>)}
              <div ref={logEndRef} />
            </div>
          </div>
        </aside>

        <main className="lg:col-span-5 flex flex-col min-h-0 border-r border-slate-800 bg-[#0b0f17]">
          <div className="p-4 border-b border-slate-800 flex items-center gap-4 bg-[#0e1420]">
            <div className="relative shrink-0">
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${agentMeta.color} p-[2px] ${avatarMood === "thinking" || avatarMood === "speaking" ? "animate-pulse" : ""}`}>
                <div className="w-full h-full rounded-full bg-[#0e1420] flex items-center justify-center">
                  <div className="relative w-14 h-14">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-slate-700 to-slate-800" />
                    <div className={`absolute top-5 left-3 w-2 h-2 rounded-full bg-cyan-300 ${avatarMood === "thinking" ? "animate-bounce" : ""}`} />
                    <div className={`absolute top-5 right-3 w-2 h-2 rounded-full bg-cyan-300 ${avatarMood === "thinking" ? "animate-bounce" : ""}`} style={{ animationDelay: "0.1s" }} />
                    <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-cyan-400/80 transition-all ${
                      avatarMood === "speaking" ? "w-4 h-2 animate-pulse" : avatarMood === "error" ? "w-3 h-0.5" : avatarMood === "listening" ? "w-3 h-1.5" : "w-3 h-0.5"
                    }`} />
                  </div>
                </div>
              </div>
              {(avatarMood === "listening" || avatarMood === "speaking") && (
                <span className="absolute -inset-1 rounded-full border border-cyan-400/40 animate-ping" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Activated Agent</div>
              <div className="text-sm font-semibold text-white truncate">{agentMeta.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{agentMeta.role}</div>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {AGENTS.map((a) => (
                  <button key={a.id} type="button" onClick={() => setActiveAgent(a.id)}
                    className={`text-[9px] px-1.5 py-0.5 rounded border ${activeAgent === a.id ? "border-blue-500 text-blue-300 bg-blue-950/40" : "border-slate-700 text-slate-500"}`}>
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Output</div>
            {lastError && (
              <div className="rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                <strong>Error:</strong> {lastError}
                <button type="button" className="ml-2 underline" onClick={() => { setLastError(null); setStatus("idle"); }}>Dismiss</button>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user" ? "bg-emerald-900/40 border border-emerald-800 ml-6" :
                m.role === "system" ? "bg-rose-950/30 border border-rose-900" : "bg-slate-900/60 border border-slate-800 mr-2"
              }`}>
                {m.agent && m.role === "assistant" && (
                  <div className="text-[10px] text-slate-500 mb-1 uppercase">{AGENTS.find((a) => a.id === m.agent)?.name}</div>
                )}
                <div dangerouslySetInnerHTML={{ __html: formatMarkdown(m.content) }} />
              </div>
            ))}
            {isRunning && <div className="text-xs text-slate-500 animate-pulse">{agentMeta.name} working…</div>}
            <div ref={chatEndRef} />
          </div>
        </main>

        <aside className="lg:col-span-4 flex flex-col min-h-0 bg-[#0c1018]">
          <div className="p-3 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Settings</div>
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 underline">Get key ↗</a>
            </div>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} onBlur={saveSettings}
              placeholder="OpenRouter API key sk-or-v1-..." className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs" />
            <select value={model} onChange={(e) => { setModel(e.target.value); try { localStorage.setItem("faai_openrouter_model", e.target.value); } catch {} }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs">
              <option value="openai/gpt-4o-mini">AI Model: gpt-4o-mini</option>
              <option value="openai/gpt-4o">AI Model: gpt-4o</option>
              <option value="anthropic/claude-3.5-sonnet">AI Model: claude-3.5-sonnet</option>
              <option value="google/gemini-2.0-flash-001">AI Model: gemini-2.0-flash</option>
              <option value="deepseek/deepseek-chat">AI Model: deepseek-chat</option>
            </select>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer">
                <input type="checkbox" checked={ttsEnabled} onChange={(e) => { setTtsEnabled(e.target.checked); try { localStorage.setItem("faai_tts", e.target.checked ? "1" : "0"); } catch {} }} />
                Speak answers (TTS)
              </label>
              <button type="button" onClick={() => { saveSettings(); addLog("Settings saved."); }} className="text-[11px] px-2 py-1 rounded bg-blue-600 text-white">Save</button>
            </div>
          </div>

          <div className="p-3 border-b border-slate-800 overflow-y-auto max-h-[40%]">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Tools · Skills</div>
            <div className="space-y-1">
              {SKILLS.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-800 px-2 py-1.5 bg-slate-900/40">
                  <button type="button" onClick={() => toggleTool(s.id)}
                    className={`w-7 h-4 rounded-full relative shrink-0 ${enabledTools[s.id] ? "bg-blue-600" : "bg-slate-700"}`}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition ${enabledTools[s.id] ? "left-3.5" : "left-0.5"}`} />
                  </button>
                  <button type="button" onClick={() => useSkill(s.hint, s.agent)} className="flex-1 text-left text-xs truncate hover:text-white">
                    {s.icon} {s.label}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 mt-auto border-t border-slate-800 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Message box · Human help</div>
            <form onSubmit={(e) => handleSubmit(e)} className="flex flex-col gap-2">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="Type or use the mic…" disabled={isRunning} rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }} />
              <div className="flex gap-2">
                <button type="button" onClick={toggleMic}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border ${listening ? "bg-rose-600 border-rose-500 text-white animate-pulse" : "bg-slate-900 border-slate-700 text-slate-300"}`}>
                  {listening ? "⏹ Stop mic" : "🎤 Speak"}
                </button>
                <button type="button" onClick={() => speaking ? stopSpeak() : finalSpeakFromLast()}
                  className="px-3 py-2 rounded-xl text-xs border border-slate-700 bg-slate-900" title="Replay last answer">{speaking ? "🔇" : "🔊"}</button>
                <button type="submit" disabled={isRunning || !input.trim()}
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40">Send →</button>
              </div>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
