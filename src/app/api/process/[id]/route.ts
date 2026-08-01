import { NextResponse } from "next/server";
import { processMediaById } from "@/lib/process-media";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

function authorized(request: Request): boolean {
  const secret = process.env.PROCESS_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) return process.env.NODE_ENV === "development";

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

export async function POST(request: Request, { params }: Params) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await processMediaById(id);
  return NextResponse.json(result, {
    status: result.ok || result.status === "skipped" ? 200 : 500,
  });
}
