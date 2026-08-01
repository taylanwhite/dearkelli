import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { media } from "@/db/schema";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Increment view count when Kelli opens/plays something on the gated site. */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const password = process.env.SITE_PASSWORD;
  const jar = await cookies();
  const gate = jar.get("kelli_gate")?.value;

  // Only her site session counts, not admin/open-file or send links.
  if (password && gate !== password) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!password && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [updated] = await db
    .update(media)
    .set({
      viewCount: sql`${media.viewCount} + 1`,
      lastViewedAt: new Date(),
    })
    .where(eq(media.id, id))
    .returning({ id: media.id, viewCount: media.viewCount });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
