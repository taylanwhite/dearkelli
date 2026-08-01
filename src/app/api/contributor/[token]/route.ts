import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contributors } from "@/db/schema";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;

  const [contributor] = await db
    .select({
      id: contributors.id,
      name: contributors.name,
      relationship: contributors.relationship,
      inviteToken: contributors.inviteToken,
      avatarUrl: contributors.avatarUrl,
    })
    .from(contributors)
    .where(eq(contributors.inviteToken, token))
    .limit(1);

  if (!contributor) {
    return NextResponse.json(
      { error: "This invite link isn't recognized" },
      { status: 404 },
    );
  }

  return NextResponse.json(contributor);
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  relationship: z.string().trim().max(80).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const { token } = await params;

  try {
    const body = updateSchema.parse(await request.json());

    const [existing] = await db
      .select()
      .from(contributors)
      .where(eq(contributors.inviteToken, token))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "This invite link isn't recognized" },
        { status: 404 },
      );
    }

    // Generic fallback token: allow renaming. Named invites: name stays.
    const isGeneric = existing.inviteToken.startsWith("open-");
    const [updated] = await db
      .update(contributors)
      .set({
        name: isGeneric && body.name ? body.name : existing.name,
        relationship:
          body.relationship === undefined
            ? existing.relationship
            : body.relationship,
        avatarUrl:
          body.avatarUrl === undefined
            ? existing.avatarUrl
            : body.avatarUrl,
      })
      .where(eq(contributors.id, existing.id))
      .returning({
        id: contributors.id,
        name: contributors.name,
        relationship: contributors.relationship,
        inviteToken: contributors.inviteToken,
        avatarUrl: contributors.avatarUrl,
      });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Couldn't update that" },
      { status: 500 },
    );
  }
}
