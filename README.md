# mumbahjumbah

Reverse Bingo v1 on Cloudflare Workers + Hono + D1. See `docs/designs/reverse-bingo.md` and `docs/adr/`.

## Run locally / open it

- Local: `npm install`, `npm run migrate:local`, `npm run dev`, then open http://localhost:8787/health
- Live (no domain needed): https://mumbahjumbah.tamasvoros86.workers.dev/health

Scripts: `dev`, `test`, `typecheck`, `deploy`, `migrate:local`, `migrate:remote`.
The D1 binding is `DB`; migrations live in `migrations/` (`NNNN_name.sql`).
