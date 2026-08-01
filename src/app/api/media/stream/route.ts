import { get } from "@vercel/blob";
import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { contributors, media } from "@/db/schema";
import { isAdminAuthenticated, isAuthenticated } from "@/lib/auth";
import { BLOB_ACCESS } from "@/lib/blob";

export const runtime = "nodejs";

async function contributorCanAccessBlob(
  inviteToken: string,
  blobUrl: string,
): Promise<boolean> {
  const [contributor] = await db
    .select({
      id: contributors.id,
      avatarUrl: contributors.avatarUrl,
    })
    .from(contributors)
    .where(eq(contributors.inviteToken, inviteToken))
    .limit(1);

  if (!contributor) return false;
  if (contributor.avatarUrl === blobUrl) return true;

  const [owned] = await db
    .select({ id: media.id })
    .from(media)
    .where(
      and(
        eq(media.contributorId, contributor.id),
        or(
          eq(media.blobUrl, blobUrl),
          eq(media.posterUrl, blobUrl),
          eq(media.playbackUrl, blobUrl),
        ),
      ),
    )
    .limit(1);

  return Boolean(owned);
}

/**
 * Stream a private blob to the browser.
 * Forwards Range requests so video/audio can start quickly without
 * downloading the whole file through our function first.
 *
 * Allowed for: site (Kelli), admin, or a contributor invite token that
 * owns the requested blob (so send-page previews work).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const inviteToken = searchParams.get("token");

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

  const siteOrAdmin =
    (await isAuthenticated().catch(() => false)) ||
    (await isAdminAuthenticated().catch(() => false));

  if (!siteOrAdmin) {
    if (!inviteToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const owns = await contributorCanAccessBlob(inviteToken, url).catch(
      () => false,
    );
    if (!owns) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Processed assets (poster/thumb/full/playback) are immutable per URL, so
  // let browsers keep them for a month. This is the biggest lever on repeat
  // Blob Data Transfer cost: a re-watch/re-view is served from cache for free.
  const isProcessed = url.includes("/processed/");
  const cacheControl = isProcessed
    ? "private, max-age=2592000, immutable"
    : "private, max-age=86400";

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
        "Cache-Control": cacheControl,
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
  headers.set("Cache-Control", cacheControl);
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
