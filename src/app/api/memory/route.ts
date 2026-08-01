import { NextRequest, NextResponse } from "next/server";
import {
  listKnowledgeFiles,
  searchKnowledge,
  saveKnowledgeNote,
} from "@/lib/github-memory";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  try {
    if (q) {
      const results = await searchKnowledge(q);
      return NextResponse.json({ results });
    }
    const files = await listKnowledgeFiles();
    return NextResponse.json({ files });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { filename, content, message } = await req.json();
    if (!filename || !content) {
      return NextResponse.json(
        { error: "filename and content required" },
        { status: 400 }
      );
    }
    const result = await saveKnowledgeNote(filename, content, message);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
