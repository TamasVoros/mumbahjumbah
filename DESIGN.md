---
# gstack: design-md-format=spec
name: MumbahJumbah
description: A reverse-bingo meeting game read through the graphic language of Mande masquerade pattern-work — earthy, geometric, quietly confident day-to-day, with a punch of color saved for the Leaderboard and Recap Card.
colors:
  bg: "#F7F4EE"            # warm bone white
  surface: "#FFFFFF"
  text: "#1A1714"          # ink
  text-muted: "#7A6F5E"    # earthy taupe
  red: "#B23A2E"           # clay/terracotta — primary accent, CTAs
  blue: "#1E3A5F"          # dyed indigo — secondary accent, Recap Card ground
  gold: "#C8932B"          # ochre — rare highlight, badges
  line: "#15130F"          # pattern linework + borders
  success: "#3F6B3A"
  warning: "#B8752B"
  error: "#8C1F1F"
typography:
  display:
    fontFamily: "Source Sans 3"
    fontWeight: 700
    fontSize: "clamp(1.5rem, 4vw, 2.25rem)"
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Source Sans 3"
    fontWeight: 400
    fontSize: 1rem
    lineHeight: 1.5
  label:
    fontFamily: "Space Mono"
    fontWeight: 700
    fontSize: 0.6875rem
    letterSpacing: 0.08em
  mono:
    fontFamily: "Anton"
    fontFeature: tnum
rounded:
  sm: 2px
  md: 4px
  lg: 8px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "#8F2B22"
  input:
    borderColor: "{colors.line}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  nav-link:
    textColor: "{colors.text}"
---

# MumbahJumbah

## Overview

**Creative North Star:** The product's name traces back to "mumbo jumbo" — itself a colonial garbling of *Maamajomboo*, a masked figure in Mandinka initiation rites (the Kankurang tradition). Rather than lean on the garbled, mocking sense of the phrase, the design draws on the actual visual language those traditions produced: repeating geometric pattern-work (short dashes, chevrons, triangles, the vocabulary of mudcloth/adire textiles), read through a clean, modern, product-grade lens — not costume, not kitsch.

**Product context:** A meeting game on Cloudflare Workers + Hono + D1. Participants predict jargon before a meeting ("Grid"), get scored against the transcript after, and the result is a public Leaderboard and a 1200×630 Recap Card PNG meant to be screenshotted into Slack. Small server-rendered app, no front-end framework.

**Mode per surface:**
- Create-session / Invite Link grid form — **Operate** (fast, mobile, low-friction data entry)
- Organizer view (lock, transcript upload, Jargon Result) — **Operate**
- Leaderboard — **Read**, with a flash of **Experience** (this is the pay-off moment)
- Recap Card PNG — **Experience** (the one artifact designed to be looked at, not used)

**Reference:** Hervé Youmbi's *Tso Scream Mask* (contemporary reinterpretation of Mandinka masquerade beadwork) supplied the original color impulse — deep indigo, bone white, vivid red, gold — refined here toward the flatter, more repeating graphic language of textile pattern-work rather than costume/ceremony literalism.

**Key characteristics:**
- Warm bone-white ground, not clinical SaaS white or dashboard gray
- Thin geometric linework (dash/chevron motifs) as structural decoration — borders and dividers, never a busy background
- One confident accent (clay red) used sparingly; indigo and gold reserved for specific moments, not general UI
- Day-to-day screens stay restrained and credible; personality is spent on the Leaderboard and Recap Card
- Bold condensed numerals (Anton) exist nowhere except score digits
- A small abstract geometric mark (below) carries the masquerade reference visually, not just through color

## Colors

**Strategy:** Restrained — one working accent (clay red) for interactive elements, with indigo and gold held back as reserved, occasional color rather than spread across the UI. Neutrals (bone white, ink, taupe) carry almost everything.

- `bg` / `surface`: warm, slightly warm-gray-toned whites — never pure `#FFF` on `#FFF`; the thin `line` border separates surface from ground instead of a shadow.
- `text` / `text-muted`: near-black ink and an earthy taupe for secondary copy — no cool grays.
- `red`: the only color on interactive controls day-to-day (primary buttons, links, focus ring, score highlight number). If a screen has more than one red element competing for attention, something's wrong.
- `blue` (indigo): reserved for the Recap Card background only — it's the one surface designed to pop when screenshotted, so it gets the one surface that isn't bone white.
- `gold`: reserved for small badges and the top-scorer highlight on the Leaderboard — a rare, earned color, not a secondary CTA color.
- Semantic (`success`/`warning`/`error`): standard earthy variants, used only for system feedback (form validation, 403/404/409 states), never for brand decoration.
- Dark surfaces (the Recap Card's indigo ground) get bone-white text and gold highlights — hierarchy preserved by swapping which neutral carries foreground vs. background, not by inverting lightness mechanically.

## Typography

- **Source Sans 3** carries display, body and UI uniformly — headings, form labels, button text, table copy. Chosen specifically because it's a free Google Font, clean and credible (not a trendy AI-default display face), and reads fine at small sizes on a 375px form.
- **Anton** is reserved *exclusively* for score digits — the big number on the Leaderboard and the score strip on the Recap Card. Nowhere else. It's the one piece of "poster" personality in the system; if it starts appearing in page headings or buttons, that's a bug, not a feature.
- **Space Mono**, uppercase with tracking, for small state badges only (`LOCKED`, `SUBMITTED`). Used like a stamp, not as a UI font family.
- Loading: all three fonts load via Google Fonts `<link>` (woff2); no self-hosting needed.
- Scale: a single clamp-based display size (`clamp(1.5rem, 4vw, 2.25rem)`) covers every page heading from 375px to desktop — no separate mobile/desktop type scale to maintain.

## Logo & Mark

A small mark built from the same geometric vocabulary as the border pattern-work, so the masquerade reference lives in the brand's actual shape language rather than only in a color choice. How literal it gets (fully abstract glyph vs. a more direct mask-like form) is not decided yet — treat the description below as the current direction, open to revision when it's actually drawn:

- **Form:** a symmetrical glyph roughly mask-proportioned (taller than wide) assembled from the system's existing primitives — two small triangles for eyes, a chevron band across the top standing in for a crown/headpiece, a single vertical diamond for a mouth. Pure geometry, flat, one color (`line` ink, or `surface` reversed out of `blue` on dark grounds) — no shading, no fabric/beadwork texture.
- **Where it appears:** the site favicon/header wordmark lockup (small, left of "MumbahJumbah" in the nav), and as a single small corner stamp on the Recap Card (bottom corner, low-contrast, like a maker's mark/hallmark) — never tiled, never large, never the hero element.
- **Why it's built this way:** the product is named after a real masquerade tradition (Maamajomboo/Kankurang); the mark uses the same triangle/chevron/diamond vocabulary as the patterned borders so it visibly belongs to the rest of the system rather than being a bolted-on icon.
- **Open question:** whether to push this further toward an actual mask-like face (more literal, more distinctive) or keep it fully abstract is undecided — revisit when it's actually drawn in issue #15 (`/design-html`) or during `/design-shotgun` (#13), where real variants can be compared side by side.
- **Construction note for implementation:** build it as inline SVG reusing the pattern system's existing triangle/chevron/diamond primitives (the same path shapes as the card border motif).

## Layout

- Single-column, grid-disciplined, mobile-first (375px primary breakpoint); desktop simply caps content width (max 640px) and centers it — no multi-column desktop layout, this app doesn't need one.
- The Grid submission form (9 picks) is a clean numbered checklist, one input per row, with a sticky progress indicator ("4/9 picked") pinned above the keyboard-safe area on mobile.
- Spacing rhythm: `md` (16px) between related fields, `xl`/`2xl` (32–48px) between sections (form → submit button, leaderboard header → rows).
- No sidebar, no nav chrome — every page is a single task (create, submit grid, lock, upload, view).

## Elevation & Depth

- No drop shadows. Depth is communicated by the `line` (#15130F) border at 1–1.5px between surface and background — flat, print-like, holds up under Slack's image compression.
- The dash/chevron pattern motif doubles as a border treatment on cards (a short repeating dash run along the top edge) instead of a shadow cue.

## Shapes

- Small radii throughout (`sm` 2px, `md` 4px, `lg` 8px) — just enough to soften corners, not the bubbly uniform-radius look. Buttons use `md`, cards use `lg`, pills/badges use `full`.
- No nested-radius math needed — the system doesn't nest cards inside cards.

## Components

- **Button (primary):** `red` background, white text, `md` radius; hover darkens to `#8F2B22`; focus-visible gets a 2px `red` outline offset 2px (never color-only feedback).
- **Input:** `line`-colored 1px border, `sm` radius, bone-white surface; focus-visible swaps border to `red` at 2px plus the same outline treatment as buttons.
- **Card:** `surface` background, `line` border, `lg` radius, optional top-edge dash motif for the Leaderboard/Recap sections only.
- **Badge (LOCKED/SUBMITTED):** Space Mono uppercase, `gold` background with `text` ink, `full` radius pill, small — a stamp, not a status chip trend.
- **Score digit:** Anton, large, `red` on light surfaces / `gold` on the indigo Recap Card surface.
- All interactive elements: visible `focus-visible` outline (2px, offset 2px, accent-colored) — never relying on color alone, required for the 403/404/409 error-page links and form controls alike.

## Do's and Don'ts

- Do: keep Anton contained to score digits only — never a page heading, never a button label.
- Do: keep the dash/chevron motif structural (borders, dividers) — never a tiled background behind body text.
- Do: spend indigo and gold deliberately — if either shows up more than once per screen, pull it back.
- Do: give every form control a visible focus-visible state; check contrast on bone-white-on-bone-white situations.
- Don't: add a shadow anywhere — this system is flat and bordered on purpose.
- Don't: let the pattern motif become a decorative background texture — intentional, not expressive, decoration.
- Don't: add a second accent color for "variety" — restrained means one working color for interaction.
- Don't: reach for a purple/gradient/glow treatment on the Recap Card dark surface — the indigo ground stays flat.

## Motion

- **Approach:** minimal-functional.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out).
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms) long(400-700ms).
- **The one authored moment:** the score digit count-up on the Recap Card / Leaderboard when results first load — everything else is instant.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-05 | Initial design system created | /design-consultation for issue #12 (part of #10). Started from a parody "Office Supply Cult" direction (outside Claude subagent voice, Codex unavailable locally), revised twice at user request: toned down for corporate credibility, then re-grounded in the actual etymology of "mumbo jumbo" (Mandinka Maamajomboo/Kankurang masquerade pattern-work) instead of costume/parody, with color inspiration from Hervé Youmbi's *Tso Scream Mask*. All fonts switched to Google Fonts only per user request. |
| 2026-10-05 | Leaderboard screen: "Podium Pop" chosen (issue #13) | /design-shotgun. Three directions explored (Scoreboard Strip, Podium Pop, Ticket Stub Rows); Podium Pop approved — top-3 broken out as a flat bordered podium hero (gold dashed border + biggest Anton number for #1), rest of the field as a compact scrollable list below. A refinement pass (dropped wordmark, session-name subtitle, explicit scroll affordance) was generated and tested, then rolled back in favor of the original mockup — but its three notes still apply at implementation time: no MumbahJumbah wordmark on this page (nav bar carries branding), subtitle shows the session name not a tagline, and the list below the podium must scroll (sessions can hold 100+ participants). Mockup saved at `docs/designs/leaderboard-mockup.png`. |
