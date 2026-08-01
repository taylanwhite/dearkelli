"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { EnlargeableImage } from "@/components/EnlargeableImage";
import { playableUrl } from "@/lib/blob";
import { isOverUploadLimit, uploadLimitMessage } from "@/lib/media";

type Props = {
  token: string;
  initialUrl?: string | null;
  onUploaded?: (url: string) => void;
};

export function PortraitUpload({ token, initialUrl, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(initialUrl ?? null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">(
    initialUrl ? "done" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    setRemoteUrl(initialUrl ?? null);
    if (initialUrl) {
      setStatus("done");
    } else {
      setLocalPreview(null);
      setStatus((prev) => (prev === "uploading" ? prev : "idle"));
    }
  }, [initialUrl]);

  useEffect(() => {
    if (!thanks) return;
    const t = window.setTimeout(() => setThanks(false), 2800);
    return () => window.clearTimeout(t);
  }, [thanks]);

  const previewSrc = localPreview
    ? localPreview
    : remoteUrl
      ? playableUrl(remoteUrl, { token })
      : null;

  async function handleFile(file: File) {
    setError(null);
    setThanks(false);

    if (isOverUploadLimit(file.size, "image")) {
      setStatus("error");
      setError(uploadLimitMessage(file.name, "image"));
      return;
    }

    setStatus("uploading");
    const local = URL.createObjectURL(file);
    setLocalPreview(local);

    try {
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/blob/upload",
        clientPayload: JSON.stringify({
          token,
          contentType: file.type || "image/jpeg",
          filename: file.name,
          purpose: "avatar",
        }),
      });

      const res = await fetch(`/api/contributor/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: blob.url }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Couldn't save your photo");
      }

      setRemoteUrl(blob.url);
      setLocalPreview(null);
      URL.revokeObjectURL(local);
      setStatus("done");
      setThanks(true);
      onUploaded?.(blob.url);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Couldn't upload that");
    }
  }

  return (
    <div className="rounded-2xl bg-[var(--surface)] px-5 py-6 text-center">
      <p className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
        A photo of you
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--cream)]/60">
        Just your face, or you with her — so she knows who this is from.
      </p>

      {previewSrc ? (
        <div className="mx-auto mt-5 w-28">
          <EnlargeableImage
            src={previewSrc}
            alt="Your photo"
            rounded="rounded-full"
            className="mx-auto h-28 w-28 ring-2 ring-[var(--gold)]/40"
            imgClassName="h-full w-full object-cover"
            caption="Your photo"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status === "uploading"}
          className="mx-auto mt-5 flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-[var(--forest)] text-[var(--ground)] ring-2 ring-[var(--gold)]/40 transition hover:ring-[var(--gold)] disabled:opacity-70"
        >
          <span className="px-3 text-sm leading-snug text-[var(--ground)]/90">
            {status === "uploading" ? "Sending…" : "Add photo"}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {thanks && (
        <p className="mt-3 text-sm text-[var(--gold)]">Got it. Thank you.</p>
      )}
      {error && <p className="mt-3 text-sm text-[var(--blush)]">{error}</p>}
      {status !== "done" && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 text-sm text-[var(--cream)]/45 underline-offset-2 hover:underline"
        >
          Choose from your phone
        </button>
      )}
      {status === "done" && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 block w-full text-sm text-[var(--cream)]/40 underline-offset-2 hover:underline"
        >
          Use a different photo
        </button>
      )}
    </div>
  );
}
