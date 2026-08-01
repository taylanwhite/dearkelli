import { NextResponse } from "next/server";
import { getSnippetForWord } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word");
  if (!word) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  const snippet = await getSnippetForWord(word.toLowerCase());
  if (!snippet) {
    return NextResponse.json({ error: "No snippet" }, { status: 404 });
  }

  return NextResponse.json(snippet);
}
