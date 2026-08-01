import Link from "next/link";
import { getAdminOverview } from "@/lib/admin-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const { counts, topWords, recentUploads } = await getAdminOverview();
  const gatherToken = process.env.GATHER_TOKEN;

  const cards = [
    { label: "People", value: counts.people },
    { label: "Uploads", value: counts.uploads },
    { label: "Ready", value: counts.ready },
    { label: "Pending", value: counts.uploaded + counts.processing },
    { label: "Failed", value: counts.failed },
    { label: "Unique words", value: counts.uniqueWords },
    { label: "Word hits", value: counts.words },
    { label: "Phrases", value: counts.phrases },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-[#F6F0E8]">Overview</h1>
        <p className="mt-1 text-sm text-[#F6F0E8]/45">
          Collection health and quick links.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-[#231A33] px-4 py-4"
          >
            <p className="text-2xl text-[#E8B14C]">{card.value}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-[#F6F0E8]/40">
              {card.label}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#231A33] p-5">
        <h2 className="text-sm uppercase tracking-[0.18em] text-[#F6F0E8]/40">
          Quick links
        </h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <Link href="/admin/people" className="text-[#E8B14C] hover:underline">
              Manage people & invite links
            </Link>
          </li>
          <li>
            <Link href="/admin/media" className="text-[#E8B14C] hover:underline">
              Review uploads / requeue processing
            </Link>
          </li>
          {gatherToken ? (
            <li>
              <Link
                href={`/gather/${gatherToken}`}
                className="text-[#E8B14C] hover:underline"
              >
                Mom&apos;s gather page
              </Link>
              <span className="ml-2 text-[#F6F0E8]/35">
                /gather/{gatherToken}
              </span>
            </li>
          ) : (
            <li className="text-[#E4899B]">GATHER_TOKEN is not set</li>
          )}
          <li>
            <Link href="/" className="text-[#F6F0E8]/70 hover:underline">
              Open her site
            </Link>
          </li>
        </ul>
        <p className="mt-4 text-xs text-[#F6F0E8]/35">
          After uploads land, process locally with{" "}
          <code className="text-[#F6F0E8]/55">npm run process</code>
        </p>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-sm uppercase tracking-[0.18em] text-[#F6F0E8]/40">
            Recent uploads
          </h2>
          {recentUploads.length === 0 ? (
            <p className="mt-4 text-sm text-[#F6F0E8]/45">None yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {recentUploads.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-white/8 bg-[#231A33]/80 px-3 py-3 text-sm"
                >
                  <p className="text-[#F6F0E8]">
                    {item.title || item.originalFilename || item.kind}
                  </p>
                  <p className="text-xs text-[#F6F0E8]/40">
                    {item.contributorName} · {item.status} · {item.kind}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-sm uppercase tracking-[0.18em] text-[#F6F0E8]/40">
            Top words
          </h2>
          {topWords.length === 0 ? (
            <p className="mt-4 text-sm text-[#F6F0E8]/45">
              Process some uploads to fill the cloud.
            </p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {topWords.map((w) => (
                <li key={w.normalized} className="text-sm">
                  <span className="text-[#E8B14C]">{w.normalized}</span>
                  <span className="ml-1 text-[#F6F0E8]/35">{w.totalCount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
