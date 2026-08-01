/**
 * Seed test people + sample JPG / MP4 / audio into Blob + DB.
 * Everything is marked is_test = true.
 *
 *   npm run seed:test
 *   npm run seed:test:clean
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { put } from "@vercel/blob";
import { config } from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import { db } from "../src/db";
import {
  contributors,
  media,
  phrases,
  transcripts,
  words,
} from "../src/db/schema";
import { BLOB_ACCESS } from "../src/lib/blob";
import { detectPhrases, normalizeWord } from "../src/lib/words";
import { cleanTestData } from "./clean-test-data";

config({ path: ".env.local" });
config({ path: ".env" });

ffmpeg.setFfmpegPath(ffmpegPath.path);

const PEOPLE = [
  {
    name: "Test Mom",
    relationship: "Mom",
    token: "test-mom",
    color: { r: 232, g: 177, b: 76 },
    lines: [
      {
        kind: "video" as const,
        title: "A birthday wish from Mom",
        summary: "Mom saying how proud she is and that she loves Kelli.",
        themes: ["tender", "motherhood"],
        spoken: [
          "Happy birthday Kelli",
          "I love you so much",
          "I am so proud of you",
        ],
      },
      {
        kind: "image" as const,
        title: "Kitchen light",
        caption: "A warm test photo from Mom.",
        themes: ["tender"],
      },
    ],
  },
  {
    name: "Test Dad",
    relationship: "Dad",
    token: "test-dad",
    color: { r: 100, g: 140, b: 180 },
    lines: [
      {
        kind: "audio" as const,
        title: "Dad's voice memo",
        summary: "A short spoken note about always being there.",
        themes: ["advice", "gratitude"],
        spoken: [
          "Hey Kel",
          "Happy birthday",
          "We are always together",
          "Love you",
        ],
      },
    ],
  },
  {
    name: "Test Sister",
    relationship: "Sister",
    token: "test-sister",
    color: { r: 228, g: 137, b: 155 },
    lines: [
      {
        kind: "video" as const,
        title: "Sister chaos",
        summary: "An inside-joke birthday roast wrapped in love.",
        themes: ["funny", "inside joke", "childhood"],
        spoken: [
          "Happy birthday Kelli",
          "Remember when we laughed until everything hurt",
          "I love you",
        ],
      },
      {
        kind: "image" as const,
        title: "Sister selfie energy",
        caption: "A playful test photo from her sister.",
        themes: ["funny"],
      },
    ],
  },
  {
    name: "Test Friend",
    relationship: "College friend",
    token: "test-friend",
    color: { r: 160, g: 120, b: 200 },
    lines: [
      {
        kind: "audio" as const,
        title: "From your friend",
        summary: "Gratitude for years of friendship.",
        themes: ["gratitude", "tender"],
        spoken: [
          "Kelli you are everything",
          "Thank you for still being you",
          "I love you so much",
          "Happy birthday",
        ],
      },
    ],
  },
  {
    name: "Test Neighbor",
    relationship: "Neighbor",
    token: "test-neighbor",
    color: { r: 90, g: 160, b: 130 },
    lines: [
      {
        kind: "video" as const,
        title: "From next door",
        summary: "A neighbor wishing her a beautiful year.",
        themes: ["gratitude"],
        spoken: ["Happy birthday Kelli", "Proud of you", "Love always"],
      },
      {
        kind: "image" as const,
        title: "Porch flowers",
        caption: "Test flowers left on the porch.",
        themes: ["tender"],
      },
    ],
  },
];

function runFfmpeg(build: (cmd: ffmpeg.FfmpegCommand) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    build(cmd);
    cmd.on("end", () => resolve()).on("error", reject);
  });
}

async function makeJpeg(
  dir: string,
  label: string,
  color: { r: number; g: number; b: number },
) {
  const path = join(dir, `${label}.jpg`);
  const svg = `
    <svg width="1200" height="900" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="rgb(${color.r},${color.g},${color.b})"/>
      <rect x="60" y="60" width="1080" height="780" fill="rgba(21,16,33,0.35)" rx="32"/>
      <text x="600" y="420" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="#F6F0E8">${label}</text>
      <text x="600" y="500" text-anchor="middle" font-family="Georgia, serif" font-size="36" fill="#F6F0E8">test photo for Kelli</text>
    </svg>
  `;
  await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(path);
  return path;
}

async function makeAudio(dir: string, label: string, seconds = 6) {
  const path = join(dir, `${label}.mp3`);
  await runFfmpeg((cmd) => {
    cmd
      .input(`sine=frequency=440:duration=${seconds}`)
      .inputFormat("lavfi")
      .audioCodec("libmp3lame")
      .audioBitrate("96k")
      .save(path);
  });
  return path;
}

async function makeVideo(
  dir: string,
  label: string,
  color: { r: number; g: number; b: number },
  seconds = 6,
) {
  const path = join(dir, `${label}.mp4`);
  const posterPath = join(dir, `${label}-poster.jpg`);
  const hex = `0x${[color.r, color.g, color.b]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;

  await runFfmpeg((cmd) => {
    cmd
      .input(`color=c=${hex}:s=1280x720:d=${seconds}`)
      .inputFormat("lavfi")
      .input(`sine=frequency=523:duration=${seconds}`)
      .inputFormat("lavfi")
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-pix_fmt yuv420p", "-shortest"])
      .save(path);
  });

  await runFfmpeg((cmd) => {
    cmd.input(path).screenshots({
      timestamps: ["1"],
      filename: `${label}-poster.jpg`,
      folder: dir,
      size: "1280x?",
    });
  });

  return { path, posterPath };
}

function buildSpeech(lines: string[]) {
  const sequence: {
    raw: string;
    normalized: string | null;
    startMs: number;
    endMs: number;
  }[] = [];
  let cursor = 400;
  for (const line of lines) {
    for (const part of line.split(/\s+/)) {
      const startMs = cursor;
      const endMs = cursor + 280;
      sequence.push({
        raw: part,
        normalized: normalizeWord(part),
        startMs,
        endMs,
      });
      cursor = endMs + 80;
    }
    cursor += 350;
  }
  return {
    sequence,
    kept: sequence.filter(
      (w): w is typeof w & { normalized: string } => !!w.normalized,
    ),
    fullText: `${lines.join(". ")}.`,
    durationSeconds: Math.max(6, Math.ceil(cursor / 1000) + 1),
  };
}

async function uploadFile(
  pathname: string,
  filePath: string,
  contentType: string,
) {
  const buf = await readFile(filePath);
  return put(pathname, buf, {
    access: BLOB_ACCESS,
    contentType,
    addRandomSuffix: true,
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error("BLOB_READ_WRITE_TOKEN missing");

  console.log("Clearing previous test data…");
  await cleanTestData();

  const workDir = await mkdtemp(join(tmpdir(), "kelli-seed-"));
  console.log(`Working in ${workDir}`);

  try {
    for (const person of PEOPLE) {
      console.log(`\n→ ${person.name}`);
      const [contributor] = await db
        .insert(contributors)
        .values({
          name: person.name,
          relationship: person.relationship,
          inviteToken: person.token,
          isTest: true,
        })
        .returning();

      for (const [idx, line] of person.lines.entries()) {
        const slug = `${person.token}-${idx}`;

        if (line.kind === "image") {
          const jpg = await makeJpeg(workDir, slug, person.color);
          const blob = await uploadFile(`test/${slug}.jpg`, jpg, "image/jpeg");
          const thumb = await sharp(jpg)
            .resize({ width: 800, withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
          const thumbBlob = await put(`test/${slug}-thumb.jpg`, thumb, {
            access: BLOB_ACCESS,
            contentType: "image/jpeg",
            addRandomSuffix: true,
          });

          await db.insert(media).values({
            contributorId: contributor.id,
            blobUrl: blob.url,
            posterUrl: thumbBlob.url,
            kind: "image",
            width: 1200,
            height: 900,
            status: "ready",
            title: line.title,
            summary: line.caption,
            caption: line.caption,
            themes: line.themes,
            originalFilename: `${slug}.jpg`,
            isTest: true,
          });
          console.log(`  ✓ image ${line.title}`);
          continue;
        }

        const speech = buildSpeech(line.spoken);
        let blobUrl = "";
        let posterUrl: string | null = null;
        const kind = line.kind;
        let width: number | null = null;
        let height: number | null = null;
        const duration = speech.durationSeconds;

        if (line.kind === "audio") {
          const audioPath = await makeAudio(workDir, slug, duration);
          const blob = await uploadFile(
            `test/${slug}.mp3`,
            audioPath,
            "audio/mpeg",
          );
          blobUrl = blob.url;
        } else {
          const video = await makeVideo(workDir, slug, person.color, duration);
          const blob = await uploadFile(
            `test/${slug}.mp4`,
            video.path,
            "video/mp4",
          );
          blobUrl = blob.url;
          const poster = await uploadFile(
            `test/${slug}-poster.jpg`,
            video.posterPath,
            "image/jpeg",
          );
          posterUrl = poster.url;
          width = 1280;
          height = 720;
        }

        const [mediaRow] = await db
          .insert(media)
          .values({
            contributorId: contributor.id,
            blobUrl,
            posterUrl,
            kind,
            width,
            height,
            durationSeconds: duration,
            status: "ready",
            title: line.title,
            summary: line.summary,
            themes: line.themes,
            originalFilename: kind === "audio" ? `${slug}.mp3` : `${slug}.mp4`,
            isTest: true,
          })
          .returning();

        const [transcript] = await db
          .insert(transcripts)
          .values({
            mediaId: mediaRow.id,
            fullText: speech.fullText,
            language: "en",
          })
          .returning();

        if (speech.kept.length) {
          await db.insert(words).values(
            speech.kept.map((w) => ({
              transcriptId: transcript.id,
              mediaId: mediaRow.id,
              contributorId: contributor.id,
              raw: w.raw,
              normalized: w.normalized,
              startMs: w.startMs,
              endMs: w.endMs,
            })),
          );
        }

        const detected = detectPhrases(speech.sequence);
        if (detected.length) {
          await db.insert(phrases).values(
            detected.map((p) => ({
              mediaId: mediaRow.id,
              contributorId: contributor.id,
              text: p.text,
              startMs: p.startMs,
              endMs: p.endMs,
            })),
          );
        }

        console.log(
          `  ✓ ${kind} ${line.title} (${speech.kept.length} words, ${detected.length} phrases)`,
        );
      }
    }

    console.log("\nDone. All seeded rows have is_test = true.");
    console.log("Remove them with: npm run seed:test:clean");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
