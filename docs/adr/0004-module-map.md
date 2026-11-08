# Module map

Status: accepted (issue #28). The code is split into feature modules so a task touches one area. This is a refactor only: no behaviour changed.

## Modules

| Module | Covers | Files |
|---|---|---|
| **Gameplay** | Pick rules, scoring, lock/reveal flow, leaderboard ranking | `src/grids.ts`, `src/jargon.ts`, `src/transcript.ts`, `src/leaderboard.ts` |
| **Sessions and links** | Create session, invite/organizer links, lock state, access guards (403s) | `src/sessions.ts`, the `/o/` and `/i/` route guards in `src/index.ts` |
| **Identity and operators** | Email as identity key, operator record, later sign-in/accounts | Operator and email handling inside `src/sessions.ts` and `src/grids.ts`; `migrations/0002_operators_sessions.sql`, `migrations/0003_participants_picks.sql` |
| **Recap and sharing** | Recap card image, later recap decks | `src/recap.ts`, `src/qr.ts`, `src/harfbuzz-shim.ts`, `src/empty-shim.ts` |
| **Pages and design** | Shared page shell, styling, all screens, error pages | `src/pages/` (entry point `src/pages/index.ts`), `src/player-ui.ts`, `src/organizer.ts`, `src/dashboard.ts`, `src/dashboard-ui.ts`, `src/plans.ts`, `src/ui/` |
| **Storage** | Schema and queries | `migrations/` (queries live beside the module that owns the data) |
| **Branding** (later) | Per-operator logo, colours, links | not built (#27) |
| **Billing and plans** (later) | Pricing page now, payments in Phase 2 | not built (#25, #8); the static pricing page is `src/plans.ts` |
| **Insights** (later) | Cross-team jargon index | not built (#9) |

The three "later" modules are named here only. Do not create empty folders for them until they are built.

## Rules

- `src/index.ts` is routing only: middleware, token lookup, access guards, status codes. It calls module functions and returns what `src/pages/` renders. No HTML, CSS or copy lives in it.
- Page rendering goes through `src/pages/index.ts`. New screens are added under `src/pages/` (or the existing screen files listed above) and exported from that entry point.
- Domain logic never imports from pages. Pages may import domain types and read helpers.
- Existing file paths of the Gameplay, Sessions and Recap files are unchanged, so imports and tests keep working.
