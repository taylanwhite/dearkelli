/**
 * Manual processing pipeline.
 *
 *   npm run process              # process all "uploaded" items
 *   npm run process -- --id=UUID # one item
 *   npm run process -- --failed  # retry failed
 *
 * Requires: DATABASE_URL, BLOB_READ_WRITE_TOKEN, OPENAI_API_KEY
 */

import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { put } from "@vercel/blob";
import { eq, inArray } from "drizzle-orm";
import ffmpeg from "fluent-ffmpeg";
import convertHeic from "heic-convert";
import OpenAI from "openai";
import sharp from "sharp";
import { config } from "dotenv";
import { db } from "../src/db";
import {
  media,
  phrases,
  transcripts,
  words,
  type Media,
} from "../src/db/schema";
import {
  THEME_TAGS,
  detectPhrases,
  normalizeWord,
  type TimedWord,
} from "../src/lib/words";

config({ path: ".env.local" });
config();

ffmpeg.setFfmpegPath(ffmpegPath.path);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function arg(name: string): string | undefined {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match?.split("=").slice(1).join("=");
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function downloadToFile(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${res.status} ${url}`);
  }
  // @ts-expect-error Node fetch body is a web stream
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec("libmp3lame")
      .audioBitrate("64k")
      .format("mp3")
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });
}

function extractPoster(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ["1"],
        filename: outputPath.split("/").pop()!,
        folder: outputPath.replace(/\/[^/]+$/, ""),
        size: "1280x?",
      })
      .on("end", () => resolve())
      .on("error", reject);
  });
}

function getDurationSeconds(inputPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return resolve(null);
      resolve(data.format.duration ?? null);
    });
  });
}

async function transcribe(audioPath: string) {
  const file = await OpenAI.toFile(
    await readFile(audioPath),
    "audio.mp3",
    { type: "audio/mpeg" },
  );

  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  return result as {
    text: string;
    language?: string;
    words?: { word: string; start: number; end: number }[];
  };
}

async function enrichClip(fullText: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You write warm, short labels for birthday messages about a woman named Kelli.
Return JSON: { "title": string (max 6 words), "summary": string (1-2 sentences), "themes": string[] (1-3 from: ${THEME_TAGS.join(", ")}) }`,
      },
      { role: "user", content: fullText.slice(0, 6000) },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(raw) as {
      title?: string;
      summary?: string;
      themes?: string[];
    };
    const themes = (parsed.themes || []).filter((t) =>
      (THEME_TAGS as readonly string[]).includes(t),
    );
    return {
      title: parsed.title?.slice(0, 80) || "A message for Kelli",
      summary: parsed.summary?.slice(0, 400) || null,
      themes: themes.slice(0, 3),
    };
  } catch {
    return {
      title: "A message for Kelli",
      summary: null as string | null,
      themes: [] as string[],
    };
  }
}

async function captionImage(imageUrl: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 120,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe this photo in one warm sentence for a birthday scrapbook about Kelli. No preamble.",
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() || null;
}

async function processImage(item: Media, workDir: string) {
  const sourcePath = join(workDir, "source");
  await downloadToFile(item.blobUrl, sourcePath);
  let buffer = await readFile(sourcePath);

  const isHeic =
    item.originalFilename?.toLowerCase().match(/\.heic|\.heif$/) ||
    item.blobUrl.toLowerCase().includes(".heic");

  if (isHeic) {
    const converted = await convertHeic({
      buffer,
      format: "JPEG",
      quality: 0.9,
    });
    buffer = Buffer.from(converted);
  }

  const oriented = await sharp(buffer).rotate().jpeg({ quality: 88 }).toBuffer();
  const meta = await sharp(oriented).metadata();

  const thumb = await sharp(oriented)
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  const jpegBlob = await put(
    `processed/${item.id}/full.jpg`,
    oriented,
    { access: "public", contentType: "image/jpeg" },
  );
  const thumbBlob = await put(
    `processed/${item.id}/thumb.jpg`,
    thumb,
    { access: "public", contentType: "image/jpeg" },
  );

  const caption = await captionImage(jpegBlob.url);

  await db
    .update(media)
    .set({
      blobUrl: jpegBlob.url,
      posterUrl: thumbBlob.url,
      width: meta.width ?? null,
      height: meta.height ?? null,
      caption,
      title: caption ? caption.slice(0, 60) : "A photo for Kelli",
      summary: caption,
      themes: ["tender"],
      status: "ready",
    })
    .where(eq(media.id, item.id));
}

async function processAv(item: Media, workDir: string) {
  const ext =
    item.originalFilename?.split(".").pop()?.toLowerCase() ||
    (item.kind === "audio" ? "m4a" : "mp4");
  const sourcePath = join(workDir, `source.${ext}`);
  const audioPath = join(workDir, "audio.mp3");
  const posterPath = join(workDir, "poster.jpg");

  await downloadToFile(item.blobUrl, sourcePath);
  await extractAudio(sourcePath, audioPath);

  const duration = await getDurationSeconds(sourcePath);
  let posterUrl = item.posterUrl;

  if (item.kind === "video") {
    try {
      await extractPoster(sourcePath, posterPath);
      const posterBuf = await readFile(posterPath);
      const posterBlob = await put(`processed/${item.id}/poster.jpg`, posterBuf, {
        access: "public",
        contentType: "image/jpeg",
      });
      posterUrl = posterBlob.url;
    } catch (err) {
      console.warn("Poster extraction failed", err);
    }
  }

  const transcript = await transcribe(audioPath);
  const timed: TimedWord[] = (transcript.words || []).map((w) => {
    const raw = w.word;
    return {
      raw,
      normalized: normalizeWord(raw),
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
    };
  });

  const kept = timed.filter((w) => w.normalized);
  const detected = detectPhrases(timed);
  const enrichment = transcript.text.trim()
    ? await enrichClip(transcript.text)
    : {
        title: item.kind === "audio" ? "A voice for Kelli" : "A message for Kelli",
        summary: null as string | null,
        themes: [] as string[],
      };

  // Replace prior processing rows if re-running
  await db.delete(words).where(eq(words.mediaId, item.id));
  await db.delete(phrases).where(eq(phrases.mediaId, item.id));
  await db.delete(transcripts).where(eq(transcripts.mediaId, item.id));

  const [transcriptRow] = await db
    .insert(transcripts)
    .values({
      mediaId: item.id,
      fullText: transcript.text,
      language: transcript.language ?? null,
    })
    .returning();

  if (kept.length > 0) {
    await db.insert(words).values(
      kept.map((w) => ({
        transcriptId: transcriptRow.id,
        mediaId: item.id,
        contributorId: item.contributorId,
        raw: w.raw,
        normalized: w.normalized!,
        startMs: w.startMs,
        endMs: w.endMs,
      })),
    );
  }

  if (detected.length > 0) {
    await db.insert(phrases).values(
      detected.map((p) => ({
        mediaId: item.id,
        contributorId: item.contributorId,
        text: p.text,
        startMs: p.startMs,
        endMs: p.endMs,
      })),
    );
  }

  await db
    .update(media)
    .set({
      status: "ready",
      durationSeconds: duration ? Math.round(duration) : item.durationSeconds,
      posterUrl,
      title: enrichment.title,
      summary: enrichment.summary,
      themes: enrichment.themes,
    })
    .where(eq(media.id, item.id));
}

async function processOne(item: Media) {
  console.log(`→ ${item.id} (${item.kind}) ${item.originalFilename || ""}`);
  await db
    .update(media)
    .set({ status: "processing" })
    .where(eq(media.id, item.id));

  const workDir = await mkdtemp(join(tmpdir(), "kelli-"));
  try {
    if (item.kind === "image") {
      await processImage(item, workDir);
    } else {
      await processAv(item, workDir);
    }
    console.log(`✓ ready ${item.id}`);
  } catch (error) {
    console.error(`✗ failed ${item.id}`, error);
    await db
      .update(media)
      .set({ status: "failed" })
      .where(eq(media.id, item.id));
    await writeFile(
      join(workDir, "error.txt"),
      String(error),
      "utf8",
    ).catch(() => undefined);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error("BLOB_READ_WRITE_TOKEN missing");

  const id = arg("id");
  const statuses = hasFlag("failed")
    ? (["failed"] as const)
    : hasFlag("all")
      ? (["uploaded", "failed"] as const)
      : (["uploaded"] as const);

  let items: Media[];
  if (id) {
    items = await db.select().from(media).where(eq(media.id, id));
  } else {
    items = await db
      .select()
      .from(media)
      .where(inArray(media.status, [...statuses]));
  }

  if (items.length === 0) {
    console.log("Nothing to process.");
    return;
  }

  console.log(`Processing ${items.length} item(s)…`);
  for (const item of items) {
    await processOne(item);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
