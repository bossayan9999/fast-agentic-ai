import { Octokit } from "@octokit/rest";

const owner = process.env.GITHUB_OWNER || "bossayan9999";
const repo = process.env.GITHUB_REPO || "fast-agentic-ai";
const knowledgePath = "knowledge";

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
      owner,
      repo,
      path: knowledgePath,
    });

    if (!Array.isArray(data)) return [];

    return data
      .filter((f) => f.type === "file" && (f.name.endsWith(".md") || f.name.endsWith(".txt")))
      .map((f) => ({
        name: f.name,
        path: f.path,
        sha: f.sha!,
        size: f.size || 0,
      }));
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
      owner,
      repo,
      path,
    });

    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return null;
    }

    return Buffer.from(data.content, "base64").toString("utf-8");
  } catch (err: any) {
    console.error("readKnowledgeFile error:", err.message);
    return null;
  }
}

export async function searchKnowledge(query: string, limit = 5): Promise<
  { path: string; name: string; snippet: string }[]
> {
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
  const octokit = getOctokit();
  if (!octokit) {
    return { success: false, error: "GITHUB_TOKEN not configured" };
  }

  const path = `${knowledgePath}/${filename.endsWith(".md") ? filename : filename + ".md"}`;

  try {
    let sha: string | undefined;
    try {
      const existing = await octokit.repos.getContent({ owner, repo, path });
      if (!Array.isArray(existing.data) && existing.data.type === "file") {
        sha = existing.data.sha;
      }
    } catch {
      // new file
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString("base64"),
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
      const { data } = await octokit.repos.getContent({ owner, repo, path });
      if (!Array.isArray(data) && data.type === "file" && "content" in data) {
        existing = Buffer.from(data.content, "base64").toString("utf-8");
        sha = data.sha;
      }
    } catch {
      existing = `# Session ${sessionId}\n\nCreated: ${timestamp}\n`;
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Append ${role} message to session ${sessionId}`,
      content: Buffer.from(existing + entry).toString("base64"),
      sha,
    });
  } catch (err: any) {
    console.error("appendSessionLog error:", err.message);
  }
}
