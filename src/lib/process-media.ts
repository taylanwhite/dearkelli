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
import { isHeicLike } from "@/lib/media";
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
  try {
    const ffprobePath = (await import("@ffprobe-installer/ffprobe")).default;
    ffmpeg.setFfprobePath(ffprobePath.path);
  } catch {
    /* duration/poster still work via ffmpeg in many builds */
  }
  return ffmpeg;
}

type ExtractedAudio = {
  path: string;
  filename: string;
  mime: string;
};

const PROCESSED_PUT = {
  access: BLOB_ACCESS,
  allowOverwrite: true as const,
};

type AudioMapMode =
  | { kind: "index"; index: number }
  | { kind: "a0" }
  | { kind: "auto" };

/** Prefer a real audio codec; still accept any audio stream if probe is fuzzy. */
function findUsableAudioStreamIndex(
  ffmpeg: typeof import("fluent-ffmpeg"),
  inputPath: string,
): Promise<number | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err || !data?.streams?.length) {
        console.warn(
          "ffprobe could not list streams",
          err instanceof Error ? err.message : err,
        );
        resolve(null);
        return;
      }

      const summary = data.streams.map((s) => ({
        index: s.index,
        type: s.codec_type,
        codec: s.codec_name,
        tag: s.codec_tag_string,
      }));
      console.info("media streams", summary);

      const usable = data.streams.find((stream) => {
        if (stream.codec_type !== "audio") return false;
        const name = (stream.codec_name || "").toLowerCase();
        // Skip explicit junk; allow missing codec_name (common on some MOVs).
        return name !== "none" && name !== "unknown";
      });

      if (usable && typeof usable.index === "number") {
        resolve(usable.index);
        return;
      }

      // Last resort: any stream marked audio.
      const anyAudio = data.streams.find((s) => s.codec_type === "audio");
      resolve(typeof anyAudio?.index === "number" ? anyAudio.index : null);
    });
  });
}

function runAudioExtract(
  ffmpeg: typeof import("fluent-ffmpeg"),
  inputPath: string,
  outputPath: string,
  opts: {
    maxSeconds: number;
    codec: string;
    format: string;
    bitrate?: string;
    frequency?: number;
    map: AudioMapMode;
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    let stderr = "";
    const mapArgs =
      opts.map.kind === "index"
        ? ["-map", `0:${opts.map.index}`]
        : opts.map.kind === "a0"
          ? ["-map", "0:a:0"]
          : []; // let ffmpeg pick the best audio when dropping video

    let cmd = ffmpeg(inputPath)
      .inputOptions([
        "-hide_banner",
        "-nostdin",
        "-analyzeduration",
        "200M",
        "-probesize",
        "200M",
      ])
      .outputOptions([
        "-vn",
        "-sn",
        "-dn",
        ...mapArgs,
        "-ac",
        "1",
        "-ar",
        String(opts.frequency ?? 16000),
        "-t",
        String(opts.maxSeconds),
        "-map_metadata",
        "-1",
        "-ignore_unknown",
        "-y",
      ])
      .audioCodec(opts.codec)
      .format(opts.format);

    if (opts.bitrate) {
      cmd = cmd.audioBitrate(opts.bitrate);
    }

    cmd
      .on("stderr", (line: string) => {
        stderr += `${line}\n`;
      })
      .on("end", () => resolve())
      .on("error", (err: Error) => {
        const detail = stderr.trim().split("\n").slice(-10).join(" | ");
        reject(
          new Error(
            detail
              ? `${err.message} (${detail.slice(0, 600)})`
              : err.message,
          ),
        );
      })
      .save(outputPath);
  });
}

/** Pull a Whisper-sized soundtrack. Tries several map + codec strategies. */
async function extractAudioForWhisper(
  ffmpeg: typeof import("fluent-ffmpeg"),
  inputPath: string,
  workDir: string,
  maxSeconds = 5 * 60,
): Promise<ExtractedAudio> {
  const probedIndex = await findUsableAudioStreamIndex(ffmpeg, inputPath);

  const mapModes: AudioMapMode[] = [];
  if (probedIndex != null) mapModes.push({ kind: "index", index: probedIndex });
  mapModes.push({ kind: "a0" }, { kind: "auto" });

  const codecs: {
    filename: string;
    mime: string;
    codec: string;
    format: string;
    bitrate?: string;
  }[] = [
    {
      filename: "audio.mp3",
      mime: "audio/mpeg",
      codec: "libmp3lame",
      format: "mp3",
      bitrate: "64k",
    },
    {
      filename: "audio.wav",
      mime: "audio/wav",
      codec: "pcm_s16le",
      format: "wav",
    },
  ];

  let lastError: Error | null = null;

  for (const map of mapModes) {
    for (const attempt of codecs) {
      const outputPath = join(workDir, `${map.kind}-${attempt.filename}`);
      try {
        await runAudioExtract(ffmpeg, inputPath, outputPath, {
          maxSeconds,
          codec: attempt.codec,
          format: attempt.format,
          bitrate: attempt.bitrate,
          map,
        });
        const buf = await readFile(outputPath);
        if (buf.byteLength < 256) {
          throw new Error("Extracted audio was empty");
        }
        return {
          path: outputPath,
          filename: attempt.filename,
          mime: attempt.mime,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `Audio extract failed map=${map.kind} format=${attempt.format}`,
          lastError.message,
        );
      }
    }
  }

  throw lastError || new Error("Audio extract failed");
}

function createWebPlayback(
  ffmpeg: typeof import("fluent-ffmpeg"),
  inputPath: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-hide_banner",
        "-nostdin",
        // Compact, web-friendly H.264 + AAC with moov at the front.
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "28",
        "-pix_fmt",
        "yuv420p",
        "-vf",
        "scale='min(1280,iw)':-2",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        "-y",
      ])
      .format("mp4")
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
      .inputOptions(["-analyzeduration", "100M", "-probesize", "100M"])
      .screenshots({
        timestamps: ["0.5"],
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

type TextEnrichment = {
  title: string;
  summary: string | null;
  themes: string[];
  tags: string[];
};

function parseTextEnrichment(raw: string, fallbackTitle: string): TextEnrichment {
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
      title: parsed.title?.slice(0, 80) || fallbackTitle,
      summary: parsed.summary?.slice(0, 400) || null,
      themes: themes.slice(0, 3),
      tags,
    };
  } catch {
    return {
      title: fallbackTitle,
      summary: null,
      themes: [],
      tags: [],
    };
  }
}

async function enrichFromText(openai: OpenAI, fullText: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You label a spoken message or video soundtrack for Kelli's keepsake.

Rules for title and summary:
- Stay faithful to what was actually said. No invented scenes, no invented praise.
- If people are playing, laughing, or talking about ordinary things, say that plainly.
- Do not write as if every clip is a love letter to Kelli unless the words say so.
- Title: max 6 words, concrete (e.g. "Kids by the red car"), not poetic filler.
- Summary: 1-2 plain sentences about the real moment in the transcript.

Word-cloud tags may be warmer, but only when they fit what was said.
Return JSON:
{
  "title": string,
  "summary": string,
  "themes": string[] (1-3 from: ${THEME_TAGS.join(", ")}),
  "tags": string[] (5-12 lowercase single words. ${AI_TAG_GUIDANCE})
}`,
      },
      { role: "user", content: fullText.slice(0, 6000) },
    ],
  });

  return parseTextEnrichment(
    completion.choices[0]?.message?.content || "{}",
    "A message for Kelli",
  );
}

/** Video: prefer what the frame shows; use transcript only as supporting detail. */
async function enrichVideo(
  openai: OpenAI,
  opts: { transcriptText: string; posterJpeg?: Buffer | null },
) {
  const transcript = opts.transcriptText.trim();
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `This is a keepsake video for Kelli.

Rules for title and summary:
- Describe the real scene. Stay concrete. No invented praise or poetic fluff.
- If a still frame is attached, trust what you see in the image over vague soundtrack noise.
- Do not write as if every clip is a love letter to Kelli unless someone clearly says so.
- Title: max 6 plain words (e.g. "Kids by the red car").
- Summary: 1-2 honest sentences about the moment.

${transcript ? `Soundtrack / speech transcript:\n${transcript.slice(0, 4000)}` : "No clear speech transcript (ambient sound or silent)."}

Return JSON:
{
  "title": string,
  "summary": string,
  "themes": string[] (1-3 from: ${THEME_TAGS.join(", ")}),
  "tags": string[] (5-12 lowercase single words. ${AI_TAG_GUIDANCE})
}`,
    },
  ];

  if (opts.posterJpeg?.byteLength) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${opts.posterJpeg.toString("base64")}`,
      },
    });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content }],
  });

  return parseTextEnrichment(
    completion.choices[0]?.message?.content || "{}",
    "A video for Kelli",
  );
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
            text: `This photo is a keepsake for Kelli.

Rules for title and caption:
- Describe what is actually in the photo. Stay concrete.
- Do not invent emotions or bonds that the image does not show.
- Title: max 6 plain words (e.g. "Kids by the red car").
- Caption: one honest sentence about the scene.

Tags may be warmer when they fit the image.
Return JSON:
{
  "title": string,
  "caption": string,
  "themes": string[] (1-3 from: ${THEME_TAGS.join(", ")}),
  "tags": string[] (5-12 lowercase single words. ${AI_TAG_GUIDANCE})
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

  const isHeic = isHeicLike(
    item.originalFilename,
    item.blobUrl,
    null,
  );

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
    ...PROCESSED_PUT,
    contentType: "image/jpeg",
  });
  const thumbBlob = await put(`processed/${item.id}/thumb.jpg`, thumb, {
    ...PROCESSED_PUT,
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
      processingError: null,
    })
    .where(eq(media.id, item.id));
}

async function markVisibleWithoutAi(
  item: Media,
  opts: {
    error: string;
    duration?: number | null;
    posterUrl?: string | null;
    playbackUrl?: string | null;
  },
) {
  await db
    .update(media)
    .set({
      status: "ready",
      processingError: opts.error.slice(0, 1000),
      durationSeconds: opts.duration
        ? Math.round(opts.duration)
        : item.durationSeconds,
      posterUrl: opts.posterUrl ?? item.posterUrl,
      playbackUrl: opts.playbackUrl ?? item.playbackUrl,
      title:
        item.title ||
        (item.kind === "audio"
          ? "A voice for Kelli"
          : item.kind === "image"
            ? "A photo for Kelli"
            : "A message for Kelli"),
    })
    .where(eq(media.id, item.id));
}

async function processAv(item: Media, workDir: string, openai: OpenAI) {
  const ext =
    item.originalFilename?.split(".").pop()?.toLowerCase() ||
    (item.kind === "audio" ? "m4a" : "mp4");
  const sourcePath = join(workDir, `source.${ext}`);
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
  let playbackUrl = item.playbackUrl;
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
          { ...PROCESSED_PUT, contentType: "image/jpeg" },
        );
        posterUrl = posterBlob.url;
      } catch (err) {
        console.warn("Poster extraction failed", err);
      }

      // Build a smaller fast-start MP4 so the site doesn't stream a huge MOV.
      try {
        const playbackPath = join(workDir, "playback.mp4");
        await createWebPlayback(ffmpeg, sourcePath, playbackPath);
        const playbackBuf = await readFile(playbackPath);
        const playbackBlob = await put(
          `processed/${item.id}/playback.mp4`,
          playbackBuf,
          { ...PROCESSED_PUT, contentType: "video/mp4" },
        );
        playbackUrl = playbackBlob.url;
      } catch (err) {
        console.warn("Web playback encode failed", err);
      }
    }

    // Always pull a compact soundtrack for video (iPhone MOVs are often
    // huge in bytes even when only ~30s long). Cap at 5 minutes for Whisper.
    if (item.kind === "video" || sourceSize > 20 * 1024 * 1024) {
      try {
        const extracted = await extractAudioForWhisper(
          ffmpeg,
          sourcePath,
          workDir,
          5 * 60,
        );
        transcriptPath = extracted.path;
        transcriptName = extracted.filename;
        transcriptMime = extracted.mime;
      } catch (err) {
        const detail =
          err instanceof Error ? err.message : "unknown extract error";
        console.warn("Audio extract failed", err);
        await markVisibleWithoutAi(item, {
          error: `Couldn't extract audio for transcription: ${detail}`,
          duration,
          posterUrl,
          playbackUrl,
        });
        return;
      }
    }
  } else if (item.kind === "video" || sourceSize > 25 * 1024 * 1024) {
    await markVisibleWithoutAi(item, {
      error:
        "Couldn't transcribe without ffmpeg on this server. The file still shows for Kelli.",
      duration,
      posterUrl,
      playbackUrl,
    });
    return;
  }

  let transcript: Awaited<ReturnType<typeof transcribeFile>>;
  try {
    transcript = await transcribeFile(
      openai,
      transcriptPath,
      transcriptName,
      transcriptMime,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("Transcription failed", err);
    await markVisibleWithoutAi(item, {
      error: `Transcription failed: ${message}`,
      duration,
      posterUrl,
      playbackUrl,
    });
    return;
  }

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

  let enrichment: TextEnrichment;
  try {
    if (item.kind === "video") {
      let posterJpeg: Buffer | null = null;
      try {
        posterJpeg = await readFile(posterPath);
      } catch {
        /* poster may be missing */
      }
      enrichment = await enrichVideo(openai, {
        transcriptText: transcript.text,
        posterJpeg,
      });
    } else if (transcript.text.trim()) {
      enrichment = await enrichFromText(openai, transcript.text);
    } else {
      enrichment = {
        title: "A voice for Kelli",
        summary: null,
        themes: [],
        tags: [],
      };
    }
  } catch (err) {
    console.warn("Text enrichment failed", err);
    enrichment = {
      title:
        item.kind === "audio" ? "A voice for Kelli" : "A video for Kelli",
      summary: null,
      themes: [],
      tags: [],
    };
  }

  const priorTags = item.tags || [];
  const tags = filterWarmAiTags([...priorTags, ...(enrichment.tags || [])]);
  const themes = (enrichment.themes || []).slice(0, 3);
  const aiTagWords = tagWordsFromList(tags).filter(
    (w): w is TimedWord & { normalized: string } => !!w.normalized,
  );
  const spokenNormalized = new Set(kept.map((w) => w.normalized));
  const extraTags = aiTagWords.filter(
    (w) => !spokenNormalized.has(w.normalized),
  );

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
      processingError: null,
      durationSeconds: duration ? Math.round(duration) : item.durationSeconds,
      posterUrl,
      playbackUrl,
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

  // Skip only fully successful items. Ready-with-error can be requeued
  // (requeue resets status to uploaded first).
  if (item.status === "ready" && !item.processingError) {
    return { ok: true, status: "skipped", error: "Already ready" };
  }

  await db
    .update(media)
    .set({ status: "processing", processingError: null })
    .where(eq(media.id, id));

  const openai = getOpenAI();
  const workDir = await mkdtemp(join(tmpdir(), "kelli-"));

  try {
    if (item.kind === "image") {
      try {
        await processImage(item, workDir, openai);
      } catch (err) {
        // Image may still be viewable at the original blob URL.
        const message = err instanceof Error ? err.message : String(err);
        console.error(`process image soft-fail ${id}`, err);
        await markVisibleWithoutAi(item, {
          error: `Couldn't finish AI for this photo: ${message}`,
        });
      }
    } else {
      await processAv(item, workDir, openai);
    }
    return { ok: true, status: "ready" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`process failed ${id}`, error);
    // Never leave the attachment hidden — always ready for Kelli.
    await markVisibleWithoutAi(item, { error: message });
    await writeFile(join(workDir, "error.txt"), message, "utf8").catch(
      () => undefined,
    );
    return { ok: true, status: "ready", error: message };
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
