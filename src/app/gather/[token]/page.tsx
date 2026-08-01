import { desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { GatherBoard } from "@/components/GatherBoard";
import { db } from "@/db";
import { contributors, media } from "@/db/schema";
import { isValidGatherToken } from "@/lib/gather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export default async function GatherPage({ params }: Props) {
  const { token } = await params;
  if (!isValidGatherToken(token)) {
    notFound();
  }

  const people = await db
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

  return (
    <main className="min-h-dvh bg-[var(--ground)]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(232,177,76,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(228,137,155,0.1),_transparent_50%)]" />
      <div className="relative">
        <GatherBoard
          token={token}
          initialPeople={people.map((p) => ({
            ...p,
            createdAt: p.createdAt.toISOString(),
          }))}
        />
      </div>
    </main>
  );
}
