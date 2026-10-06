# Handoff: MumbahJumbah front-end redesign (direction 2A)

## Overview
A complete visual system and screen set for MumbahJumbah (reverse bingo for meetings): flat, boxed, dry. Indigo structures, red commits, raffia celebrates. Mobile first, with 1280px desktop layouts. This replaces the current bare server-rendered pages in `src/index.ts` and the purple Satori recap in `src/recap.ts`. It supersedes the earlier design-consultation/design-shotgun system (palette, fonts, motif and logo mark have all changed — see "Differences from the current repo").

## About the design files
Everything in `reference/` is an **HTML design reference** (prototypes showing intended look and behaviour), not production code. Recreate the designs in this codebase's own environment: **Hono server-rendered HTML (`hono/html`) on Cloudflare Workers, Satori + resvg-wasm for the recap PNG, no front-end framework.** `starter/` contains a ready first pass of the shared UI layer in that environment (tokens, CSS, shell, logo, zigzag, chips, pick entry). Treat it as the foundation, then build the screens on it.

## Fidelity
**High-fidelity.** Colours, type, spacing and copy are final except where listed under "Open items". Match them exactly.

## Reference files (open in a browser)
| File | What it shows |
|---|---|
| `reference/MumbahJumbah Design System.dc.html` | **Start here.** Visual spec: colour, type scale, space, marks, every component |
| `reference/MumbahJumbah Directions.dc.html` | Turn 2 (2A) at the top: create session, pick entry, leaderboard |
| `reference/MumbahJumbah Screens.dc.html` | All remaining mobile screens |
| `reference/MumbahJumbah Desktop.dc.html` | 1280px layouts D1–D7 |
| `../../DESIGN.md` | Plain-text token and component spec (moved here from this folder's `DESIGN.v2.md`) |

(`.dc.html` files need `support.js` beside them; it is included.)

## Differences from the current repo
| Topic | Current repo | New |
|---|---|---|
| Page bg | `#F7F4EE` | bone `#F4EFE6` |
| Interactive colour | clay red `#B23A2E` everywhere | **red `#D2432C` only for the committing action**; indigo `#1F2F63` is the structural/primary colour |
| Blue | reserved for recap only | indigo is a working colour (hero, leaderboard, pills, secondary buttons) |
| Gold | `#C8932B` small badges | raffia `#E3C26E` winner band, OPEN chip, ranks 2–3 |
| Fonts | Source Sans 3 / Anton / Space Mono | **Archivo / Anton / JetBrains Mono** (all Google Fonts) |
| Recap fonts | Inter woff in `src/fonts` | Archivo 400/800, Anton, JetBrains Mono woff files (see Recap) |
| Motif | dash/chevron border treatments, undecided mark | **no border patterns**; one zigzag used only above a committing action; mask mark is decided (below) |
| Layout | single column, 640px max everywhere | same on mobile; desktop gets a second column (see Desktop) |

`DESIGN.md` at the repo root is this design (direction 2A) — the design-consultation/design-shotgun system and its decisions log have been retired.

## Design tokens
Full tables are in `DESIGN.v2.md`; machine-readable in `starter/src/ui/tokens.ts` and CSS variables in `starter/src/ui/styles.ts`.
- Colours: indigo `#1F2F63`, night `#172352`, indigo-line `#3C4E8A`, indigo-bar `#2B3F7A`, bone `#F4EFE6`, paper `#FFFFFF`, sand `#E9E4DA`, sand-bar `#ECE4D2`, ink `#17140F`, muted `#5F5648`, placeholder `#8A8070`, red `#D2432C` (hover `#8F2B22`), raffia `#E3C26E`, raffia-dark `#7A6A3A`.
- Type: Archivo 400/600/800 (UI), Anton (numerals only), JetBrains Mono 400 (labels/chips/URLs, uppercase + tracking). Scale: hero 32/1.05 (desktop 68/1.02), page title 28 (34–44), screen title 22, body 15/1.5, secondary 13, caption 12, button 16/700, mono label 11 +.08em, mono chip 10 +.06em.
- Shape: radius 2px for boxes, 99px for pills/chips; border 1.5px ink; **no shadows** except focus (`0 0 0 3px rgba(31,47,99,.12)` + indigo border). Space base 4px; page padding 24 mobile, 64–80 desktop.
- Do not add gradients, extra shadows, or hand-drawn marks.

## Signature rules (these carry the brand)
1. **Zigzag** (`zigzag()` helper): 16px tile, red, full-bleed to its container, placed directly above exactly one committing action (Create session, Submit grid, Lock, Score, recap card). Never as a section separator or decoration; at most once per screen.
2. **Colour jobs**: indigo = structure, red = commit, raffia = winners/highlights.
3. **Logo mark** (`logoMark()` helper): mask on 64×84 viewBox with crown chevron, two triangle eyes, diamond mouth as cut-outs. Bone on indigo / indigo on bone. 18×24 in headers.
4. Copy is dry and office-savvy; errors state cause then way out. No face-paint, no costume imagery, no literal masks beyond the mark.

## Screens → routes
Existing routes in `src/index.ts`; rewrite their templates, keep handlers and status codes.

| Design screen | Route / handler | Notes |
|---|---|---|
| Landing (mobile 1A, desktop D1) | `GET /` | Today `GET /` is the create form. Either move the form to `/new` and make `/` the landing, or keep the form at `/` and add the landing later. Decide before building. |
| Create session (2A scr. 2, D2) | `GET /` or `/new` | Pick count segmented 9 / 25 / Custom → posts `pick_count`. Session name is **not in the backend yet**; omit or add a column (see Open items). |
| Session created + links | `POST /sessions` (201) | Invite link card + dashed Organizer link card with PRIVATE chip, Copy buttons. |
| **Pick entry** (2A scr. 3, D3) | `GET /i/:token`, error re-render on `POST /i/:token` (400) | Single field + pills. Use `pickEntry()`. Posts repeated `pick` fields so `validateGrid` is unchanged. Needs `email` and `display_name` fields (design shows email; display name is required by the backend — add it beside email). |
| Grid submitted / edit (Screens 3B) | `POST /i/:token` success | Pills with × and "Edit picks"; same component, prefilled. |
| Grid locked, player (3C) | `GET /i/:token` when `locked_at` (403) | Plus links to leaderboard and recap once available. |
| Organizer dashboard (4A, D4) | `GET /o/:token` (open) | Participant count today; table of participants (name, email, status) needs a new query. Zigzag above "Lock the grids". |
| Transcript upload (4B) | `GET /o/:token` (locked) | Dropzone for `.txt` / `.vtt` (design also lists `.srt` — backend accepts only .txt/.vtt, so drop `.srt` from the label unless you add it). Paste-text box is not in the backend; omit or add. Zigzag above "Score the session". |
| Jargon result (4C, D5 left) | locked view of `/o/:token` | Words ×count with "N picked" and bar = count ÷ max. |
| Leaderboard (2A scr. 4, D5 right) | `GET /i/:token/leaderboard`, `/o/:token/leaderboard` | Indigo ground (`shell(..., {board:true})`). Winner band + rows; ranks 2–3 use `.row--podium`; list scrolls with 7 rows + half-row peek and a `SCROLL FOR ALL N · ↓ N MORE` hint. Static: no reveal animation. |
| Recap card (5A) | `GET /i|o/:token/recap.png` | See Recap. |
| Errors 404/403/409 (8A) | existing 404/403/409 responses | `.err` header (Anton code in raffia) + one explanation + one outlined action. |
| Plans (6A, D6), Operator sessions/branding (7A/B, D7) | **no routes yet** | v2 scope. Build after the above. Pricing is placeholder (`FREE`, `PRICE TBC`, `ON REQUEST`). |

## Interactions & behaviour
- **Pick entry**: type, press Enter (or tap Add) → pill appears; × removes. Duplicates (case-insensitive) are rejected; field disables at N picks and placeholder becomes "All N picked. Remove one to swap it." Counter `YOUR PICKS · n / N`; progress bar = n/N; Submit is disabled (opacity .5, "Submit grid · k to go") until n = N. No-JS fallback: N numbered text inputs. Pill × has a 44px hit area.
- Focus: visible indigo outline everywhere; fields get indigo border + ring.
- Leaderboard is static. No count-up this phase.
- Scroll lists: thin 2px scrollbar, stronger on hover; always show the mono hint line.
- Desktop (≥960px): content is a 2-column grid (`.cols`: main + 340px side card). Side card holds progress/submit (D3) or lock card (D4); zigzag spans the card width (`zigzag(true)`). Results page (D5) is jargon list left, 520px indigo leaderboard panel right.

## Recap card (Satori)
Rebuild `recapLayout()` in `src/recap.ts` to this 1200×630 spec (design shown at 600×315, double all numbers):
- Ground indigo `#1F2F63`, text bone. Top-left: mask mark (44×58) + "MumbahJumbah" 36px Archivo 800.
- Left block at x=72, y=184: eyebrow `<SESSION NAME> · N PLAYERS` mono 24px raffia, +.08em; headline `"<Winner> called it."` Archivo 800 68px/1.05, width 600; line "N points. Most-said word: “term”, N times." 28px.
- Right stack x=728 w=400 y=60: winner band (raffia, rank Anton 68, name 32/800, score Anton 60), then ranks 2 and 3 as night rows with 1.5×2=3px raffia border, rank Anton 44 raffia, name 28/700, score Anton 40.
- Zigzag across full width at y≈520: one `<svg>` with a single `<path d={zigzagPath(1200)}>` stroke red `#D2432C` width 5 (Satori does not support CSS `background-repeat` with data-URI SVG reliably; a single path is safe).
- Footer strip y=574: mono 22px, bone at 85%: "PREDICT THE JARGON. WIN THE MEETING." left, "MUMBAHJUMBAH.COM" right.
- Fonts: add woff (not woff2) files to `src/fonts/` — `@fontsource/archivo` 400 + 800, `@fontsource/anton` 400, `@fontsource/jetbrains-mono` 400 — import them as in the current `inter-*.woff` imports and register in the `fonts` array. Remove Inter when unused. Only display names are drawn, never emails (keep that rule).
- Colours come from `tokens.ts` (`COLOR`), not hard-coded. Keep `truncate()` and row caps.

## Implementation order
1. Add `src/ui/{tokens,styles,components}.ts` from `starter/`; swap `page()` for `shell()` in `src/index.ts`; run typecheck and tests.
2. Restyle existing pages in place without changing handlers: create form, session created, grid form (use `pickEntry`), submitted, locked, organizer open/locked, leaderboard, errors.
3. Recap card and fonts.
4. Desktop layouts (CSS `.cols`, tables).
5. New product surface (landing, plans, operator, branding), each with its own routes and migrations.

## Testing notes
- Vitest runs in the Workers pool; existing tests that assert on page text or selectors (`#invite-link`, `#organizer-link`, `#recap-link`, `role="alert"`, `role="status"`) must keep those ids/roles in the new markup.
- Test the pick entry contract: with JS off, N fallback inputs post `pick` N times; with JS on, hidden `pick` inputs are generated. Server validation (`validateGrid`) remains the source of truth.
- Visual check each screen at 375px and 1280px; verify contrast: bone on indigo, ink on raffia, white on red/indigo pass; do not use `muted` on indigo.

## Open items
- Real pricing and plan limits.
- Session name (create form placeholder reads `Session name (e.g. Q3 All-Hands)`): add `name` to sessions or drop the field. Same for the paste-transcript box.
- Whether `/` becomes a marketing landing.
- Error and recap desktop variants (recap is a fixed-size image; errors reuse the mobile card centred).
- Operator/branding (white-label) data model.

## Claude Code starter prompt
> Read `design_handoff_mumbahjumbah_v2/README.md` and open `reference/MumbahJumbah Design System.dc.html` for the visual spec. Copy `starter/src/ui/*` into `src/ui/`. Replace `page()` in `src/index.ts` with `shell()` and restyle each existing page per the "Screens → routes" table without changing handler behaviour, status codes, ids or roles that tests use. Use `pickEntry()` for the grid form. Then rebuild the recap card per the Recap section with the new fonts. Run `npm run typecheck` and `npm test` after each step.
