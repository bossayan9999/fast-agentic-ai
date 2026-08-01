import { Octokit } from "@octokit/rest";

function toBase64(text: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(text).toString("base64");
  }
  return btoa(unescape(encodeURIComponent(text)));
}

function fromBase64(b64: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf-8");
  }
  return decodeURIComponent(escape(atob(b64)));
}

const owner = process.env.GITHUB_OWNER || "bossayan9999";
const appRepo = process.env.GITHUB_REPO || "fast-agentic-ai";
const vaultOwner = process.env.VAULT_OWNER || owner;
const vaultRepo = process.env.VAULT_REPO || "obsidian-agent-vault";
const knowledgePath = process.env.VAULT_PATH || "";

function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  return new Octokit({ auth: token });
}

export async function listKnowledgeFiles(): Promise<
  { name: string; path: string; sha: string; size: number }[]
> {
  const octokit = getOctokit();
  if (!octokit) return [];

  try {
    const { data } = await octokit.repos.getContent({
      owner: vaultOwner,
      repo: vaultRepo,
      path: knowledgePath || "",
    });

    if (!Array.isArray(data)) return [];

    const files: { name: string; path: string; sha: string; size: number }[] = [];

    for (const item of data) {
      if (item.type === "file" && (item.name.endsWith(".md") || item.name.endsWith(".txt"))) {
        files.push({
          name: item.name,
          path: item.path,
          sha: item.sha!,
          size: item.size || 0,
        });
      } else if (item.type === "dir" && !item.name.startsWith(".")) {
        try {
          const sub = await octokit.repos.getContent({
            owner: vaultOwner,
            repo: vaultRepo,
            path: item.path,
          });
          if (Array.isArray(sub.data)) {
            for (const f of sub.data) {
              if (f.type === "file" && (f.name.endsWith(".md") || f.name.endsWith(".txt"))) {
                files.push({
                  name: f.name,
                  path: f.path,
                  sha: f.sha!,
                  size: f.size || 0,
                });
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
    if (err.status === 404) return [];
    console.error("listKnowledgeFiles error:", err.message);
    return [];
  }
}

export async function readKnowledgeFile(path: string): Promise<string | null> {
  const octokit = getOctokit();
  if (!octokit) return null;

  try {
    const { data } = await octokit.repos.getContent({
      owner: vaultOwner,
      repo: vaultRepo,
      path,
    });

    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return null;
    }

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

    if (file.name.toLowerCase().includes(q) || content.toLowerCase().includes(q)) {
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
  const octokit = getOctokit();
  if (!octokit) {
    return { success: false, error: "GITHUB_TOKEN not configured" };
  }

  const path = knowledgePath
    ? `${knowledgePath}/${filename.endsWith(".md") ? filename : filename + ".md"}`
    : filename.endsWith(".md")
    ? filename
    : filename + ".md";

  try {
    let sha: string | undefined;
    try {
      const existing = await octokit.repos.getContent({
        owner: vaultOwner,
        repo: vaultRepo,
        path,
      });
      if (!Array.isArray(existing.data) && existing.data.type === "file") {
        sha = existing.data.sha;
      }
    } catch {
      // new file
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: vaultOwner,
      repo: vaultRepo,
      path,
      message,
      content: toBase64(content),
      sha,
    });

    return { success: true, path };
  } catch (err: any) {
    console.error("saveKnowledgeNote error:", err.message);
    return { success: false, error: err.message };
  }
}

export async function appendSessionLog(
  sessionId: string,
  role: "user" | "assistant",
  content: string
) {
  const octokit = getOctokit();
  if (!octokit) return;

  const path = `knowledge/sessions/${sessionId}.md`;
  const timestamp = new Date().toISOString();
  const entry = `\n### ${role.toUpperCase()} — ${timestamp}\n\n${content}\n`;

  try {
    let existing = "";
    let sha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo: appRepo,
        path,
      });
      if (!Array.isArray(data) && data.type === "file" && "content" in data) {
        existing = fromBase64(data.content);
        sha = data.sha;
      }
    } catch {
      existing = `# Session ${sessionId}\n\nCreated: ${timestamp}\n`;
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo: appRepo,
      path,
      message: `Append ${role} message to session ${sessionId}`,
      content: toBase64(existing + entry),
      sha,
    });
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
