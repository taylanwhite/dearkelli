"use client";

import { upload } from "@vercel/blob/client";
import { useCallback, useRef, useState } from "react";
import {
  isOverUploadLimit,
  uploadLimitMessage,
} from "@/lib/media";

type FileStatus = "queued" | "uploading" | "done" | "error";

type TrackedFile = {
  id: string;
  file: File;
  progress: number;
  status: FileStatus;
  error?: string;
};

type Props = {
  token: string;
  onAllSettled?: () => void;
};

type MediaKind = "image" | "video" | "audio" | "other";

function kindFromFile(file: File): MediaKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  const name = file.name.toLowerCase();
  if (/\.(heic|heif|jpe?g|png|gif|webp|bmp|tiff?)$/.test(name)) return "image";
  if (/\.(mp4|mov|m4v|webm|3gp|avi)$/.test(name)) return "video";
  if (/\.(m4a|mp3|wav|aac|ogg|caf|flac|amr)$/.test(name)) return "audio";
  return "other";
}

function thankYouCopy(done: TrackedFile[]) {
  const kinds = new Set(done.map((f) => kindFromFile(f.file)));
  const plural = done.length > 1;

  if (kinds.size === 1 && kinds.has("image")) {
    return {
      title: "Thank you.",
      body: plural
        ? "She'll love seeing these."
        : "I'm sure she'll love to see this.",
    };
  }
  if (kinds.size === 1 && kinds.has("video")) {
    return {
      title: "Thank you.",
      body: plural
        ? "She'll love watching these."
        : "She'll love watching this.",
    };
  }
  if (kinds.size === 1 && kinds.has("audio")) {
    return {
      title: "Thank you.",
      body: plural
        ? "She'll cherish every word."
        : "She'll cherish every word.",
    };
  }

  return {
    title: "Thank you.",
    body: "She'll be so glad you shared these.",
  };
}

function readMediaMeta(
  file: File,
): Promise<{ width?: number; height?: number; durationSeconds?: number }> {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({});
      };
      img.src = url;
      return;
    }

    if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
      const url = URL.createObjectURL(file);
      const el = document.createElement(
        file.type.startsWith("video/") ? "video" : "audio",
      );
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        const meta: {
          width?: number;
          height?: number;
          durationSeconds?: number;
        } = {
          durationSeconds: Number.isFinite(el.duration) ? el.duration : undefined,
        };
        if ("videoWidth" in el) {
          meta.width = (el as HTMLVideoElement).videoWidth || undefined;
          meta.height = (el as HTMLVideoElement).videoHeight || undefined;
        }
        resolve(meta);
        URL.revokeObjectURL(url);
      };
      el.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({});
      };
      el.src = url;
      return;
    }

    resolve({});
  });
}

export function UploadZone({ token, onAllSettled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<TrackedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const uploading = files.some((f) => f.status === "uploading");

  const uploadOne = useCallback(
    async (tracked: TrackedFile) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === tracked.id
            ? { ...f, status: "uploading", progress: 0, error: undefined }
            : f,
        ),
      );

      try {
        const blob = await upload(tracked.file.name, tracked.file, {
          access: "private",
          handleUploadUrl: "/api/blob/upload",
          multipart: tracked.file.size > 4 * 1024 * 1024,
          clientPayload: JSON.stringify({
            token,
            contentType: tracked.file.type || "application/octet-stream",
            filename: tracked.file.name,
          }),
          onUploadProgress: ({ percentage }) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === tracked.id ? { ...f, progress: percentage } : f,
              ),
            );
          },
        });

        const meta = await readMediaMeta(tracked.file);

        await fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            blobUrl: blob.url,
            contentType: tracked.file.type || "application/octet-stream",
            filename: tracked.file.name,
            ...meta,
          }),
        });

        setFiles((prev) =>
          prev.map((f) =>
            f.id === tracked.id
              ? { ...f, status: "done", progress: 100 }
              : f,
          ),
        );
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === tracked.id
              ? {
                  ...f,
                  status: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Something went wrong",
                }
              : f,
          ),
        );
      }
    },
    [token],
  );

  const enqueue = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      if (list.length === 0) return;

      const tracked: TrackedFile[] = list.map((file) => {
        const kind = kindFromFile(file);
        const over = isOverUploadLimit(file.size, kind);
        return {
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
          file,
          progress: over ? 100 : 0,
          status: over ? ("error" as const) : ("queued" as const),
          error: over ? uploadLimitMessage(file.name, kind) : undefined,
        };
      });

      setFiles((prev) => [...prev, ...tracked]);

      const toUpload = tracked.filter((item) => item.status === "queued");
      if (toUpload.length === 0) return;

      void (async () => {
        for (const item of toUpload) {
          await uploadOne(item);
        }
        onAllSettled?.();
      })();
    },
    [onAllSettled, uploadOne],
  );

  const doneFiles = files.filter((f) => f.status === "done");
  const allDone =
    files.length > 0 &&
    files.every((f) => f.status === "done" || f.status === "error");
  const anyDone = doneFiles.length > 0;
  const thanks = anyDone ? thankYouCopy(doneFiles) : null;
  const rejectedOnly = allDone && !anyDone;

  return (
    <div className="space-y-6">
      {allDone && thanks ? (
        <div className="rounded-2xl bg-[var(--surface)] px-6 py-8 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--gold)]">
            {thanks.title}
          </p>
          <p className="mt-3 text-[var(--cream)]/80">{thanks.body}</p>
          <button
            type="button"
            onClick={() => {
              setFiles([]);
              inputRef.current?.click();
            }}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-medium text-[var(--ground)] transition hover:brightness-110"
          >
            Add more
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files) enqueue(e.dataTransfer.files);
          }}
          className={`cursor-pointer rounded-2xl border border-dashed px-6 py-14 text-center transition ${
            dragging
              ? "border-[var(--gold)] bg-[var(--gold)]/10"
              : "border-[var(--cream)]/25 bg-[var(--surface)]/60 hover:border-[var(--blush)]/50"
          }`}
        >
          <p className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
            Drop a video, voice memo, or photo
          </p>
          <p className="mt-2 text-sm text-[var(--cream)]/55">
            Or tap to choose from your phone.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="video/*,audio/*,image/*,.heic,.heif,.mov,.m4a,.mp3,.mp4,.caf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) enqueue(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {(files.length > 0 && !allDone) || rejectedOnly ? (
        <ul className="space-y-3">
          {files.map((f) => (
            <li
              key={f.id}
              className="rounded-xl bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-[var(--cream)]/90">
                  {f.file.name}
                </span>
                <span className="shrink-0 text-[var(--cream)]/50">
                  {f.status === "done"
                    ? "Sent"
                    : f.status === "error"
                      ? "Couldn't send"
                      : f.status === "uploading"
                        ? `${Math.round(f.progress)}%`
                        : "Waiting"}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--forest)]/10">
                <div
                  className={`h-full transition-all duration-300 ${
                    f.status === "error"
                      ? "bg-[var(--forest)]"
                      : "bg-[var(--gold)]"
                  }`}
                  style={{
                    width: `${
                      f.status === "done"
                        ? 100
                        : f.status === "error"
                          ? 100
                          : f.progress
                    }%`,
                  }}
                />
              </div>
              {f.error && (
                <p className="mt-2 text-xs text-[var(--blush)]">{f.error}</p>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {uploading && (
        <p className="text-center text-sm text-[var(--cream)]/45">
          Keep this page open until each one finishes. We&apos;ll listen and
          find the words after it lands.
        </p>
      )}
    </div>
  );
}
