import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { get, put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import sharp from "sharp";
import { db } from "@/db";
import {
  media,
  phrases,
  transcripts,
  words,
  type Media,
} from "@/db/schema";
import { BLOB_ACCESS } from "@/lib/blob";
import {
  THEME_TAGS,
  detectPhrases,
  filterWarmAiTags,
  normalizeWord,
  type TimedWord,
} from "@/lib/words";

const AI_TAG_GUIDANCE = `ONLY happy, loving, or deeply meaningful words she would want to see about herself.
Feelings, virtues, warmth, relationship, belonging, joy. Never mundane objects, never neutral visual descriptors, never negative words.
Good: love, laughter, home, brave, sister, always, sunshine, grateful, soft, forever, proud, gentle, family, heart, light
Bad: table, shirt, outdoor, person, sad, phone, wall, crying`;

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

async function downloadBlobToFile(url: string, dest: string) {
  const result = await get(url, { access: BLOB_ACCESS });
  if (!result || result.statusCode !== 200 || !result.stream) {
    // Fallback for any leftover public URLs
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`Download failed: ${url}`);
    }
    // @ts-expect-error Node web stream
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
    return;
  }

  // @ts-expect-error Node web stream
  await pipeline(Readable.fromWeb(result.stream), createWriteStream(dest));
}

async function loadFfmpeg() {
  const ffmpegPath = (await import("@ffmpeg-installer/ffmpeg")).default;
  const ffmpeg = (await import("fluent-ffmpeg")).default;
  ffmpeg.setFfmpegPath(ffmpegPath.path);
  return ffmpeg;
}

function extractAudio(
  ffmpeg: typeof import("fluent-ffmpeg"),
  inputPath: string,
  outputPath: string,
): Promise<void> {
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

function extractPoster(
  ffmpeg: typeof import("fluent-ffmpeg"),
  inputPath: string,
  outputPath: string,
): Promise<void> {
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

function getDurationSeconds(
  ffmpeg: typeof import("fluent-ffmpeg"),
  inputPath: string,
): Promise<number | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return resolve(null);
      resolve(data.format.duration ?? null);
    });
  });
}

async function transcribeFile(
  openai: OpenAI,
  filePath: string,
  filename: string,
  mime: string,
) {
  const file = await OpenAI.toFile(await readFile(filePath), filename, {
    type: mime,
  });

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

async function enrichFromText(openai: OpenAI, fullText: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You label loving messages about Kelli for a keepsake word cloud.
Return JSON:
{
  "title": string (max 6 words, warm),
  "summary": string (1-2 sentences, tender),
  "themes": string[] (1-3 from: ${THEME_TAGS.join(", ")}),
  "tags": string[] (5-12 lowercase single words for the word cloud. ${AI_TAG_GUIDANCE})
}`,
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
      tags?: string[];
    };
    const themes = (parsed.themes || []).filter((t) =>
      (THEME_TAGS as readonly string[]).includes(t),
    );
    const tags = filterWarmAiTags(parsed.tags || []);
    return {
      title: parsed.title?.slice(0, 80) || "A message for Kelli",
      summary: parsed.summary?.slice(0, 400) || null,
      themes: themes.slice(0, 3),
      tags,
    };
  } catch {
    return {
      title: "A message for Kelli",
      summary: null as string | null,
      themes: [] as string[],
      tags: [] as string[],
    };
  }
}

async function enrichImage(
  openai: OpenAI,
  jpegBuffer: Buffer,
) {
  const dataUrl = `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `This photo is a keepsake for Kelli. Look for love, warmth, and meaning, not a catalog of objects.
Return JSON:
{
  "title": string (max 6 words, warm),
  "caption": string (one tender sentence about the feeling or bond, not a dry description),
  "themes": string[] (1-3 from: ${THEME_TAGS.join(", ")}),
  "tags": string[] (5-12 lowercase single words for the word cloud. ${AI_TAG_GUIDANCE})
}`,
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(raw) as {
      title?: string;
      caption?: string;
      themes?: string[];
      tags?: string[];
    };
    const themes = (parsed.themes || []).filter((t) =>
      (THEME_TAGS as readonly string[]).includes(t),
    );
    const tags = filterWarmAiTags(parsed.tags || []);
    return {
      title: parsed.title?.slice(0, 80) || "A photo for Kelli",
      caption: parsed.caption?.slice(0, 400) || null,
      themes: themes.length ? themes.slice(0, 3) : (["tender"] as string[]),
      tags,
    };
  } catch {
    return {
      title: "A photo for Kelli",
      caption: null as string | null,
      themes: ["tender"],
      tags: [] as string[],
    };
  }
}

function tagWordsFromList(tags: string[]): TimedWord[] {
  return tags
    .map((tag, i) => {
      const normalized = normalizeWord(tag) || tag;
      return {
        raw: tag,
        normalized,
        startMs: i * 10,
        endMs: i * 10 + 5,
      };
    })
    .filter((w) => !!w.normalized);
}

async function processImage(item: Media, workDir: string, openai: OpenAI) {
  const sourcePath = join(workDir, "source");
  await downloadBlobToFile(item.blobUrl, sourcePath);
  let buffer = await readFile(sourcePath);

  const isHeic =
    item.originalFilename?.toLowerCase().match(/\.heic|\.heif$/) ||
    item.blobUrl.toLowerCase().includes(".heic");

  if (isHeic) {
    const convertHeic = (await import("heic-convert")).default;
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

  const jpegBlob = await put(`processed/${item.id}/full.jpg`, oriented, {
    access: BLOB_ACCESS,
    contentType: "image/jpeg",
  });
  const thumbBlob = await put(`processed/${item.id}/thumb.jpg`, thumb, {
    access: BLOB_ACCESS,
    contentType: "image/jpeg",
  });

  const enrichment = await enrichImage(openai, oriented);
  const priorTags = item.tags || [];
  const tags = filterWarmAiTags([...priorTags, ...(enrichment.tags || [])]);
  const themes = (enrichment.themes || []).slice(0, 3);

  await db.delete(words).where(eq(words.mediaId, item.id));
  await db.delete(phrases).where(eq(phrases.mediaId, item.id));
  await db.delete(transcripts).where(eq(transcripts.mediaId, item.id));

  const captionText = enrichment.caption || enrichment.title;
  const [transcriptRow] = await db
    .insert(transcripts)
    .values({
      mediaId: item.id,
      fullText: captionText,
      language: "en",
    })
    .returning();

  // Photos: only curated warm tags go into the cloud (not every caption noun).
  const fromTags = tagWordsFromList(tags).filter(
    (w): w is TimedWord & { normalized: string } => !!w.normalized,
  );

  if (fromTags.length > 0) {
    await db.insert(words).values(
      fromTags.map((w) => ({
        transcriptId: transcriptRow.id,
        mediaId: item.id,
        contributorId: item.contributorId,
        raw: w.raw,
        normalized: w.normalized,
        startMs: w.startMs,
        endMs: w.endMs,
        source: "tag",
      })),
    );
  }

  await db
    .update(media)
    .set({
      blobUrl: jpegBlob.url,
      posterUrl: thumbBlob.url,
      width: meta.width ?? null,
      height: meta.height ?? null,
      caption: enrichment.caption,
      title: enrichment.title,
      summary: enrichment.caption,
      themes,
      tags: tags.length ? tags : null,
      status: "ready",
    })
    .where(eq(media.id, item.id));
}

async function processAv(item: Media, workDir: string, openai: OpenAI) {
  const ext =
    item.originalFilename?.split(".").pop()?.toLowerCase() ||
    (item.kind === "audio" ? "m4a" : "mp4");
  const sourcePath = join(workDir, `source.${ext}`);
  const audioPath = join(workDir, "audio.mp3");
  const posterPath = join(workDir, "poster.jpg");

  await downloadBlobToFile(item.blobUrl, sourcePath);
  const sourceStat = await readFile(sourcePath);
  const sourceSize = sourceStat.byteLength;

  let transcriptPath = sourcePath;
  let transcriptName = `source.${ext}`;
  let transcriptMime =
    item.kind === "audio"
      ? ext === "mp3"
        ? "audio/mpeg"
        : "audio/mp4"
      : "video/mp4";

  let duration: number | null = item.durationSeconds;
  let posterUrl = item.posterUrl;
  let ffmpegAvailable = true;
  let ffmpeg: typeof import("fluent-ffmpeg") | null = null;

  try {
    ffmpeg = await loadFfmpeg();
  } catch (err) {
    console.warn("ffmpeg unavailable", err);
    ffmpegAvailable = false;
  }

  if (ffmpegAvailable && ffmpeg) {
    try {
      duration = await getDurationSeconds(ffmpeg, sourcePath);
    } catch {
      /* keep existing */
    }

    if (item.kind === "video") {
      try {
        await extractPoster(ffmpeg, sourcePath, posterPath);
        const posterBuf = await readFile(posterPath);
        const posterBlob = await put(
          `processed/${item.id}/poster.jpg`,
          posterBuf,
          { access: BLOB_ACCESS, contentType: "image/jpeg" },
        );
        posterUrl = posterBlob.url;
      } catch (err) {
        console.warn("Poster extraction failed", err);
      }
    }

    // Whisper 25MB limit; downsample when needed
    if (sourceSize > 20 * 1024 * 1024 || item.kind === "video") {
      try {
        await extractAudio(ffmpeg, sourcePath, audioPath);
        transcriptPath = audioPath;
        transcriptName = "audio.mp3";
        transcriptMime = "audio/mpeg";
      } catch (err) {
        console.warn("Audio extract failed, trying source file", err);
        if (sourceSize > 25 * 1024 * 1024) {
          throw new Error(
            "File too large for transcription and audio extract failed",
          );
        }
      }
    }
  } else if (sourceSize > 25 * 1024 * 1024) {
    throw new Error(
      "File exceeds Whisper 25MB limit and ffmpeg is unavailable",
    );
  }

  const transcript = await transcribeFile(
    openai,
    transcriptPath,
    transcriptName,
    transcriptMime,
  );

  const timed: TimedWord[] = (transcript.words || []).map((w) => ({
    raw: w.word,
    normalized: normalizeWord(w.word),
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
  }));

  const kept = timed.filter(
    (w): w is TimedWord & { normalized: string } => !!w.normalized,
  );
  const detected = detectPhrases(timed);

  const enrichment = transcript.text.trim()
    ? await enrichFromText(openai, transcript.text)
    : {
        title:
          item.kind === "audio" ? "A voice for Kelli" : "A message for Kelli",
        summary: null as string | null,
        themes: [] as string[],
        tags: [] as string[],
      };

  // Merge AI tags into word cloud (no supercut moments; timestamps already from speech)
  const priorTags = item.tags || [];
  const tags = filterWarmAiTags([...priorTags, ...(enrichment.tags || [])]);
  const themes = (enrichment.themes || []).slice(0, 3);
  const aiTagWords = tagWordsFromList(tags).filter(
    (w): w is TimedWord & { normalized: string } => !!w.normalized,
  );
  const spokenNormalized = new Set(kept.map((w) => w.normalized));
  const extraTags = aiTagWords.filter((w) => !spokenNormalized.has(w.normalized));

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
        normalized: w.normalized,
        startMs: w.startMs,
        endMs: w.endMs,
        source: "speech",
      })),
    );
  }

  if (extraTags.length > 0) {
    await db.insert(words).values(
      extraTags.map((w) => ({
        transcriptId: transcriptRow.id,
        mediaId: item.id,
        contributorId: item.contributorId,
        raw: w.raw,
        normalized: w.normalized,
        startMs: w.startMs,
        endMs: w.endMs,
        source: "tag",
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
      themes,
      tags: tags.length ? tags : null,
    })
    .where(eq(media.id, item.id));
}

export async function processMediaById(id: string): Promise<{
  ok: boolean;
  status: "ready" | "failed" | "skipped";
  error?: string;
}> {
  const [item] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  if (!item) {
    return { ok: false, status: "failed", error: "Not found" };
  }

  if (item.status === "processing") {
    return { ok: true, status: "skipped", error: "Already processing" };
  }

  if (item.status === "ready") {
    return { ok: true, status: "skipped", error: "Already ready" };
  }

  await db
    .update(media)
    .set({ status: "processing" })
    .where(eq(media.id, id));

  const openai = getOpenAI();
  const workDir = await mkdtemp(join(tmpdir(), "kelli-"));

  try {
    if (item.kind === "image") {
      await processImage(item, workDir, openai);
    } else {
      await processAv(item, workDir, openai);
    }
    return { ok: true, status: "ready" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`process failed ${id}`, error);
    await db
      .update(media)
      .set({ status: "failed" })
      .where(eq(media.id, id));
    await writeFile(join(workDir, "error.txt"), message, "utf8").catch(
      () => undefined,
    );
    return { ok: false, status: "failed", error: message };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** Fire-and-forget safe wrapper for request lifecycle hooks. */
export function enqueueMediaProcessing(id: string) {
  void processMediaById(id).catch((err) => {
    console.error("enqueueMediaProcessing failed", id, err);
  });
}
