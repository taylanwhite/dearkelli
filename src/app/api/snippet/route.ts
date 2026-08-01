import { NextResponse } from "next/server";
import { playableUrl } from "@/lib/blob";
import { getSnippetForWord } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word");
  if (!word) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  const typeParam = searchParams.get("type");
  const kind =
    typeParam === "phrase" || typeParam === "word" ? typeParam : "auto";

  const snippet = await getSnippetForWord(word.toLowerCase(), kind);

  // 200 with null keeps the browser console quiet when there's no audio yet
  if (!snippet) {
    return NextResponse.json({ snippet: null });
  }

  return NextResponse.json({
    ...snippet,
    blobUrl: playableUrl(snippet.blobUrl),
  });
}
