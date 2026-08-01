"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { stopAllMediaPlayback } from "@/lib/media-playback";

/** Pause every media element when the route changes (App Router keeps audio otherwise). */
export function StopMediaOnNavigate() {
  const pathname = usePathname();

  useEffect(() => {
    stopAllMediaPlayback();
  }, [pathname]);

  return null;
}
