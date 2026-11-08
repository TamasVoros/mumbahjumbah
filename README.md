# mumbahjumbah

Reverse Bingo v1 on Cloudflare Workers + Hono + D1. See `CONTEXT.md` and `docs/adr/`.

## Run locally / open it

- Local: `npm install`, `npm run migrate:local`, `npm run dev`, then open http://localhost:8787/ (the Create Session form; /health is the health check)
- Live: https://mumbahjumbah.com/ (custom domain only; workers.dev is disabled) - enter a Pick Count, click Create Session, and you get an Invite Link (/i/token) and a private Organizer Link (/o/token). Open the Invite Link to fill in email, display name and exactly Pick Count picks, then Submit Grid (resubmitting with the same email overwrites your Grid). Open the Organizer Link to see the participant count and click Lock Session; after that the Invite Link rejects all submissions and resubmissions (403). Once locked, the Organizer page shows an Upload Transcript form: choose a .txt or .vtt file and click Upload Transcript to see the Jargon Result (occurrence counts for only the words/phrases Participants picked). The file is processed in memory and never stored; uploading again replaces the result. After the Session is locked, a "View the leaderboard" link appears on the Organizer page and on the (locked) Invite Link page (/i/token/leaderboard and /o/token/leaderboard): participants ranked by Score, zero-match participants included, ties broken by submission order; it reflects the latest upload. The leaderboard pages (and the locked Invite Link page, and the Organizer page) also link to the **Recap Card**: a shareable 1200x630 PNG with the leaderboard and a "top terms" strip (only terms someone picked, by occurrences). Open it directly at /i/token/recap.png or /o/token/recap.png (409 until the Session is locked), then right-click and Save image to share it.

## How to use it (end to end)

1. Open the site and create a Session with a Pick Count (e.g. 9). Keep the Organizer Link private; send the Invite Link to your team.
2. Each Participant opens the Invite Link before the meeting and submits email, display name and 1 up to Pick Count distinct predicted words/phrases (resubmit with the same email to change them).
3. After the meeting, the Organizer opens the Organizer Link and clicks Lock Session (no more Grids).
4. The Organizer uploads the meeting transcript (.txt or .vtt). It is read in memory and discarded; only counts for picked terms are kept.
5. Everyone opens /i/token/leaderboard (or the Organizer /o/token/leaderboard) to see scores, and the Recap Card PNG link to download and post it in Slack.

## Demo session for UI review

In Claude Code, just type `/demo` (or `/demo locked`, `/demo scored`): it starts the server, seeds the session and prints the links. By hand: with `npm run dev` running, `npm run seed:demo` (re)creates a fixed local Session with static tokens and 7 participants, so the UI can be checked the same way after every change. `-- --stage open|locked|scored` picks how far to take it (default `open`; `scored` also uploads `scripts/demo/transcript.vtt`, 1,300+ words). Organizer: `/o/demo-organizer-00000000000000000000000000000000`, Invite: `/i/demo-invite-0000000000000000000000000000000000`. Local only.

Scripts: `dev`, `test`, `typecheck`, `deploy`, `migrate:local`, `migrate:remote`.

## Shipping (Phase 1: one environment)

There is a single Cloudflare environment: prod (Worker `mumbahjumbah`, D1 `mumbahjumbah`). Work on `main`:
`git commit`, `git push`, `npm run deploy` (applies pending D1 migrations to prod, then deploys the Worker).
`npm run dev` is local-only (simulated D1). A dev/prod split is planned for when payments land.
The D1 binding is `DB`; migrations live in `migrations/` (`NNNN_name.sql`).

Tests apply migrations/ automatically (test/setup.ts + vitest.config.ts); new migrations need no test wiring.
