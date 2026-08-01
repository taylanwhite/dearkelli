"use client";

import Link from "next/link";
import { useState } from "react";
import {
  LightboxOverlay,
  type LightboxPhoto,
} from "@/components/LightboxOverlay";
import { playableUrl } from "@/lib/blob";

type Size = "sm" | "md" | "lg" | "xl";

type Props = {
  name: string;
  relationship?: string | null;
  avatarUrl?: string | null;
  size?: Size;
  /** Defaults to /people/[id] when id is set. Pass null for non-linking display. */
  id?: string;
  href?: string | null;
  selected?: boolean;
  showRelationship?: boolean;
  /** stack = photo above name (default). row = photo beside name. */
  layout?: "stack" | "row";
  onClick?: () => void;
  className?: string;
  /**
   * Enlarge the photo in a lightbox. Only applies when this bubble is not a
   * link or selection chip (e.g. on someone's profile page).
   */
  enlargeAvatar?: boolean;
};

const AVATAR: Record<Size, string> = {
  sm: "h-14 w-14 text-base",
  md: "h-20 w-20 text-xl",
  lg: "h-24 w-24 text-2xl",
  xl: "h-28 w-28 text-3xl sm:h-32 sm:w-32",
};

const NAME: Record<Size, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-sm",
  xl: "text-base",
};

const STACK_WIDTH: Record<Size, string> = {
  sm: "w-[4.5rem]",
  md: "w-24",
  lg: "w-28",
  xl: "w-32",
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
  href,
  selected = false,
  showRelationship = false,
  layout = "stack",
  onClick,
  className = "",
  enlargeAvatar = true,
}: Props) {
  const src = avatarUrl ? playableUrl(avatarUrl) : null;
  const destination =
    href === null ? null : (href ?? (id ? `/people/${id}` : null));
  const stacked = layout === "stack";
  const [open, setOpen] = useState(false);

  // Links and selection chips navigate/select; enlarge only on static faces
  // (profile header).
  const canEnlarge = Boolean(
    enlargeAvatar && src && !destination && !onClick,
  );

  const photo: LightboxPhoto | null =
    canEnlarge && src
      ? {
          id: id || src,
          src,
          alt: name,
          caption: name,
        }
      : null;

  const avatarRing = `relative flex shrink-0 ${AVATAR[size]} items-center justify-center overflow-hidden rounded-full bg-[var(--sage)] font-[family-name:var(--font-display)] text-[var(--ground)] shadow-[0_6px_18px_rgba(58,53,50,0.1)] transition ${
    selected
      ? "ring-[3px] ring-[var(--rose)] scale-[1.03]"
      : "ring-2 ring-[var(--rose)]/25 group-hover:ring-[var(--rose)]/55 group-hover:scale-[1.03]"
  }`;

  const avatarInner = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-full w-full object-cover" />
  ) : (
    initials(name)
  );

  const nameBlock = (
    <span
      className={`min-w-0 ${stacked ? "mt-1.5 max-w-full text-center" : "text-left"}`}
    >
      <span
        className={`block truncate font-[family-name:var(--font-display)] leading-tight ${NAME[size]} ${
          selected ? "text-[var(--rose-deep)]" : "text-[var(--ink)]/75"
        }`}
      >
        {name}
      </span>
      {showRelationship && relationship ? (
        <span className="mt-0.5 block truncate text-[10px] text-[var(--muted)]">
          {relationship}
        </span>
      ) : null}
    </span>
  );

  const shell = stacked
    ? `group flex ${STACK_WIDTH[size]} flex-col items-center touch-manipulation ${className}`
    : `group flex items-center gap-2.5 touch-manipulation ${className}`;

  const staticAvatar = <span className={avatarRing}>{avatarInner}</span>;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell}>
        {staticAvatar}
        {nameBlock}
      </button>
    );
  }

  if (destination) {
    return (
      <Link href={destination} className={shell}>
        {staticAvatar}
        {nameBlock}
      </Link>
    );
  }

  if (canEnlarge) {
    return (
      <>
        <div className={shell}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={avatarRing}
            aria-label={`Enlarge photo of ${name}`}
          >
            {avatarInner}
          </button>
          {nameBlock}
        </div>
        {photo ? (
          <LightboxOverlay
            photos={[photo]}
            index={open ? 0 : null}
            onClose={() => setOpen(false)}
            onChangeIndex={() => {}}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className={shell}>
      {staticAvatar}
      {nameBlock}
    </div>
  );
}
