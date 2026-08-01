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

---

## Cloudflare Pages – Project name: `fast-agentic-ai`

### Option A – Connect GitHub (recommended)

1. Open [Cloudflare Dashboard → Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. **Create** → **Pages** → **Connect to Git**
3. Select repository: **`bossayan9999/fast-agentic-ai`**
4. Project name: **`fast-agentic-ai`** (must match)
5. Build settings:

| Setting | Value |
|---------|--------|
| Framework preset | Next.js |
| Build command | `npx @cloudflare/next-on-pages` |
| Build output directory | `.vercel/output/static` |
| Root directory | `/` (default) |
| Compatibility flags | `nodejs_compat` |

6. **Environment variables** (Production + Preview):

| Variable | Value |
|----------|--------|
| `OPENROUTER_API_KEY` | your OpenRouter key |
| `OPENROUTER_MODEL` | `anthropic/claude-3.5-sonnet` |
| `GITHUB_TOKEN` | GitHub PAT with `repo` scope |
| `GITHUB_OWNER` | `bossayan9999` |
| `GITHUB_REPO` | `fast-agentic-ai` |
| `VAULT_OWNER` | `bossayan9999` |
| `VAULT_REPO` | `obsidian-agent-vault` |
| `VAULT_PATH` | *(leave empty)* |
| `NEXT_PUBLIC_APP_URL` | `https://fast-agentic-ai.pages.dev` |

7. Save and **Deploy**.

After deploy your app will be at:

**https://fast-agentic-ai.pages.dev**

### Option B – Deploy from CLI

```bash
# One-time login
npm run cf:login

# Build + deploy to project "fast-agentic-ai"
npm run deploy
```

Scripts (already wired):

| Script | Command |
|--------|---------|
| `npm run pages:build` | Build with next-on-pages |
| `npm run preview` | Local Pages preview (`--project-name=fast-agentic-ai`) |
| `npm run deploy` | Build + deploy to **`fast-agentic-ai`** |
| `npm run cf:login` | `wrangler login` |
| `npm run cf:whoami` | Show Cloudflare account |

`wrangler.toml` is configured with:

```toml
name = "fast-agentic-ai"
pages_build_output_dir = ".vercel/output/static"
compatibility_flags = ["nodejs_compat"]
```

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `web_search` | Free DuckDuckGo-based search |
| `calculator` | Safe math expressions |
| `code_execute` | Sandboxed JS expressions only |
| `get_datetime` | Current time |
| Memory search | Automatic against Obsidian vault |

## API

- `POST /api/chat` – SSE agentic loop
- `GET /api/memory?q=...` – search vault
- `POST /api/memory` – save note to vault

## License

MIT
