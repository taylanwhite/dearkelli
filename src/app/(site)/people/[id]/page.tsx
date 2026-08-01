import Link from "next/link";
import { notFound } from "next/navigation";
import { playableUrl } from "@/lib/blob";
import { getPerson } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PersonPage({ params }: Props) {
  const { id } = await params;
  const data = await getPerson(id);
  if (!data) notFound();

  const { person, clips, topWords } = data;
  const photos = clips.filter((c) => c.kind === "image");
  const spoken = clips.filter((c) => c.kind !== "image");

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/people"
        className="text-sm text-[var(--cream)]/45 transition hover:text-[var(--cream)]/75"
      >
        ← Everyone
      </Link>

      <header className="mt-6">
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--cream)]">
          {person.name}
        </h1>
        {person.relationship && (
          <p className="mt-2 text-[var(--blush)]">{person.relationship}</p>
        )}
      </header>

      {topWords.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--cream)]/40">
            Words they used most
          </h2>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            {topWords.map((w) => (
              <li key={w.normalized}>
                <Link
                  href={`/words/${encodeURIComponent(w.normalized)}`}
                  className="font-[family-name:var(--font-display)] text-lg text-[var(--gold)]/90 transition hover:text-[var(--gold)]"
                >
                  {w.normalized}
                  <span className="ml-1 text-sm text-[var(--cream)]/35">
                    {w.totalCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {spoken.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--cream)]/40">
            What they said
          </h2>
          <ul className="mt-5 space-y-4">
            {spoken.map((clip) => (
              <li
                key={clip.id}
                className="overflow-hidden rounded-2xl bg-[var(--surface)]"
              >
                {clip.kind === "video" ? (
                  <video
                    src={playableUrl(clip.blobUrl)}
                    poster={
                      clip.posterUrl ? playableUrl(clip.posterUrl) : undefined
                    }
                    controls
                    playsInline
                    className="aspect-video w-full bg-black object-contain"
                  />
                ) : (
                  <div className="px-5 py-6">
                    <audio
                      src={playableUrl(clip.blobUrl)}
                      controls
                      className="w-full"
                    />
                  </div>
                )}
                <div className="px-5 py-4">
                  <p className="font-[family-name:var(--font-display)] text-lg text-[var(--cream)]">
                    {clip.title || "Untitled"}
                  </p>
                  {clip.summary && (
                    <p className="mt-1 text-sm leading-relaxed text-[var(--cream)]/55">
                      {clip.summary}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {photos.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--cream)]/40">
            Photos
          </h2>
          <ul className="mt-5 grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <li key={photo.id} className="overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={playableUrl(photo.posterUrl || photo.blobUrl)}
                  alt={photo.caption || photo.title || `From ${person.name}`}
                  className="aspect-square w-full object-cover"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
