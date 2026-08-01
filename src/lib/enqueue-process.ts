import { after } from "next/server";
import { processMediaById } from "@/lib/process-media";

/**
 * Schedule AI analysis for an upload without blocking the uploader.
 *
 * On Vercel, kicks `/api/process/[id]` (maxDuration 300s) after the response.
 * Locally (no public host), runs the pipeline in-process via `after()`.
 */
export function scheduleMediaProcessing(mediaId: string) {
  const secret = process.env.PROCESS_SECRET || process.env.ADMIN_PASSWORD;
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    null;

  after(async () => {
    if (secret && host) {
      const base = host.startsWith("http") ? host : `https://${host}`;
      try {
        const res = await fetch(`${base}/api/process/${mediaId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}` },
        });
        if (!res.ok) {
          console.error(
            "process route failed",
            mediaId,
            res.status,
            await res.text().catch(() => ""),
          );
        }
        return;
      } catch (err) {
        console.warn("process HTTP enqueue failed, running in-process", err);
      }
    }

    await processMediaById(mediaId);
  });
}
