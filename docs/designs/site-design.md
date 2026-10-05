# MumbahJumbah — Site Design

Canonical tokens live in [`DESIGN.md`](../../DESIGN.md) at the repo root (the format the `/design-consultation` and `/design-html` skills read/write). This document is the human-readable companion: the same system, with the reasoning, for anyone implementing or reviewing pages (issue #15) or doing visual QA (issue #16).

Produced via `/design-consultation` for issue #12 (part of #10).

## Creative North Star

MumbahJumbah's name traces back to "mumbo jumbo" — a colonial garbling of *Maamajomboo*, a masked figure from Mandinka initiation rites (the Kankurang masquerade tradition). The design draws on the actual visual language those traditions produced — repeating geometric pattern-work: short dashes, chevrons, triangles, the vocabulary of mudcloth/adire textiles — read through a clean, modern, product-grade lens. Not costume, not kitsch: the day-to-day app reads as a credible, sellable product; the pattern-work and a reserved accent color carry the identity instead.

Color research started from Hervé Youmbi's *Tso Scream Mask* (a contemporary reinterpretation of Mandinka masquerade beadwork — deep indigo, bone white, vivid red, gold), then was refined toward flatter, more repeating textile-pattern language rather than costume/ceremony literalism, at the user's request to keep this presentable for a potential corporate audience.

**Product:** a meeting game — participants predict jargon before a meeting ("Grid"), get scored against the transcript afterward, and the pay-off is a public Leaderboard and a 1200×630 Recap Card PNG meant to be screenshotted into Slack. Small server-rendered Hono app, mobile-first, no front-end framework.

**The one thing to remember:** the Recap Card and Leaderboard should be bold and shareable — the rest of the app stays restrained so the pay-off moment lands.

## Colors — Restrained

One working accent (clay red) carries interaction day-to-day; indigo and gold are held back for specific, earned moments rather than spread across the UI.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#F7F4EE` | warm bone-white page background |
| `surface` | `#FFFFFF` | cards, inputs |
| `text` | `#1A1714` | ink |
| `text-muted` | `#7A6F5E` | secondary copy |
| `red` | `#B23A2E` | the only interactive color day-to-day: primary buttons, links, focus ring, score highlight |
| `blue` | `#1E3A5F` | reserved — Recap Card background only |
| `gold` | `#C8932B` | reserved — small badges, top-scorer highlight |
| `line` | `#15130F` | borders, pattern linework |
| `success` | `#3F6B3A` | form/system feedback only |
| `warning` | `#B8752B` | form/system feedback only |
| `error` | `#8C1F1F` | form/system feedback, 403/404/409 pages |

No gradients, no drop shadows — depth comes from a 1–1.5px `line` border, flat and print-like (holds up under Slack's image compression).

## Typography

| Role | Face | Where |
|---|---|---|
| Display + body + UI | **Source Sans 3** | everywhere — headings, forms, buttons, table copy. Free Google Font, clean, reads well at small sizes on a 375px form. |
| Score digits only | **Anton** | the Leaderboard score and the Recap Card score strip. Nowhere else — not a heading, not a button. |
| Small badges only | **Space Mono**, uppercase, tracked | `LOCKED`, `SUBMITTED` state badges — used like a stamp. |

All three load from Google Fonts. A single clamp-based display size (`clamp(1.5rem, 4vw, 2.25rem)`) covers every heading from 375px to desktop.

## Layout

Single-column, grid-disciplined, mobile-first (375px primary); desktop caps content at 640px, centered. The 9-pick Grid form is a clean numbered checklist with a sticky "4/9 picked" progress indicator. No sidebar, no nav chrome — every page is one task.

## Pattern & Logo

- A thin repeating dash/chevron motif (the textile-pattern vocabulary) appears as a border treatment on cards and a background texture on the Recap Card only — structural decoration, never a busy tiled background.
- A small mark, built from the same triangle/chevron/diamond primitives as the border pattern, is used as the favicon/header lockup and a small corner stamp on the Recap Card. How literal it ultimately looks (abstract glyph vs. a more direct mask-like form) is undecided — to be settled when it's actually drawn, in `/design-shotgun` (#13) or `/design-html` (#15).

## Components, elevation, shapes, motion

See `DESIGN.md` for the full component spec (button/input/card/badge states), elevation rules (no shadows, border-only depth), radius scale, and motion timing. The one authored motion moment is the score count-up on the Recap Card / Leaderboard when results first load.

## Accessibility

- Every interactive element gets a visible `focus-visible` outline (2px, offset 2px, accent-colored) — never color alone.
- Semantic colors (`success`/`warning`/`error`) are reserved for actual system feedback, including the 403/404/409 error pages.
- Checked against WCAG AA contrast for `text`/`text-muted` on `bg`/`surface`, and `surface`-on-`red` for button labels.

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-10-05 | Initial design system | Ran `/design-consultation`. Outside voice: Codex unavailable locally, native Claude subagent proposed "Office Supply Cult" (stamp/raffle-ticket parody) — too much for a product the user may pitch to corporate buyers, so revised toward a restrained, credible direction. Re-grounded in the actual etymology of "mumbo jumbo" (Mandinka Maamajomboo/Kankurang masquerade pattern-work) rather than costume/parody, with color research starting from Hervé Youmbi's *Tso Scream Mask*. Fonts switched to Google Fonts only. Added a logomark direction tied to the same pattern vocabulary, left intentionally undecided on how literal it should get. |
