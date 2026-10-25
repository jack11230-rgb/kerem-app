# Kerem — members club for shiurim, lectures & philosophy

Kerem is a mobile-first, installable PWA for a private, invitation-only circle. Members can:

- RSVP to shiurim and see who is going
- browse a library of recordings with summaries and key points
- talk in the Members' Hall, where claims get an AI fact-check
- have heated threads moved into side rooms
- join a live shiur with chat and upvoted Q&A
- get an AI discussion summary when a shiur ends

**Stack:** Next.js 15 (App Router) + TypeScript, SQLite via Drizzle ORM (`@libsql/client`), realtime over Server-Sent Events, and email + password auth with invite codes. It is one deployable Node app.

---

## Run it locally

```bash
cd kerem-app
npm install
cp .env.example .env          # optional — every value has a default
npm run seed                  # creates data/kerem.db, demo data and DEMO_LOGINS.md
npm run build
npm run start                 # http://localhost:3000   (or: npm run dev)
```

To keep it running in the background:

```bash
nohup npm run start > server.log 2>&1 &
```

The demo **admin** and **demo-member** logins are written to `DEMO_LOGINS.md`. That file is git-ignored; open it locally. Each `npm run seed` resets the database and creates new passwords.

**Signing up:** open `/join?code=<code>`, or enter an invite code on the gate screen. The seed creates a multi-use test code, listed in `DEMO_LOGINS.md`. Admins can also create new codes under **Profile → Admin panel → Invites**.

**Live shiur:** the seed schedules the first shiur about 12 minutes after you run it, so you will see the "Shiur starts in 15 min" reminder. As admin, open **Live** and press **Go live now**. You can also open the event and press **Start live shiur now**.

### End-to-end test

```bash
npm run build && npm run start &        # server on :3000
node tests/e2e.mjs                      # BASE=http://host:port to target another server
```

The Playwright script reads credentials from `DEMO_LOGINS.md` and covers:

- the invite gate, and signup with an invite code (a bad code is rejected)
- RSVP across two contexts
- calendar and `.ics` export
- library highlight saved to My Notes
- realtime Hall chat between two browser contexts
- the heated-thread heuristic opening a side room, with a Join card in the Hall
- live shiur: go live, chat, Q&A upvote, then End & summarize to get a discussion summary (also added to the Library)
- member/admin permissions, and invite creation plus application approval

It saves screenshots at 390×844 to `screenshots/`. Run it against a freshly seeded database (`npm run seed`, then restart the server), because the live test uses the next scheduled shiur.

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./data/kerem.db` | SQLite file, or a `libsql://…` Turso URL |
| `DATABASE_AUTH_TOKEN` | — | Turso/libsql token (remote DB only) |
| `AI_API_KEY` | — (empty means offline mode) | Key for any **OpenAI-compatible** chat-completions API |
| `AI_BASE_URL` | `https://api.openai.com/v1` | e.g. OpenAI, Azure OpenAI, OpenRouter, Together, Groq, a local Ollama/vLLM |
| `AI_MODEL` | `gpt-4o-mini` | Any chat model that can return JSON |
| `ROOM_ARCHIVE_HOURS` | `24` | Quiet side rooms auto-archive after this, and a recap is posted to the Hall |
| `REMINDER_MINUTES` | `15` | Lead time for the "Shiur starts in N min" notification |
| `UPLOAD_DIR` | `./data/uploads` | Where admin media uploads are stored |
| `COOKIE_SECURE` | — | Set to `1` behind HTTPS to mark the session cookie `Secure` |
| `CRON_SECRET` | — | Protects `GET /api/cron?key=…`, used on hosts without a long-running process |

---

## AI: what is real and what is the fallback

All AI goes through `lib/ai.ts`, which calls `POST {AI_BASE_URL}/chat/completions` with a JSON response format.

**With no key (the current state)** the app runs in a clearly labeled **offline mode**. The Home screen shows an "AI features are running in offline mode" note:

| Feature | With `AI_API_KEY` | Offline fallback |
|---|---|---|
| Fact-check badge in the Hall | Model labels the claim **Accurate / Partly inaccurate / Inaccurate / Unverifiable**, with a correction and a source note | Claim-like messages get a dashed **"AI fact-check not configured"** note. The seeded fact-checks are marked "(demo seed)". |
| Heated-thread detection | A cheap heuristic decides when to ask the model, which then confirms the thread is heated, titles it and picks where it starts | Heuristic only: confrontational phrases, CAPS, `!!`, "you…", and rapid back-and-forth between two people. The room card says "Detected by heuristics (AI not configured)". |
| Side room titles | Model writes "On <Topic>" | Topic keyword match (Free Will, Lashon Hara, Faith & Reason…) or a proper-noun fallback |
| Live discussion summary (themes, top questions, insights) | Model-written | **Extractive**: themes by keyword, top questions by votes, and notable comments. Labeled "Extractive · AI off". |
| Library summary / key points | Admin-entered, or auto-generated from the transcript when left blank | Admin-entered, or extractive from the transcript |

**To turn on real AI:** set `AI_API_KEY` (and `AI_BASE_URL` / `AI_MODEL` if you are not using OpenAI's defaults), then restart. Nothing else needs to change. Notes:

- A small, fast model (gpt-4o-mini class) is enough.
- Each Hall message makes at most one fact-check call.
- Heat checks only call the model after the heuristic score passes 0.3.
- If the API fails, the app falls back to the offline behavior and logs `[ai] … failed`.

---

## Deploying publicly

The app keeps realtime (SSE) and a 30-second scheduler in memory, so it needs **one long-running Node process with a persistent disk**.

**Recommended:** [Railway](https://railway.app), [Fly.io](https://fly.io) or [Render](https://render.com), each with a volume.

1. Push `kerem-app/` to a Git repo. Do **not** commit `DEMO_LOGINS.md` or `data/`; both are git-ignored.
2. Create a service from the repo.
   - Build command: `npm ci && npm run build`
   - Start command: `npm run start` (it listens on port 3000; set the platform's `PORT` to 3000, or change `-p` in `package.json` to `-p $PORT`).
3. Mount a volume, e.g. at `/data`, and set:
   - `DATABASE_URL=file:/data/kerem.db`
   - `UPLOAD_DIR=/data/uploads`
   - `COOKIE_SECURE=1`
   - the `AI_*` variables
4. Run `npm run seed` once from the platform shell. This creates the schema, the admin and the demo data, and writes `DEMO_LOGINS.md` on the server. Sign in as admin and change the passwords, or create your own admin, then remove the demo users.
5. Add your domain, e.g. `kerem.club`, in the platform's dashboard and point a CNAME at it. HTTPS is automatic.

### Render (free plan, demo deployment)

The free plan has no persistent disk, so the database lives in `/tmp` and is recreated and re-seeded on every start:

- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm run start:prod` (runs `scripts/start-prod.sh`: creates the schema, seeds demo data if the DB is empty, then `next start -H 0.0.0.0 -p $PORT`)
- Health check path: `/api/health`
- Env vars: `NODE_ENV=production`, `COOKIE_SECURE=1`, `DATABASE_URL=file:/tmp/kerem/kerem.db`, `UPLOAD_DIR=/tmp/kerem/uploads`, `ADMIN_PASSWORD`, `DEMO_PASSWORD` (the seed uses these instead of random passwords and does not write `DEMO_LOGINS.md`), optional `AI_*`.

All data resets on restart, redeploy or idle spin-down. For real use, move to a paid instance with a persistent disk (see above) or Postgres.

**Vercel / serverless** also works, with these changes:

- Use Turso (`DATABASE_URL=libsql://…`) or Postgres.
- Replace the in-memory SSE bus with a hosted pub/sub such as Ably, Pusher or Supabase Realtime.
- Store uploads in S3 or R2.
- Call `GET /api/cron?key=$CRON_SECRET` every minute from an external cron to send reminders and archive rooms.

### Moving to Postgres (production notes)

- Port `lib/schema.ts` from `drizzle-orm/sqlite-core` to `drizzle-orm/pg-core`.
  - Columns: `integer` timestamps become `bigint` (or `timestamptz`), and JSON `text` columns become `jsonb`.
  - Driver: change `lib/db.ts` to `drizzle-orm/node-postgres`.
- Replace the boot-time DDL in `lib/ddl.ts` with `drizzle-kit generate` and `drizzle-kit migrate`.
- For more than one app instance, replace `lib/bus.ts`'s in-process EventEmitter with Postgres `LISTEN/NOTIFY` or Redis pub/sub, and run the scheduler in a single worker or through the cron route.
- Store uploads in S3/R2 instead of `UPLOAD_DIR`.

---

## Project layout

```
app/                 pages (App Router) and API routes (app/api/**)
components/          UI: Providers (session, SSE, toasts), chat, events, profile, summary
lib/                 server: db/schema/ddl, auth, ai, chat (heat & side rooms), events (live/summary), scheduler, bus (SSE)
public/              manifest, service worker, icons, offline page
scripts/seed.ts      demo data (users marked "demo")
tests/e2e.mjs        Playwright end-to-end
screenshots/         390×844 captures of the main screens
```

### Notes and limits

- **Seed media:** two library items use public sample MP4s from Google's `gtv-videos-bucket` (Big Buck Bunny, Elephants Dream) as placeholders. The others have no media. Admins can paste YouTube, Vimeo or `.mp4` links, or upload a file of up to 500 MB.
- **Web push:** notifications are in-app, plus a system notification through the service worker when the app is open in the background and permission was granted. Push delivery to a closed app (VAPID) is not set up yet.
- **Demo data:** demo members (Avi, Miriam, Yoni, Dani, Eli, Noa) are labeled **demo** throughout the app.
