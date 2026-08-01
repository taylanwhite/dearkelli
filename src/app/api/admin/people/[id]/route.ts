import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contributors } from "@/db/schema";
import { makeInviteToken } from "@/lib/gather";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  relationship: z.string().trim().max(80).nullable().optional(),
  regenerateToken: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const body = updateSchema.parse(await request.json());

    const [existing] = await db
      .select()
      .from(contributors)
      .where(eq(contributors.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(contributors)
      .set({
        name: body.name ?? existing.name,
        relationship:
          body.relationship === undefined
            ? existing.relationship
            : body.relationship,
        inviteToken: body.regenerateToken
          ? makeInviteToken()
          : existing.inviteToken,
      })
      .where(eq(contributors.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't update." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;

  const [existing] = await db
    .select({ id: contributors.id })
    .from(contributors)
    .where(eq(contributors.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(contributors).where(eq(contributors.id, id));
  return NextResponse.json({ ok: true });
}
