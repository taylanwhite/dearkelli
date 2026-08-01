import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { contributors, media } from "@/db/schema";
import { ALLOWED_CONTENT_TYPES, kindFromMime } from "@/lib/media";

export const runtime = "nodejs";

type TokenPayload = {
  contributorId: string;
  kind: "video" | "audio" | "image";
  originalFilename: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!clientPayload) {
          throw new Error("Missing upload context");
        }

        const parsed = JSON.parse(clientPayload) as {
          token?: string;
          contentType?: string;
          filename?: string;
        };

        if (!parsed.token) {
          throw new Error("Invite token required");
        }

        const [contributor] = await db
          .select()
          .from(contributors)
          .where(eq(contributors.inviteToken, parsed.token))
          .limit(1);

        if (!contributor) {
          throw new Error("This invite link isn't recognized");
        }

        const contentType = parsed.contentType || "application/octet-stream";
        const filename = parsed.filename || pathname;
        const kind = kindFromMime(contentType, filename);

        const payload: TokenPayload = {
          contributorId: contributor.id,
          kind,
          originalFilename: filename,
        };

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          addRandomSuffix: true,
          maximumSizeInBytes: 500 * 1024 * 1024,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Production webhook. Locally this needs a public URL (ngrok).
        // Client also POSTs /api/media as a reliable fallback.
        if (!tokenPayload) return;

        try {
          const payload = JSON.parse(tokenPayload) as TokenPayload;
          const existing = await db
            .select({ id: media.id })
            .from(media)
            .where(eq(media.blobUrl, blob.url))
            .limit(1);

          if (existing.length > 0) return;

          await db.insert(media).values({
            contributorId: payload.contributorId,
            blobUrl: blob.url,
            kind: payload.kind,
            status: "uploaded",
            originalFilename: payload.originalFilename,
          });
        } catch (error) {
          console.error("onUploadCompleted failed", error);
          throw error;
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
