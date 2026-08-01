# Fast Agentic AI Engineering Loop

Full-stack web application implementing the **Fast Agentic AI Engineering Loop** with:

- **OpenRouter** – multi-model backend (Claude, GPT-4o, Gemini, Llama, DeepSeek…)
- **MCP-style tool registry** – web_search, calculator, code_execute, get_datetime
- **Dedicated Obsidian Vault** – https://github.com/bossayan9999/obsidian-agent-vault
- **GitHub** as Backup Repo + session logs
- **Cloudflare Pages** project: **`fast-agentic-ai`**
- Real-time SSE streaming of every pipeline step

## Architecture

```
User Query
    ↓
Intent Analysis  →  Task Planning  →  Plugins & Tools (MCP)
    ↓                                      ↓
Memory (Obsidian Vault)              Action Execution
    ↓                                      ↓
              MCP (Meta-Controller & Planner)
                        ↓
              Answer Generator → User Response
                        ↑
                  Feedback Loop
```

## Repositories

| Repo | Purpose |
|------|---------|
| [fast-agentic-ai](https://github.com/bossayan9999/fast-agentic-ai) | Main Next.js app |
| [obsidian-agent-vault](https://github.com/bossayan9999/obsidian-agent-vault) | Dedicated knowledge vault |

## Quick Start (local)

**Get an OpenRouter API key (required):**  
→ **[https://openrouter.ai/keys](https://openrouter.ai/keys)**  
Models list: [https://openrouter.ai/models](https://openrouter.ai/models) · Docs: [https://openrouter.ai/docs](https://openrouter.ai/docs)

```bash
git clone https://github.com/bossayan9999/fast-agentic-ai.git
cd fast-agentic-ai
npm install
cp .env.example .env.local
```

Edit `.env.local` and paste your key from the link above:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
npm run dev
```

Open http://localhost:3000

---

## Cloudflare Pages – Project name: `fast-agentic-ai`

Build command: `npx @cloudflare/next-on-pages`  
Deploy: `npx wrangler pages deploy .vercel/output/static --project-name=fast-agentic-ai`

Set `OPENROUTER_API_KEY` in Cloudflare project environment variables (get key: https://openrouter.ai/keys).

---

## Troubleshooting: API Keys

1. Get key: **https://openrouter.ai/keys**
2. Put in `.env.local` next to `package.json`: `OPENROUTER_API_KEY=sk-or-v1-...`
3. Restart `npm run dev`
4. Test: `What is 2^10 + 15?`

Full troubleshooting: see previous README sections / git history for detailed Windows steps.

## License

MIT
