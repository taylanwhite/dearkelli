import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAdminAuthenticated, isAuthenticated } from "@/lib/auth";
import { BLOB_ACCESS } from "@/lib/blob";

export const runtime = "nodejs";

/**
 * Stream a private blob to the browser.
 * Forwards Range requests so video/audio can start quickly without
 * downloading the whole file through our function first.
 */
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

  try {
    const host = new URL(url).hostname;
    if (!host.endsWith(".blob.vercel-storage.com")) {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const range = request.headers.get("range") || undefined;
  const ifNoneMatch = request.headers.get("if-none-match") || undefined;

  let result: Awaited<ReturnType<typeof get>>;
  try {
    result = await get(url, {
      access: BLOB_ACCESS,
      ifNoneMatch,
      headers: range ? { Range: range } : undefined,
    });
  } catch (err) {
    console.error("blob stream failed", err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (result.statusCode === 304) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: result.blob.etag,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (!result.stream) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const upstream = result.headers;
  const headers = new Headers();
  const contentType =
    result.blob.contentType ||
    upstream.get("content-type") ||
    "application/octet-stream";
  headers.set("Content-Type", contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("X-Content-Type-Options", "nosniff");

  const etag = upstream.get("etag") || result.blob.etag;
  if (etag) headers.set("ETag", etag);

  const contentRange = upstream.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  const contentLength = upstream.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  const status = contentRange ? 206 : 200;

  return new NextResponse(result.stream, { status, headers });
}
