# Implementation plan: issues #17–25 (design direction 2A)

Status: approved by user, not yet started. Branch `design-2a-implementation` exists (created from `main` at 89a21f2), with `npm install` done and `@fontsource/{archivo,anton,jetbrains-mono}` added as devDependencies (uncommitted `package.json` / `package-lock.json` changes). No source files edited yet. Baseline: `npm test` 54/54 passing.

Read first: `DESIGN.md`, `docs/design/README.md`, mockups in `docs/design/reference/`, starter UI in `docs/design/starter/src/ui/`.

## Foundation
- Copy `docs/design/starter/src/ui/{tokens,styles,components}.ts` into `src/ui/`.
- Replace `page()` in `src/index.ts` with `shell()`.
- Add shared pieces: error-card component, header/footer, CSS for segmented pills, stat tiles, dropzone, plan cards, scroll lists, leaderboard panel.
- Keep existing ids/roles: `#invite-link`, `#organizer-link`, `#recap-link`, `role="alert"`, `role="status"`.
- No new framework. Inline JS in the starter's pattern, with a no-JS fallback for each interaction.

## Order of work (one commit per issue, `Closes #N`)
1. **#17 Pick-count pills.** Radios (Custom default, 5, 10) plus a number input still named `pick_count`; JS shows the input only for Custom. Server: 5/10 used directly, Custom goes through existing `parsePickCount`. Existing tests post `pick_count` directly and keep working. Add tests for presets.
2. **#24 Restyle 404 and locked-session 403.** Error card, copy/meaning unchanged.
3. **#18 "Organizers only" 403.** On `/o/:token/*` routes (`/o/:t`, `/lock`, `/transcript`, `/leaderboard`, `/recap.png`), an invite token returns the new 403 instead of 404. Unknown tokens stay 404; locked-session 403 untouched. Code comment: mockup 8A's 409 "duplicate email" is intentionally not implemented (resubmitting the same email is a deliberate edit/upsert). Update existing tests that expect 404 for an invite token on `/o/*` (sessions, lock, upload, leaderboard, recap) to 403; unknown-token tests stay 404.
4. **#19 Landing + create-session.** Hero, how-it-works, who-it's-for, bottom CTA band, footer; New session card with zigzag above the red CTA; "See plans" links to `/plans`. "Session created" page gets invite + dashed organizer link cards with Copy buttons.
5. **#20 Invite grid screens.** Entry via `pickEntry()` plus email and display-name fields; submitted = chip summary; locked = "waiting for transcript" panel. Validation/submission unchanged; no-JS inputs still post repeated `pick`.
6. **#21 Organizer view.** Dashboard stat tiles, zigzag above "Lock the grids"; transcript dropzone + "Score the session" (label `.TXT · .VTT` only, no paste box); jargon result with proportional bars. Show only data that exists (participant count, pick count, "grids in" without "/ N"); no participant list (would need a new query).
7. **#22 Leaderboard.** Indigo ground, raffia winner band, podium styling for ranks 2–3, D5 split pane on desktop collapsing to one column on mobile. Update leaderboard tests that assert `<td>…</td>` to assert names and scores instead.
8. **#25 `GET /plans`.** Static 3-card page with placeholder prices (FREE / PRICE TBC / ON REQUEST). Team CTA links to `/`; others inert. Add route test.
9. **#23 Recap PNG.** Rebuild `recapLayout()` per mockup 5A: Archivo/Anton/JetBrains Mono woff files in `src/fonts/` (from `node_modules/@fontsource/*/files/*-latin-{400,800}-normal.woff`), logo mark, top-3 panel, single-path zigzag via `zigzagPath`. Remove Inter files, `@fontsource/inter` and the Inter license. Update recap tests (layout text assertions change; keep no-email and no-unpicked-word rules).

## Verification
`npm run typecheck` and `npm test` after each step. Visual check at 375px and 1280px if `wrangler dev` can run; otherwise say so.

## Decisions made
- `/` stays the combined landing + create form.
- No session-name field, no paste box, no `.srt`, no 409 screen.
- Operator/branding screens (7A/7B/D7) out of scope.

## Open issue when this was saved
User asked to build via `/afk-build`, which was not found (not in the skill list, nothing in `~/.claude` or the repo). User is fixing that before the build starts.
