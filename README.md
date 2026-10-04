# mumbahjumbah

Reverse Bingo v1 on Cloudflare Workers + Hono + D1. See `docs/designs/reverse-bingo.md` and `docs/adr/`.

## Run locally / open it

- Local: `npm install`, `npm run migrate:local`, `npm run dev`, then open http://localhost:8787/ (the Create Session form; /health is the health check)
- Live (no domain needed): https://mumbahjumbah.tamasvoros86.workers.dev/ - enter a Pick Count, click Create Session, and you get an Invite Link (/i/token) and a private Organizer Link (/o/token). Open the Invite Link to fill in email, display name and exactly Pick Count picks, then Submit Grid (resubmitting with the same email overwrites your Grid). Open the Organizer Link to see the participant count and click Lock Session; after that the Invite Link rejects all submissions and resubmissions (403). Once locked, the Organizer page shows an Upload Transcript form: choose a .txt or .vtt file and click Upload Transcript to see the Jargon Result (occurrence counts for only the words/phrases Participants picked). The file is processed in memory and never stored; uploading again replaces the result. After the Session is locked, a "View the leaderboard" link appears on the Organizer page and on the (locked) Invite Link page (/i/token/leaderboard and /o/token/leaderboard): participants ranked by Score, zero-match participants included, ties broken by submission order; it reflects the latest upload

Scripts: `dev`, `test`, `typecheck`, `deploy`, `migrate:local`, `migrate:remote`.
The D1 binding is `DB`; migrations live in `migrations/` (`NNNN_name.sql`).

Tests apply migrations/ automatically (test/setup.ts + vitest.config.ts); new migrations need no test wiring.
