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
npm run cf:login
npm run deploy
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

---

## Troubleshooting: API Keys & Environment

### Required vs optional keys

| Variable | Required? | Where to get it |
|----------|-----------|-----------------|
| `OPENROUTER_API_KEY` | **Yes** (for chat answers) | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `OPENROUTER_MODEL` | No (has default) | e.g. `anthropic/claude-3.5-sonnet` |
| `GITHUB_TOKEN` | No (only for vault search / save) | GitHub → Settings → Developer settings → PAT (`repo` scope) |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` locally |

Without `OPENROUTER_API_KEY`, the UI still loads but every chat request will fail with an API key error.

### Local setup (Windows PowerShell)

Always run commands **inside the project folder**:

```powershell
cd C:\Users\YOUR_USERNAME\fast-agentic-ai
```

Create `.env.local` (PowerShell):

```powershell
@"
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
NEXT_PUBLIC_APP_URL=http://localhost:3000
"@ | Out-File -FilePath .env.local -Encoding utf8
```

Or copy the example then edit:

```powershell
copy .env.example .env.local
notepad .env.local
```

Restart the dev server after any change to `.env.local`:

```powershell
# Ctrl+C to stop, then:
npm run dev
```

### Local setup (macOS / Linux)

```bash
cd fast-agentic-ai
cp .env.example .env.local
# edit .env.local and set OPENROUTER_API_KEY
npm run dev
```

### Checklist when chat fails

1. **Are you in the project directory?**  
   `.env.local` must be next to `package.json`, not in your home folder.

2. **Does `.env.local` exist and contain the key?**  
   ```powershell
   Get-Content .env.local
   ```  
   You should see a line starting with `OPENROUTER_API_KEY=sk-or-v1-...`  
   No quotes, no spaces around `=`.

3. **Did you restart `npm run dev` after editing `.env.local`?**  
   Next.js only loads env files at startup.

4. **Is the key valid?**  
   - Create/copy a key at https://openrouter.ai/keys  
   - Ensure the account has credits / free quota  
   - Key should look like `sk-or-v1-...` (not a GitHub or OpenAI key)

5. **Check the terminal / browser Network tab**  
   - Failed `/api/chat` responses often include `OPENROUTER_API_KEY is not set` or `OpenRouter error 401`  
   - `401` = bad or missing key  
   - `402` = no credits on OpenRouter  

6. **Cloudflare deploy**  
   Dashboard env vars are separate from local `.env.local`.  
   Set `OPENROUTER_API_KEY` under  
   **Workers & Pages → your project → Settings → Environment variables**  
   (Production and Preview), then **Retry deployment**.

### Common mistakes

| Mistake | Fix |
|---------|-----|
| Ran `cp .env.example` from `C:\Users\You` | `cd` into `fast-agentic-ai` first |
| Put key in `.env` but not `.env.local` | Next.js loads `.env.local` for local dev — use that name |
| Wrapped key in quotes with spaces | Use `OPENROUTER_API_KEY=sk-or-v1-...` only |
| Used OpenAI key (`sk-...`) on OpenRouter | Use an OpenRouter key from openrouter.ai/keys |
| Changed env but server still old | Restart `npm run dev` |
| Key works locally, fails on Cloudflare | Add the same vars in the Cloudflare project settings |

### Quick test

With the app running, open http://localhost:3000 and send:

```text
What is 2^10 + 15?
```

- If the pipeline runs and you get `1024 + 15 = 1039` (or similar), the API key works.
- If you see an error about `OPENROUTER_API_KEY` or `401`, re-check the steps above.

## License

MIT
