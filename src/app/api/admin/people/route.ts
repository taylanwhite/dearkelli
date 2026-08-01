import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contributors, media } from "@/db/schema";
import { makeInviteToken } from "@/lib/gather";

export const runtime = "nodejs";

export async function GET() {
  const people = await db
    .select({
      id: contributors.id,
      name: contributors.name,
      relationship: contributors.relationship,
      inviteToken: contributors.inviteToken,
      createdAt: contributors.createdAt,
      uploadCount: sql<number>`count(${media.id})::int`,
      readyCount: sql<number>`count(*) filter (where ${media.status} = 'ready')::int`,
      pendingCount: sql<number>`count(*) filter (where ${media.status} in ('uploaded', 'processing'))::int`,
      failedCount: sql<number>`count(*) filter (where ${media.status} = 'failed')::int`,
    })
    .from(contributors)
    .leftJoin(media, eq(media.contributorId, contributors.id))
    .groupBy(contributors.id)
    .orderBy(desc(contributors.createdAt));

  return NextResponse.json({ people });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  relationship: z.string().trim().max(80).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const [person] = await db
      .insert(contributors)
      .values({
        name: body.name,
        relationship: body.relationship?.trim() || null,
        inviteToken: makeInviteToken(),
      })
      .returning();

    return NextResponse.json(person);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Need a name." }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't add them." }, { status: 500 });
  }
}
