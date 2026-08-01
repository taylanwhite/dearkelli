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
    <main className="min-h-dvh bg-[var(--ground)] pt-[env(safe-area-inset-top)]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(176,137,122,0.16),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(95,110,102,0.08),_transparent_50%)]" />
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
