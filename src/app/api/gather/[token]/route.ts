import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contributors, media } from "@/db/schema";
import { isValidGatherToken, makeInviteToken } from "@/lib/gather";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

async function listPeople() {
  return db
    .select({
      id: contributors.id,
      name: contributors.name,
      relationship: contributors.relationship,
      inviteToken: contributors.inviteToken,
      createdAt: contributors.createdAt,
      uploadCount: sql<number>`count(${media.id})::int`,
    })
    .from(contributors)
    .leftJoin(media, eq(media.contributorId, contributors.id))
    .groupBy(contributors.id)
    .orderBy(desc(contributors.createdAt));
}

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  if (!isValidGatherToken(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const people = await listPeople();
  return NextResponse.json({ people });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  relationship: z.string().trim().max(80).optional().nullable(),
});

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  if (!isValidGatherToken(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = createSchema.parse(await request.json());
    const inviteToken = makeInviteToken();

    const [person] = await db
      .insert(contributors)
      .values({
        name: body.name,
        relationship: body.relationship?.trim() || null,
        inviteToken,
      })
      .returning({
        id: contributors.id,
        name: contributors.name,
        relationship: contributors.relationship,
        inviteToken: contributors.inviteToken,
        createdAt: contributors.createdAt,
      });

    return NextResponse.json({
      ...person,
      uploadCount: 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Need at least a name." },
        { status: 400 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "Couldn't add them just yet." },
      { status: 500 },
    );
  }
}
