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
  { id: "orchestrator", name: "Orchestrator", role: "Routes tasks", color: "from-blue-500 to-violet-600" },
  { id: "researcher", name: "Researcher", role: "Web + vault", color: "from-cyan-500 to-teal-600" },
  { id: "coder", name: "Coder", role: "Code + math", color: "from-amber-500 to-orange-600" },
  { id: "writer", name: "Writer", role: "Final answers", color: "from-rose-500 to-pink-600" },
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
    content: "Hi — **Orchestrator** ready.\n\n1. Paste key in **Settings** (right)\n2. Click **Test connection**\n3. Get key: [openrouter.ai/keys](https://openrouter.ai/keys)\n\nThen ask: What is 2^10 + 15?",
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
  const [testingKey, setTestingKey] = useState(false);
  const [connStatus, setConnStatus] = useState<string | null>(null);
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
    if (!SR) { setLastError("Mic needs Chrome/Edge"); setStatus("error"); return; }
    if (listening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setListening(false);
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "en-US";
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => { setListening(false); setLastError("Mic: " + (e.error || "error")); };
    rec.onresult = (e: any) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(t.trim());
    };
    try { rec.start(); } catch (err: any) { setLastError(err.message || "Mic failed"); }
  };

  const useSkill = (hint: string, agent: AgentId) => { setInput(hint); setActiveAgent(agent); inputRef.current?.focus(); };
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
    return "orchestrator";
  };

  const finalSpeakFromLast = () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last) speak(last.content);
  };

  const testConnection = async () => {
    const key = apiKey.trim();
    if (!key) { setLastError("Paste an OpenRouter API key first."); setConnStatus(null); return; }
    setTestingKey(true);
    setConnStatus("Testing OpenRouter…");
    setLastError(null);
    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, model }),
      });
      const data = await res.json();
      if (data.ok) {
        setConnStatus("✓ " + (data.message || "Connected"));
        addLog("[connection] OpenRouter OK");
        saveSettings();
      } else {
        setConnStatus(null);
        setLastError((data.error || "Failed") + (data.hint ? " — " + data.hint : ""));
        addLog("[connection] FAIL: " + (data.error || "unknown"));
      }
    } catch (err: any) {
      setConnStatus(null);
      setLastError(err.message || "Could not reach /api/test-key");
    } finally {
      setTestingKey(false);
    }
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isRunning) return;
    const key = apiKey.trim();
    if (!key) {
      setLastError("No API key. Paste in Settings (right) then Test connection.");
      setStatus("error");
      return;
    }
    if (!key.startsWith("sk-or-")) {
      setLastError("Key must start with sk-or- (OpenRouter, not OpenAI).");
      setStatus("error");
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
        body: JSON.stringify({ message: text, sessionId, history, apiKey: key, model, enabledTools }),
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
            if (event.type === "log" && event.message) addLog(event.message);
            if (event.type === "memory" && event.message) { setActiveAgent("researcher"); addLog("[researcher] " + event.message); }
            if (event.type === "tool" && event.message) { setActiveAgent(pickAgentFromStep("tools", event.message)); addLog(event.message); }
            if (event.type === "content" && event.content) {
              finalAnswer = event.content;
              if (!assistantId) {
                assistantId = uuidv4();
                setMessages((prev) => [...prev, { id: assistantId!, role: "assistant", agent: "writer", content: event.content }]);
              } else if (event.content.length > 200 || !event.content.startsWith("**")) {
                setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: event.content, agent: "writer" } : m));
              } else {
                assistantId = uuidv4();
                setMessages((prev) => [...prev, { id: assistantId!, role: "assistant", agent: "orchestrator", content: event.content }]);
              }
            }
            if (event.type === "done") {
              setDoneSteps(new Set(STEPS.map((s) => s.id)));
              setActiveStep(null);
              setProgress(100);
              setStatus("ready");
              setActiveAgent("writer");
              addLog("[orchestrator] Done");
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
      setMessages((prev) => [...prev, { id: uuidv4(), role: "system", content: "⚠️ **Error**: " + msg }]);
    } finally {
      setIsRunning(false);
    }
  };

  function formatMarkdown(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline">$1</a>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code class='text-cyan-300 text-xs'>$1</code>").replace(/\n/g, "<br/>");
  }

  const agentMeta = AGENTS.find((a) => a.id === activeAgent) || AGENTS[0];

  return (
    <div className="min-h-screen bg-[#0a0e16] text-slate-200 flex flex-col">
      <header className="border-b border-slate-800 bg-[#0d121c] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold">OS</div>
          <span className="text-sm font-semibold">Fast Agent OS</span>
        </div>
        <div className={`text-[11px] px-2.5 py-1 rounded-full border ${
          status === "running" ? "border-blue-600 text-blue-300" : status === "ready" ? "border-emerald-600 text-emerald-300" : status === "error" ? "border-rose-600 text-rose-300" : "border-slate-700 text-slate-400"
        }`}>{status === "running" ? "● Running" : status === "ready" ? "● Ready" : status === "error" ? "● Error" : "○ Idle"}</div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 max-h-[calc(100vh-2.75rem)]">
        <aside className="lg:col-span-3 border-r border-slate-800 bg-[#0c1018] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800">
            <div className="text-[10px] uppercase text-slate-500 font-semibold mb-2">Pipeline</div>
            <div className="h-1 bg-slate-800 rounded-full mb-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${progress}%` }} /></div>
            {STEPS.map((s) => {
              const on = activeStep === s.id; const done = doneSteps.has(s.id);
              return <div key={s.id} className={`text-xs px-2 py-1.5 rounded-md border mb-1 ${on ? "border-blue-500 text-blue-200" : done ? "border-emerald-800 text-emerald-400" : "border-slate-800 text-slate-600"}`}>{done ? "✓ " : on ? "› " : "· "}{s.label}</div>;
            })}
          </div>
          <div className="flex-1 p-3 overflow-y-auto">
            <div className="text-[10px] uppercase text-slate-500 font-semibold mb-2">Activity</div>
            <div className="font-mono text-[10px] text-slate-500 space-y-1">{logs.map((l, i) => <div key={i}>{l}</div>)}<div ref={logEndRef} /></div>
          </div>
        </aside>

        <main className="lg:col-span-5 flex flex-col border-r border-slate-800 bg-[#0b0f17] min-h-0">
          <div className="p-4 border-b border-slate-800 flex items-center gap-4 bg-[#0e1420]">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${agentMeta.color} p-[2px] ${avatarMood === "thinking" || avatarMood === "speaking" ? "animate-pulse" : ""}`}>
              <div className="w-full h-full rounded-full bg-[#0e1420] flex items-center justify-center">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full bg-slate-700" />
                  <div className="absolute top-4 left-2.5 w-1.5 h-1.5 rounded-full bg-cyan-300" />
                  <div className="absolute top-4 right-2.5 w-1.5 h-1.5 rounded-full bg-cyan-300" />
                  <div className={`absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-cyan-400 ${avatarMood === "speaking" ? "w-3 h-1.5 animate-pulse" : "w-2.5 h-0.5"}`} />
                </div>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500">Activated Agent</div>
              <div className="text-sm font-semibold">{agentMeta.name}</div>
              <div className="text-[11px] text-slate-400">{agentMeta.role}</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="text-[10px] uppercase text-slate-500 font-semibold">Output</div>
            {lastError && <div className="rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"><strong>Error:</strong> {lastError} <button type="button" className="underline ml-1" onClick={() => setLastError(null)}>Dismiss</button></div>}
            {messages.map((m) => (
              <div key={m.id} className={`rounded-xl px-3 py-2 text-sm ${
                m.role === "user" ? "bg-emerald-900/40 border border-emerald-800 ml-6" : m.role === "system" ? "bg-rose-950/30 border border-rose-900" : "bg-slate-900/60 border border-slate-800"
              }`}>
                {m.agent && m.role === "assistant" && <div className="text-[10px] text-slate-500 mb-1 uppercase">{AGENTS.find(a => a.id === m.agent)?.name}</div>}
                <div dangerouslySetInnerHTML={{ __html: formatMarkdown(m.content) }} />
              </div>
            ))}
            {isRunning && <div className="text-xs text-slate-500 animate-pulse">{agentMeta.name} working…</div>}
            <div ref={chatEndRef} />
          </div>
        </main>

        <aside className="lg:col-span-4 flex flex-col bg-[#0c1018] min-h-0">
          <div className="p-3 border-b border-slate-800 space-y-2">
            <div className="flex justify-between"><div className="text-[10px] uppercase text-slate-500 font-semibold">Settings</div>
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 underline">Get key ↗</a></div>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} onBlur={saveSettings}
              placeholder="sk-or-v1-... OpenRouter key" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs" />
            <select value={model} onChange={(e) => { setModel(e.target.value); try { localStorage.setItem("faai_openrouter_model", e.target.value); } catch {} }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs">
              <option value="openai/gpt-4o-mini">Model: gpt-4o-mini</option>
              <option value="openai/gpt-4o">Model: gpt-4o</option>
              <option value="anthropic/claude-3.5-sonnet">Model: claude-3.5-sonnet</option>
              <option value="google/gemini-2.0-flash-001">Model: gemini-2.0-flash</option>
              <option value="deepseek/deepseek-chat">Model: deepseek-chat</option>
            </select>
            {connStatus && <div className="text-[11px] text-emerald-400">{connStatus}</div>}
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-[11px] text-slate-400"><input type="checkbox" checked={ttsEnabled} onChange={(e) => { setTtsEnabled(e.target.checked); try { localStorage.setItem("faai_tts", e.target.checked ? "1" : "0"); } catch {} }} /> TTS</label>
              <div className="flex gap-1">
                <button type="button" onClick={testConnection} disabled={testingKey} className="text-[11px] px-2 py-1 rounded border border-cyan-700 text-cyan-300 disabled:opacity-50">{testingKey ? "Testing…" : "Test connection"}</button>
                <button type="button" onClick={() => { saveSettings(); addLog("Saved"); }} className="text-[11px] px-2 py-1 rounded bg-blue-600 text-white">Save</button>
              </div>
            </div>
          </div>
          <div className="p-3 border-b border-slate-800 overflow-y-auto">
            <div className="text-[10px] uppercase text-slate-500 font-semibold mb-2">Tools · Skills</div>
            {SKILLS.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-800 px-2 py-1.5 mb-1 bg-slate-900/40">
                <button type="button" onClick={() => toggleTool(s.id)} className={`w-7 h-4 rounded-full relative ${enabledTools[s.id] ? "bg-blue-600" : "bg-slate-700"}`}>
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white ${enabledTools[s.id] ? "left-3.5" : "left-0.5"}`} />
                </button>
                <button type="button" onClick={() => useSkill(s.hint, s.agent)} className="text-xs flex-1 text-left">{s.icon} {s.label}</button>
              </div>
            ))}
          </div>
          <div className="p-3 mt-auto border-t border-slate-800 space-y-2">
            <div className="text-[10px] uppercase text-slate-500 font-semibold">Message box</div>
            <form onSubmit={(e) => handleSubmit(e)} className="flex flex-col gap-2">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type or mic…" disabled={isRunning} rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm resize-none"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }} />
              <div className="flex gap-2">
                <button type="button" onClick={toggleMic} className={`flex-1 py-2 rounded-xl text-xs border ${listening ? "bg-rose-600 text-white" : "bg-slate-900 border-slate-700"}`}>{listening ? "⏹ Stop" : "🎤 Speak"}</button>
                <button type="button" onClick={() => speaking ? stopSpeak() : finalSpeakFromLast()} className="px-3 py-2 rounded-xl text-xs border border-slate-700">{speaking ? "🔇" : "🔊"}</button>
                <button type="submit" disabled={isRunning || !input.trim()} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold disabled:opacity-40">Send →</button>
              </div>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
