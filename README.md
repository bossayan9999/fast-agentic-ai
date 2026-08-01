# Fast Agentic AI Engineering Loop

Full-stack web application implementing the **Fast Agentic AI Engineering Loop** with:

- **OpenRouter** – multi-model backend (Claude, GPT-4o, Gemini, Llama, DeepSeek…)
- **MCP-style tool registry** – web_search, calculator, code_execute, get_datetime
- **Dedicated Obsidian Vault** – https://github.com/bossayan9999/obsidian-agent-vault
- **GitHub** as Backup Repo + session logs
- **Cloudflare Pages** ready deployment
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

## Quick Start

```bash
git clone https://github.com/bossayan9999/fast-agentic-ai.git
cd fast-agentic-ai
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

GITHUB_TOKEN=ghp_your_pat_with_repo_scope
GITHUB_OWNER=bossayan9999
GITHUB_REPO=fast-agentic-ai

VAULT_OWNER=bossayan9999
VAULT_REPO=obsidian-agent-vault
VAULT_PATH=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
npm run dev
```

Open http://localhost:3000

## Cloudflare Pages – Environment Variables

1. Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com) → your project → **Settings → Environment variables**
2. Add the following for **Production** (and Preview if desired):

| Variable | Value |
|----------|--------|
| `OPENROUTER_API_KEY` | your OpenRouter key |
| `OPENROUTER_MODEL` | `anthropic/claude-3.5-sonnet` (or any model) |
| `GITHUB_TOKEN` | GitHub PAT with `repo` scope |
| `GITHUB_OWNER` | `bossayan9999` |
| `GITHUB_REPO` | `fast-agentic-ai` |
| `VAULT_OWNER` | `bossayan9999` |
| `VAULT_REPO` | `obsidian-agent-vault` |
| `VAULT_PATH` | (leave empty) |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.pages.dev` |

3. Build settings:
   - Framework: Next.js
   - Build command: `npx @cloudflare/next-on-pages`
   - Output directory: `.vercel/output/static`
   - Compatibility flags: `nodejs_compat`

4. Deploy (or push to `main`).

CLI alternative:

```bash
npm run pages:build
npx wrangler pages deploy .vercel/output/static --project-name=fast-agentic-ai
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `web_search` | Free DuckDuckGo-based search |
| `calculator` | Safe math expressions |
| `code_execute` | Sandboxed JS expressions only |
| `get_datetime` | Current time |
| Memory search | Automatic against Obsidian vault |

The MCP (Meta-Controller) uses the LLM to decide which tools to call for each query.

## API

- `POST /api/chat` – SSE agentic loop
- `GET /api/memory?q=...` – search vault
- `POST /api/memory` – save note to vault

## License

MIT
