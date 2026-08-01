import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SendForm } from "@/components/SendForm";
import { db } from "@/db";
import { contributors } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export default async function SendPage({ params }: Props) {
  const { token } = await params;

  const [contributor] = await db
    .select()
    .from(contributors)
    .where(eq(contributors.inviteToken, token))
    .limit(1);

  if (!contributor) {
    notFound();
  }

  const isGeneric = contributor.inviteToken.startsWith("open-");

  return (
    <main className="min-h-dvh bg-[var(--ground)]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(201,162,39,0.22),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(44,90,69,0.1),_transparent_50%)]" />
      <div className="relative">
        <SendForm
          contributor={{
            id: contributor.id,
            name: contributor.name,
            relationship: contributor.relationship,
            inviteToken: contributor.inviteToken,
            avatarUrl: contributor.avatarUrl,
          }}
          isGeneric={isGeneric}
        />
      </div>
    </main>
  );
}
