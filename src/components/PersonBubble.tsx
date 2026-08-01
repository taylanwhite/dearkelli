import Link from "next/link";
import { playableUrl } from "@/lib/blob";

type Props = {
  id: string;
  name: string;
  relationship?: string | null;
  avatarUrl?: string | null;
  size?: "md" | "lg";
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function PersonBubble({
  id,
  name,
  relationship,
  avatarUrl,
  size = "md",
}: Props) {
  const dim = size === "lg" ? "h-24 w-24 text-2xl" : "h-20 w-20 text-xl";
  const src = avatarUrl ? playableUrl(avatarUrl) : null;

  return (
    <Link
      href={`/people/${id}`}
      className="group flex w-28 flex-col items-center text-center sm:w-32"
    >
      <span
        className={`relative flex ${dim} items-center justify-center overflow-hidden rounded-full bg-[var(--forest)] font-[family-name:var(--font-display)] text-[var(--ground)] shadow-[0_8px_24px_rgba(30,61,48,0.12)] ring-2 ring-[var(--gold)]/30 transition group-hover:ring-[var(--gold)] group-hover:scale-[1.04]`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          initials(name)
        )}
      </span>
      <span className="mt-3 font-[family-name:var(--font-display)] text-lg leading-tight text-[var(--forest-deep)]">
        {name}
      </span>
      {relationship ? (
        <span className="mt-0.5 text-xs text-[var(--gold-deep)]">
          {relationship}
        </span>
      ) : null}
    </Link>
  );
}
