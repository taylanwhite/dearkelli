import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAdminAuthenticated, isAuthenticated } from "@/lib/auth";
import { BLOB_ACCESS } from "@/lib/blob";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const allowed =
    (await isAuthenticated().catch(() => false)) ||
    (await isAdminAuthenticated().catch(() => false));

  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // Only allow our Blob host
  try {
    const host = new URL(url).hostname;
    if (!host.endsWith(".blob.vercel-storage.com")) {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const result = await get(url, { access: BLOB_ACCESS });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const headers = new Headers();
  const contentType =
    result.blob.contentType ||
    result.headers.get("content-type") ||
    "application/octet-stream";
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "private, max-age=3600");
  const contentLength = result.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new NextResponse(result.stream, { headers });
}
