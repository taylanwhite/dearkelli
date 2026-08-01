"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { isOverUploadLimit, uploadLimitMessage } from "@/lib/media";

type Props = {
  token: string;
  onSent?: () => void;
};

const PROMPTS = [
  "Happy Birthday Kelli",
  "We love you",
  "I'm so proud of you",
  "You're my favorite person",
  "Thank you for being you",
];

type Phase = "idle" | "recording" | "review" | "uploading" | "done" | "error";

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function extensionForMime(mime: string) {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export function VoiceRecorder({ token, onSent }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const mimeRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSupported(typeof MediaRecorder !== "undefined" && pickMimeType() !== null);
    return () => {
      stopTracks();
      clearTimer();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function resetPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
  }

  async function startRecording() {
    setError(null);
    resetPreview();
    setSeconds(0);

    const mime = pickMimeType();
    if (mime === null) {
      setSupported(false);
      setError("This browser can't record audio here. You can still upload a voice memo.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mimeRef.current = mime || "audio/webm";
      chunksRef.current = [];

      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopTracks();
        clearTimer();
        const blob = new Blob(chunksRef.current, {
          type: mimeRef.current || "audio/webm",
        });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPhase("review");
      };

      recorder.start(250);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          // Soft stop at 3 minutes.
          if (s + 1 >= 180) {
            stopRecording();
            return 180;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Couldn't reach your microphone. Check permissions and try again.");
      setPhase("idle");
      stopTracks();
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      stopTracks();
      clearTimer();
      setPhase("idle");
    }
  }

  function discard() {
    resetPreview();
    setSeconds(0);
    setPhase("idle");
    setError(null);
  }

  async function send() {
    const blob = blobRef.current;
    if (!blob) return;

    if (isOverUploadLimit(blob.size, "audio")) {
      setError(uploadLimitMessage("Your recording", "audio"));
      setPhase("error");
      return;
    }

    setPhase("uploading");
    setError(null);

    const mime = blob.type || mimeRef.current || "audio/webm";
    const filename = `voice-for-kelli-${Date.now()}.${extensionForMime(mime)}`;
    const file = new File([blob], filename, { type: mime });

    try {
      const uploaded = await upload(filename, file, {
        access: "private",
        handleUploadUrl: "/api/blob/upload",
        clientPayload: JSON.stringify({
          token,
          contentType: mime,
          filename,
        }),
      });

      await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          blobUrl: uploaded.url,
          contentType: mime,
          filename,
          durationSeconds: seconds || undefined,
        }),
      });

      setPhase("done");
      resetPreview();
      onSent?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't send that recording",
      );
      setPhase("review");
    }
  }

  if (!supported) {
    return (
      <div className="rounded-2xl bg-[var(--surface)] px-5 py-6 text-center">
        <p className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
          Record a message
        </p>
        <p className="mt-2 text-sm text-[var(--cream)]/55">
          This browser can&apos;t record here. Upload a voice memo below instead.
        </p>
      </div>
    );
  }

  const timeLabel = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="rounded-2xl bg-[var(--surface)] px-5 py-6">
      <div className="text-center">
        <p className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
          Record a message
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--cream)]/60">
          Speak from the heart. A few words she can play whenever she needs
          them.
        </p>
      </div>

      <div className="mt-5">
        <p className="text-center text-[11px] uppercase tracking-wide text-[var(--cream)]/35">
          Try saying
        </p>
        <ul className="mt-2 flex flex-wrap justify-center gap-2">
          {PROMPTS.map((prompt) => (
            <li
              key={prompt}
              className="rounded-full border border-[var(--gold)]/25 bg-[var(--ground)]/40 px-3 py-1.5 text-sm text-[var(--cream)]/75"
            >
              &ldquo;{prompt}&rdquo;
            </li>
          ))}
        </ul>
      </div>

      {phase === "done" ? (
        <div className="mt-8 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--gold)]">
            Thank you.
          </p>
          <p className="mt-2 text-sm text-[var(--cream)]/70">
            She&apos;ll cherish every word.
          </p>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="mt-5 text-sm text-[var(--cream)]/45 underline-offset-2 hover:underline"
          >
            Record another
          </button>
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-4">
          {(phase === "recording" || phase === "review" || phase === "uploading") && (
            <p
              className={`font-mono text-sm tabular-nums ${
                phase === "recording" ? "text-[var(--blush)]" : "text-[var(--cream)]/50"
              }`}
            >
              {timeLabel}
            </p>
          )}

          {phase === "idle" && (
            <button
              type="button"
              onClick={() => void startRecording()}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--gold)] text-[var(--ground)] shadow-[0_8px_24px_rgba(58,53,50,0.18)] transition hover:brightness-110 touch-manipulation"
              aria-label="Start recording"
            >
              <span className="h-7 w-7 rounded-full bg-[var(--ground)]/15 ring-2 ring-[var(--ground)]/40" />
            </button>
          )}

          {phase === "recording" && (
            <button
              type="button"
              onClick={stopRecording}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--blush)] text-white touch-manipulation"
              aria-label="Stop recording"
            >
              <span className="h-6 w-6 rounded-sm bg-white" />
            </button>
          )}

          {phase === "idle" && (
            <p className="text-sm text-[var(--cream)]/45">Tap to record</p>
          )}
          {phase === "recording" && (
            <p className="text-sm text-[var(--blush)]">Recording… tap to stop</p>
          )}

          {phase === "review" && previewUrl && (
            <>
              <audio src={previewUrl} controls className="w-full max-w-sm" />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={discard}
                  className="min-h-11 rounded-full border border-[var(--cream)]/20 px-5 text-sm text-[var(--cream)]/70 touch-manipulation"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => void send()}
                  className="min-h-11 rounded-full bg-[var(--gold)] px-6 text-sm font-medium text-[var(--ground)] touch-manipulation"
                >
                  Save
                </button>
              </div>
            </>
          )}

          {phase === "uploading" && (
            <p className="text-sm text-[var(--cream)]/55">Sending your voice…</p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 text-center text-sm text-[var(--blush)]">{error}</p>
      )}
    </div>
  );
}
