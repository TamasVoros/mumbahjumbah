---
description: Start the local app with the fixed 7-participant demo session and print the links
argument-hint: [open|locked|scored]
---

Set up the demo session so the user can look at the UI. Do it all yourself; the user should only have to click links.

Stage: "$ARGUMENTS" if it is open, locked or scored, otherwise `open`.

1. If `curl -s http://localhost:8787/health` does not answer, run `npm run migrate:local`, then start `npx wrangler dev` in the background (run_in_background) and wait until `/health` answers.
2. Run `npm run seed:demo -- --stage <stage>` (see `scripts/seed-demo.mjs`).
3. Reply with only the links, as clickable URLs, and one line per page saying what it shows:
   - Organizer page: `http://localhost:8787/o/demo-organizer-00000000000000000000000000000000`
   - Participant page: `http://localhost:8787/i/demo-invite-0000000000000000000000000000000000`
   - If stage is `scored`, also the leaderboard (`/o/<organizer token>/leaderboard`) and recap card (`/o/<organizer token>/recap.png`).
4. Mention that `/demo locked` and `/demo scored` move the same session further along (the participant page only shows the pick form while the session is open). Leave the server running.

If anything fails, say what failed in one sentence instead of printing logs.
