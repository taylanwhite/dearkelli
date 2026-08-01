# Words About Kelli

A private birthday site. Family and friends send videos, voice memos, and photos. Everything is transcribed. The home page is a word cloud of every word said about her. Click a word, hear everyone say it.

## Stack

Next.js 15 · Neon Postgres · Drizzle · Vercel Blob · OpenAI Whisper · Tailwind · d3-cloud

## Setup

1. Copy env and fill in values:

```bash
cp .env.example .env.local
```

You need:

- `DATABASE_URL`: Neon connection string
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob
- `OPENAI_API_KEY`: Whisper + captions
- `SITE_PASSWORD`: the shared gate for her site
- `ADMIN_PASSWORD`: admin console at `/admin`
- `GATHER_TOKEN`: secret path for the mom invite page (`/gather/<token>`)

2. Install and migrate:

```bash
npm install
npm run db:migrate
```

3. Run locally (or deploy to Vercel):

```bash
npm run dev
```

Mom’s invite board: `https://your-domain/gather/<GATHER_TOKEN>`  
Contributor upload: `/send/<invite-token>` (generated on the gather page)  
Her site: `/` (password-gated)

## Database migrations

Schema lives in `src/db/schema.ts`. Migrations are SQL files in `drizzle/`.

```bash
# After changing the schema:
npm run db:generate          # creates a new drizzle/000x_*.sql
npm run db:migrate           # apply locally

# Commit the drizzle/ folder, then deploy.
# Vercel runs migrations automatically before next build.
```

`npm run build` is `tsx scripts/migrate.ts && next build`. If a migration fails, the deploy fails, which is what you want.

`db:push` still exists for throwaway local experiments. Prefer generate + migrate for anything that ships.

## Test data

```bash
npm run seed:test         # 5 test people + jpgs/mp4s/audio, all is_test=true
npm run seed:test:clean   # delete test rows + blob files
```

Test people appear in the word cloud and admin with a **test** badge. Wipe them before the real birthday.

## Collection first

Ship `/send/[token]` immediately. Uploads go straight to Vercel Blob from the browser (multipart, progress). The app records each file as `uploaded`. Processing is separate so a long iPhone video never blocks the thank-you screen.

## Processing (automatic)

Every upload is analyzed as soon as it lands (`uploaded` → `processing` → `ready`):

1. Extract / normalize audio (ffmpeg when needed; Whisper 25MB limit)  
2. Transcribe with Whisper word-level timestamps  
3. Normalize words + detect phrases (“i love you”, …)  
4. AI metadata: title, summary, themes, word tags  
5. Photos: HEIC→JPEG, orient, thumbnail, vision caption + tags  

Set `PROCESS_SECRET` (or reuse `ADMIN_PASSWORD`) in Vercel. Manual batch still works:

```bash
npm run process           # all status=uploaded
npm run process -- --failed
npm run process -- --id=<uuid>
```


## Deploy

Deploy to Vercel with the same env vars (`DATABASE_URL` must be available at **build** time so migrations can run). Schema changes ship by committing files under `drizzle/`. No manual `db:push` on prod.

## Build order (status)

1. Schema + Blob upload + `/send/[token]`
2. Manual transcription pipeline
3. Word cloud home
4. Word supercut
5. People + photos
6. Search + motion polish
