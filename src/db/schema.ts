import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";

export const mediaKindEnum = pgEnum("media_kind", ["video", "audio", "image"]);
export const mediaStatusEnum = pgEnum("media_status", [
  "uploaded",
  "processing",
  "ready",
  "failed",
]);

export const contributors = pgTable(
  "contributors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    relationship: text("relationship"),
    inviteToken: text("invite_token").notNull().unique(),
    avatarUrl: text("avatar_url"),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("contributors_is_test_idx").on(table.isTest)],
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    blobUrl: text("blob_url").notNull(),
    kind: mediaKindEnum("kind").notNull(),
    durationSeconds: integer("duration_seconds"),
    width: integer("width"),
    height: integer("height"),
    posterUrl: text("poster_url"),
    status: mediaStatusEnum("status").notNull().default("uploaded"),
    title: text("title"),
    summary: text("summary"),
    themes: text("themes").array(),
    tags: text("tags").array(),
    caption: text("caption"),
    originalFilename: text("original_filename"),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("media_contributor_id_idx").on(table.contributorId),
    index("media_status_idx").on(table.status),
    index("media_is_test_idx").on(table.isTest),
  ],
);

export const transcripts = pgTable("transcripts", {
  id: uuid("id").defaultRandom().primaryKey(),
  mediaId: uuid("media_id")
    .notNull()
    .references(() => media.id, { onDelete: "cascade" })
    .unique(),
  fullText: text("full_text").notNull(),
  language: text("language"),
});

export const words = pgTable(
  "words",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transcriptId: uuid("transcript_id")
      .notNull()
      .references(() => transcripts.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    raw: text("raw").notNull(),
    normalized: text("normalized").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    /** speech = from transcript; tag = AI or human word-cloud tags */
    source: text("source").notNull().default("speech"),
  },
  (table) => [
    index("words_normalized_idx").on(table.normalized),
    index("words_contributor_id_idx").on(table.contributorId),
    index("words_media_id_idx").on(table.mediaId),
    index("words_source_idx").on(table.source),
  ],
);

export const phrases = pgTable(
  "phrases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
  },
  (table) => [
    index("phrases_text_idx").on(table.text),
    index("phrases_media_id_idx").on(table.mediaId),
  ],
);

export type Contributor = typeof contributors.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Transcript = typeof transcripts.$inferSelect;
export type Word = typeof words.$inferSelect;
export type Phrase = typeof phrases.$inferSelect;
