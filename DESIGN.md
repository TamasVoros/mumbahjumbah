# MumbahJumbah — Design Doc (direction 2A)

Reverse bingo for meetings. Playful, dry, office-safe. Flat geometry, no ornament copied from real masks or textiles. Source files: `MumbahJumbah Directions.dc.html` (2A), `MumbahJumbah Screens.dc.html` (mobile set), `MumbahJumbah Desktop.dc.html` (1280px set).

## 1. Principles
1. Mobile first. Desktop adds a second column, never bigger type.
2. Flat and boxed: 1.5px ink borders, 2px corners, no shadows (except focus ring).
3. One accent per job: **indigo** = structure/primary, **red** = the committing action, **raffia** = winners and highlights.
4. The zigzag is a verb, not decoration: it appears only directly above a committing action (Submit, Lock, Score, Create session, recap card). Always full-bleed to its container edges. Never as a generic separator.
5. No face-paint, no literal masks beyond the logo mark. No hand-drawn ad-hoc marks.
6. Copy is dry and office-savvy. Jabs at jargon, never at people.

## 2. Colour

| Token | Hex | Use |
|---|---|---|
| `indigo` | `#1F2F63` | Hero grounds, leaderboard ground, primary buttons, filled pills, progress fill, logo mark |
| `night` | `#172352` | Cards/rows on indigo |
| `indigo-line` | `#3C4E8A` | Borders on indigo cards |
| `indigo-bar` | `#2B3F7A` | Score bars on indigo rows |
| `bone` | `#F4EFE6` | Default page ground, text on indigo |
| `paper` | `#FFFFFF` | Inputs, cards, rows on bone |
| `sand` | `#E9E4DA` | Canvas, browser chrome |
| `sand-bar` | `#ECE4D2` | Score bars on paper rows, disabled field |
| `ink` | `#17140F` | Text, all borders, secondary buttons |
| `muted` | `#5F5648` | Secondary text, mono labels |
| `placeholder` | `#8A8070` | Placeholder text |
| `red` | `#D2432C` | Committing CTA, zigzag, rank accent (alt) |
| `red-hover` | `#8F2B22` | Link hover |
| `raffia` | `#E3C26E` | Winner band, OPEN chip, 2nd/3rd highlight, accents on indigo |
| `raffia-dark` | `#7A6A3A` | Score bar on 2nd/3rd rows (indigo ground) |
| `green` | `#2F6B4F` | Branding swatch option only |

Pairings: bone on indigo, ink on raffia, white on red/indigo, ink on bone/paper. Don't put muted text on indigo; use bone at 85% opacity (13px+).
Disabled: opacity `.5`. Divider on paper tables: `1px rgba(23,20,15,.15)`. Unscored word row border `#C9C0AE`.
Focus ring: `1.5px indigo` border + `0 0 0 3px rgba(31,47,99,.12)` (4px on desktop).

## 3. Typography (Google Fonts)

- **Archivo** 400 / 600 / 800: UI and headlines
- **Anton**: numerals (scores, ranks, step numbers, counts)
- **JetBrains Mono** 400 / 700: labels, chips, URLs, hints

| Role | Font | Mobile | Desktop | Notes |
|---|---|---|---|---|
| Hero headline | Archivo 800 | 32 / 1.05, -0.01em | 68 / 1.02, -0.02em | |
| Page title | Archivo 800 | 26–30 / 1.1 | 34–44 / 1.1 | |
| Screen/session title | Archivo 800 | 22 | 24–36 | |
| Card title | Archivo 800/700 | 15–20 | 18–24 | |
| Body | Archivo 400 | 15 / 1.5 | 15–19 / 1.5 | |
| Secondary body | Archivo 400 | 13 / 1.45 | 14–15 / 1.5 | colour `muted` |
| Caption/hint | Archivo 400 | 12 / 1.4 | 12–13 | |
| Button | Archivo 700 | 15–16 | 16–17 | |
| Field/pick text | Archivo 400/600 | 15 | 19–22 | |
| Mono label | JetBrains Mono 400 | 11, +0.08em, UPPERCASE | 11–13 | `muted`; on indigo use raffia |
| Mono chip | JetBrains Mono 400 | 10, +0.06em, UPPERCASE | 10–11 | |
| Mono URL | JetBrains Mono | 12 | 14 | |
| Winner score | Anton | 44–52 | 40–48 | rank numeral 48–56 |
| Row score | Anton | 18–20 | 20–24 | |
| Stat | Anton | 32 | 36 | |
| Step numeral | Anton | 26 | 44 | colour `indigo` |

## 4. Space, shape, borders

- Base unit 4px. Common steps: 4 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28 · 32 · 40 · 56 · 64 · 80.
- **Radius**: 2px for boxes, buttons, inputs, cards. 99px for pills/chips/avatars. 28px phone frame (presentation only).
- **Borders**: 1.5px `ink` on paper/bone; dashed 1.5px for private things (organizer link, dropzone, Organization plan). Cards on indigo use `indigo-line`.
- **Mobile frame** 320 × 720. Page padding 24 horizontal, 32 top. Vertical rhythm between blocks 22–28; inside forms 24–26; between list rows 8 (leaderboard) / 10 (picks).
- **Desktop frame** 1280. Page padding 64 (app) / 80 (marketing). Column gap 48–64. Sidebar 340 (cards), results panel 520, operator nav 240.
- **Heights**: input 52 (mobile) / 76 (desktop hero field); list rows 38 (leaderboard) / 42–46 (picks, people); desktop table rows 46–56; button padding 15 (mobile) / 16–17 (desktop); chip padding 3×9; progress bar 8 with 1.5px border.
- **Touch targets**: primary controls are ≥ 44px tall. Pill × buttons are 18–22px visual; hit area must be extended to 44px in code.

## 5. Brand marks

**Logo mark** — stylised mask on a 64 × 84 viewBox, flat geometry: crown chevron, two triangle eyes, diamond mouth.
```svg
<svg viewBox="0 0 64 84">
  <path d="M32 2C14 2 6 16 6 38c0 24 10 44 26 44s26-20 26-44C58 16 50 2 32 2Z" fill="FILL"/>
  <path d="M12 24L32 12L52 24" fill="none" stroke="CUT" stroke-width="5"/>
  <path d="M13 40L28 36L22 48Z" fill="CUT"/>
  <path d="M51 40L36 36L42 48Z" fill="CUT"/>
  <path d="M32 54L38 64L32 76L26 64Z" fill="CUT"/>
</svg>
```
FILL = bone on indigo (or indigo on bone); CUT = the ground colour. Size 18×24 in headers, 22×29 on marketing. Wordmark "MumbahJumbah" Archivo 800, 17–20px, 8–10px right of the mark.

**Zigzag** — tile 16 × 16, repeat-x, height 16:
```css
background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M0 12L8 4L16 12' fill='none' stroke='%23D2432C' stroke-width='2.5'/%3E%3C/svg%3E") repeat-x;
height: 16px;
```
Full-bleed means edge to edge of the card or screen it sits in (cancel horizontal padding with negative margin).

## 6. Components

**Primary action (CTA)** — red ground, white Archivo 700, 2px radius, centered, full width on mobile. Used only for committing steps (Create session, Lock, Get recap). Secondary: indigo ground. Tertiary: 1.5px ink border on paper. On indigo: outline in bone.

**Pill button (Sign in)** — 1.5px border, 99px radius, 13px/600, padding 6×16 (mobile), 8×22 (desktop).

**Field** — paper ground, 1.5px ink border, 13–14px padding, 15px text, placeholder `placeholder`. Naming pattern: placeholder carries label + example, e.g. `Session name (e.g. Q3 All-Hands)`; no separate label for single-field forms.

**Pick entry (field + pills)** — one field, "Add" button inside (mobile) / `ENTER ↵` key hint (desktop). Added picks become indigo pills: bone text 14/600 (mobile) or 18/600 (desktop), padding 8×10×8×14, gap 8 (mobile) / 12 (desktop), with × chip (rgba bone .2). Counter: mono label `YOUR PICKS · 4 / 9`; progress bar and `4 of 9 picked` in the summary. Submit stays disabled (opacity .5, "Submit grid · 5 to go") until the count is met. When full, the field is replaced by a muted "All 9 picked. Remove one to swap it."

**Pick count segmented** — three equal boxes (9 · 25 · Custom), selected = indigo fill white text, others paper with ink border; 12px vertical padding, gap 8.

**Status chip** — mono 10px, 99px radius. OPEN = raffia fill; SUBMITTED = indigo fill, bone text; PENDING = paper, muted text, ink border; LOCKED = 1.5px border only; SCORED = paper with ink border; PRIVATE = raffia.

**Link card** — paper, 1.5px ink (dashed for Organizer link), padding 12×14 (mobile) / 20×22 (desktop). Title 14/700, "Copy" in indigo 700, mono URL in `muted`, one line of help.

**Progress bar** — 8px high, 99px radius, 1.5px ink border, paper track, indigo fill.

**Scroll list** — shows 7 full rows + half row (peek), thin scrollbar (2px, ink 18%, 40% on hover), followed by mono hint `SCROLL FOR ALL N` left, `↓ N MORE` right (10px, +0.08em). Used for player lists and long result lists.

**Winner band** — raffia ground, ink text. Rank numeral Anton 56, mono `TOP PREDICTOR` 10px, name Archivo 800 20–22, score Anton 44–48. Padding 14×16.

**Leaderboard row** — on indigo: `night` ground, `indigo-line` border, 38px high, rank (mono 12, 70%), name 14/600, score Anton 18, bar behind row = score / top score × 100% in `indigo-bar`. Ranks 2–3: raffia border, rank in Anton 22 raffia, bar in `raffia-dark`. Static in this phase (no reveal animation).

**Word result row** — paper, 46px, bar of count / max, mono `N picked`, Anton `×N`; the most-said word has a raffia bar, unseen words have a muted border.

**Stat tile** — paper, 1.5px ink, Anton 32–36 plus 12–13px muted label.

**Table (desktop)** — paper container, mono 11px header row with bottom 1.5px border, rows 46–56px with 1px faint dividers; chips in the status column.

**Plan card** — paper (Team), indigo (Coach), dashed bone (Organization). Padding 22×20 mobile / 32×28 desktop; name 20–24/800 + mono tag; description; feature list with 10px diamond bullets (gap 9–12); button at the bottom. Prices are placeholders: `FREE`, `PRICE TBC`, `ON REQUEST`.

**Dropzone** — dashed 1.5px ink on paper, 36×20 padding, upload glyph, mono `.TXT · .VTT · .SRT`.

**Privacy stamp** — mono 10.5px caps in a bordered paper box: `TRANSCRIPTS ARE READ IN MEMORY, THEN DELETED.`

**Recap card** — 1200 × 630 (design shown at 600 × 315), indigo ground, mark + wordmark top left, mono eyebrow in raffia, headline Archivo 800 (68px at full size), top-3 stack right, zigzag across the full width near the bottom, footer mono strip.

**Error page** — indigo head with Anton 56 raffia code and 20px headline; bone body with one explanation and one outlined action.

**Browser chrome (desktop mockups only)** — 36px sand bar, three 10px ink dots at 30%, URL pill in bone.

## 7. Screen inventory

| Screen | Mobile | Desktop |
|---|---|---|
| Landing | Screens · 1A | Desktop · D1 |
| Create session + links | Directions 2A · screen 2 | D2 |
| Invite → pick entry | Directions 2A · screen 3 | D3 |
| Grid submitted / edit | Screens · 3B | — |
| Grid locked (player) | Screens · 3C | — |
| Organizer dashboard | Screens · 4A | D4 |
| Transcript upload | Screens · 4B | — |
| Jargon result | Screens · 4C | D5 (left) |
| Leaderboard | Directions 2A · screen 4 | D5 (right) |
| Recap card | Screens · 5A | — |
| Errors 404 / 403 / 409 | Screens · 8A | — |
| Plans | Screens · 6A | D6 |
| Operator sessions / branding | Screens · 7A, 7B | D7 |

## 8. Voice

Dry, short, office-savvy. Examples: "Then the meeting happens, as meetings do." / "Predict the jargon. Win the meeting." Errors state the cause, then the way out. Never joke about the player, only about the vocabulary.

## 9. Open items
- Real pricing and plan limits.
- Decide whether error states and recap need desktop variants.
- Pill × and chip hit areas to 44px in implementation.
- Contrast check on `muted` over `sand-bar` rows once real data is in.
