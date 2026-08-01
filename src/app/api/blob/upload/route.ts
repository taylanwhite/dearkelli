import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { contributors } from "@/db/schema";
import { ensureMediaRecord } from "@/lib/ensure-media";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  kindFromMime,
} from "@/lib/media";

export const runtime = "nodejs";

type TokenPayload = {
  contributorId: string;
  kind: "video" | "audio" | "image";
  originalFilename: string;
  purpose?: "avatar" | "media";
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
          purpose?: "avatar" | "media";
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
          purpose: parsed.purpose === "avatar" ? "avatar" : "media",
        };

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Production webhook. Locally this needs a public URL (ngrok).
        // Client also POSTs /api/media as a reliable fallback.
        if (!tokenPayload) return;

        try {
          const payload = JSON.parse(tokenPayload) as TokenPayload;

          // Profile portraits live on the contributor only, not in the album.
          if (payload.purpose === "avatar") {
            await db
              .update(contributors)
              .set({ avatarUrl: blob.url })
              .where(eq(contributors.id, payload.contributorId));
            return;
          }

          await ensureMediaRecord({
            contributorId: payload.contributorId,
            blobUrl: blob.url,
            kind: payload.kind,
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
