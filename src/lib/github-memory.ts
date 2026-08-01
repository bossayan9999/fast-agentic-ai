/** GitHub vault helpers via fetch – Edge / Cloudflare compatible */

const owner = process.env.GITHUB_OWNER || "bossayan9999";
const appRepo = process.env.GITHUB_REPO || "fast-agentic-ai";
const vaultOwner = process.env.VAULT_OWNER || owner;
const vaultRepo = process.env.VAULT_REPO || "obsidian-agent-vault";
const knowledgePath = process.env.VAULT_PATH || "";

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "FastAgenticAI",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function listKnowledgeFiles(): Promise<
  { name: string; path: string; sha: string; size: number }[]
> {
  if (!process.env.GITHUB_TOKEN) return [];

  try {
    const path = knowledgePath || "";
    const url = `https://api.github.com/repos/${vaultOwner}/${vaultRepo}/contents/${path}`;
    const res = await fetch(url, { headers: githubHeaders() });
    if (res.status === 404) return [];
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const files: { name: string; path: string; sha: string; size: number }[] = [];

    for (const item of data) {
      if (
        item.type === "file" &&
        (item.name.endsWith(".md") || item.name.endsWith(".txt"))
      ) {
        files.push({
          name: item.name,
          path: item.path,
          sha: item.sha,
          size: item.size || 0,
        });
      } else if (item.type === "dir" && !item.name.startsWith(".")) {
        try {
          const subRes = await fetch(
            `https://api.github.com/repos/${vaultOwner}/${vaultRepo}/contents/${item.path}`,
            { headers: githubHeaders() }
          );
          if (subRes.ok) {
            const sub = await subRes.json();
            if (Array.isArray(sub)) {
              for (const f of sub) {
                if (
                  f.type === "file" &&
                  (f.name.endsWith(".md") || f.name.endsWith(".txt"))
                ) {
                  files.push({
                    name: f.name,
                    path: f.path,
                    sha: f.sha,
                    size: f.size || 0,
                  });
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }

    return files;
  } catch (err: any) {
    console.error("listKnowledgeFiles error:", err.message);
    return [];
  }
}

export async function readKnowledgeFile(path: string): Promise<string | null> {
  if (!process.env.GITHUB_TOKEN) return null;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${vaultOwner}/${vaultRepo}/contents/${path}`,
      { headers: githubHeaders() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type !== "file" || !data.content) return null;
    return fromBase64(data.content);
  } catch (err: any) {
    console.error("readKnowledgeFile error:", err.message);
    return null;
  }
}

export async function searchKnowledge(
  query: string,
  limit = 5
): Promise<{ path: string; name: string; snippet: string }[]> {
  const files = await listKnowledgeFiles();
  const results: { path: string; name: string; snippet: string }[] = [];
  const q = query.toLowerCase();

  for (const file of files) {
    if (results.length >= limit) break;
    const content = await readKnowledgeFile(file.path);
    if (!content) continue;

    if (
      file.name.toLowerCase().includes(q) ||
      content.toLowerCase().includes(q)
    ) {
      const idx = content.toLowerCase().indexOf(q);
      let snippet = content.slice(0, 280);
      if (idx > 0) {
        const start = Math.max(0, idx - 80);
        snippet = (start > 0 ? "..." : "") + content.slice(start, start + 280);
      }
      results.push({
        path: file.path,
        name: file.name,
        snippet: snippet.replace(/\n/g, " ").trim() + "...",
      });
    }
  }

  return results;
}

export async function saveKnowledgeNote(
  filename: string,
  content: string,
  message = "Update knowledge note via Fast Agentic AI"
): Promise<{ success: boolean; path?: string; error?: string }> {
  if (!process.env.GITHUB_TOKEN) {
    return { success: false, error: "GITHUB_TOKEN not configured" };
  }

  const path = knowledgePath
    ? `${knowledgePath}/${filename.endsWith(".md") ? filename : filename + ".md"}`
    : filename.endsWith(".md")
      ? filename
      : filename + ".md";

  try {
    let sha: string | undefined;
    const existingRes = await fetch(
      `https://api.github.com/repos/${vaultOwner}/${vaultRepo}/contents/${path}`,
      { headers: githubHeaders() }
    );
    if (existingRes.ok) {
      const existing = await existingRes.json();
      if (existing.sha) sha = existing.sha;
    }

    const body: Record<string, string> = {
      message,
      content: toBase64(content),
    };
    if (sha) body.sha = sha;

    const res = await fetch(
      `https://api.github.com/repos/${vaultOwner}/${vaultRepo}/contents/${path}`,
      {
        method: "PUT",
        headers: { ...githubHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err.slice(0, 200) };
    }

    return { success: true, path };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function appendSessionLog(
  sessionId: string,
  role: "user" | "assistant",
  content: string
) {
  if (!process.env.GITHUB_TOKEN) return;

  const path = `knowledge/sessions/${sessionId}.md`;
  const timestamp = new Date().toISOString();
  const entry = `\n### ${role.toUpperCase()} — ${timestamp}\n\n${content}\n`;

  try {
    let existing = "";
    let sha: string | undefined;
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${appRepo}/contents/${path}`,
      { headers: githubHeaders() }
    );
    if (getRes.ok) {
      const data = await getRes.json();
      if (data.content) existing = fromBase64(data.content);
      sha = data.sha;
    } else {
      existing = `# Session ${sessionId}\n\nCreated: ${timestamp}\n`;
    }

    const body: Record<string, string> = {
      message: `Append ${role} message to session ${sessionId}`,
      content: toBase64(existing + entry),
    };
    if (sha) body.sha = sha;

    await fetch(
      `https://api.github.com/repos/${owner}/${appRepo}/contents/${path}`,
      {
        method: "PUT",
        headers: { ...githubHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  } catch (err: any) {
    console.error("appendSessionLog error:", err.message);
  }
}

export function getVaultInfo() {
  return {
    owner: vaultOwner,
    repo: vaultRepo,
    path: knowledgePath || "(repo root)",
    url: `https://github.com/${vaultOwner}/${vaultRepo}`,
  };
}
