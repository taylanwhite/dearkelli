# Words About Kelli

A private birthday site. Family and friends send videos, voice memos, and photos. Everything is transcribed. The home page is a word cloud of every word said about her — click a word, hear everyone say it.

## Stack

Next.js 15 · Neon Postgres · Drizzle · Vercel Blob · OpenAI Whisper · Tailwind · d3-cloud

## Setup

1. Copy env and fill in values:

```bash
cp .env.example .env.local
```

You need:

- `DATABASE_URL` — Neon connection string
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob
- `OPENAI_API_KEY` — Whisper + captions
- `SITE_PASSWORD` — the shared gate for her site
- `ADMIN_PASSWORD` — admin console at `/admin`
- `GATHER_TOKEN` — secret path for the mom invite page (`/gather/<token>`)

2. Install and push schema:

```bash
npm install
npm run db:push
```

3. Run locally (or deploy to Vercel):

```bash
npm run dev
```

Mom’s invite board: `https://your-domain/gather/<GATHER_TOKEN>`  
Contributor upload: `/send/<invite-token>` (generated on the gather page)  
Her site: `/` (password-gated)

## Collection first

Ship `/send/[token]` immediately. Uploads go straight to Vercel Blob from the browser (multipart, progress). The app records each file as `uploaded` — processing is separate so a long iPhone video never blocks the thank-you screen.

## Processing

After uploads land, run the pipeline by hand:

```bash
npm run process           # all status=uploaded
npm run process -- --failed
npm run process -- --id=<uuid>
```

It will:

1. Extract 16kHz mono MP3 with ffmpeg  
2. Transcribe with Whisper word timestamps  
3. Normalize / lemmatize / filter stopwords (with the emotional allowlist)  
4. Detect phrases like “i love you”  
5. Generate title, summary, themes  
6. Convert HEIC → JPEG, thumbnail, caption photos  

## Deploy

Deploy to Vercel. Set the same env vars. Connect Neon and Blob in the Vercel dashboard. After deploy:

```bash
npm run db:push
npm run seed
```

Share personal `/send/...` links. Keep `/send/open-kelli` as the nameless fallback.

## Build order (status)

1. Schema + Blob upload + `/send/[token]`
2. Manual transcription pipeline
3. Word cloud home
4. Word supercut
5. People + photos
6. Search + motion polish
