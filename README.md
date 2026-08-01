# Fast Agentic AI Engineering Loop

Full-stack web application that implements the **Fast Agentic AI Engineering Loop** with:

- **OpenRouter** – multi-model backend (Claude, GPT-4o, Gemini, Llama, DeepSeek, …)
- **GitHub** as Obsidian-style Knowledge Vault + Backup Repo
- **Cloudflare Pages / Workers** ready deployment
- Real-time SSE streaming of the agentic pipeline steps

## Architecture

```
User Query
    ↓
Intent Analysis  →  Task Planning  →  Plugins & Tools
    ↓                                      ↓
Memory & Context (Obsidian Vault on GitHub)   Action Execution
    ↓                                      ↓
              MCP (Meta-Controller & Planner)
                        ↓
              Answer Generator → User Response
                        ↑
                  Feedback Loop
```

## Quick Start (Local)

### 1. Clone & install

```bash
git clone https://github.com/bossayan9999/fast-agentic-ai.git
cd fast-agentic-ai
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxx          # required – https://openrouter.ai/keys
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet  # or any OpenRouter model

# Optional – enables real GitHub Vault search + session logging
GITHUB_TOKEN=ghp_xxxxxxxx
GITHUB_OWNER=bossayan9999
GITHUB_REPO=fast-agentic-ai
```

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000

## Deploy to Cloudflare Pages

This project is configured for `@cloudflare/next-on-pages`.

```bash
npm install
npm run pages:build
npm run preview   # local preview
npm run deploy    # deploy
```

Or connect the GitHub repo in the [Cloudflare Pages dashboard](https://dash.cloudflare.com).

**Build settings:**
- Framework preset: Next.js
- Build command: `npx @cloudflare/next-on-pages`
- Build output directory: `.vercel/output/static`

Add the same environment variables in the Cloudflare Pages project settings.

## GitHub as Knowledge Vault

- All `.md` files under `/knowledge` are searchable by the agent.
- Sessions can be automatically logged to `knowledge/sessions/`.
- Point `GITHUB_REPO` at any repository that contains markdown notes for an Obsidian + GitHub backup workflow.

## API

### `POST /api/chat`
Streaming SSE endpoint.

### `GET /api/memory?q=keyword`
Search the knowledge vault.

### `POST /api/memory`
Save a note to the vault.

## License

MIT
