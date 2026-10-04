# mumbahjumbah

Reverse Bingo v1 on Cloudflare Workers + Hono + D1. See `docs/designs/reverse-bingo.md` and `docs/adr/`.

## Run locally / open it

- Local: `npm install`, `npm run migrate:local`, `npm run dev`, then open http://localhost:8787/ (the Create Session form; /health is the health check)
- Live (no domain needed): https://mumbahjumbah.tamasvoros86.workers.dev/ - enter a Pick Count, click Create Session, and you get an Invite Link (/i/token) and a private Organizer Link (/o/token). Open the Invite Link to fill in email, display name and exactly Pick Count picks, then Submit Grid (resubmitting with the same email overwrites your Grid)

Scripts: `dev`, `test`, `typecheck`, `deploy`, `migrate:local`, `migrate:remote`.
The D1 binding is `DB`; migrations live in `migrations/` (`NNNN_name.sql`).

Tests apply migrations/ automatically (test/setup.ts + vitest.config.ts); new migrations need no test wiring.
