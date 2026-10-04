# MumbahJumbah (Reverse Bingo)

A predict-then-reveal word-guessing game for meetings: participants predict words before a meeting, then get scored against the real transcript afterward. The domain term for "a meeting" is **Session** — see below — since the facilitator business model extends this beyond literal meetings to workshops and offsite icebreakers.

## Language

**Session**:
A single scored event — one Invite Link, one Organizer Link, one Transcript, one leaderboard. Deliberately general: in v1 it's always an actual meeting, but the term doesn't assume that, since the facilitator business model extends this to workshops, offsites, and icebreaker sessions that aren't meetings in the Zoom-call sense. "Meeting" stays fine as marketing language; **Session** is the domain term.
_Avoid_: Meeting (marketing language only, not the domain term), game, round

**Operator**:
The tenant/account that owns a group of Sessions — the thing a facilitator or company pays for (the unit the white-label business model bills). v1 persists Operator as a real table with a real row (not a hardcoded constant), referenced by every Session via a genuine foreign key — exactly one row in v1, used internally rather than sold, but a real entity so v2's multi-tenancy is additive (new rows) rather than a retrofit (backfilling a table that never existed).
_Avoid_: Account, tenant, team (reserve for later multi-Operator/cross-Operator framing if needed)

**Organizer**:
The person who creates a Session, sets its Pick Count, and starts/locks it. Belongs to exactly one Operator. In v1, the sole Operator is also the only Organizer, so the two collapse into one person — kept as separate concepts so Approach B (an Operator with multiple staff each organizing sessions) doesn't require renaming anything later.
_Avoid_: Host, admin, operator (Organizer is a per-Session role; Operator is the account)

**Invite Link**:
The public, unauthenticated link shared with Participants to open a Session and submit a Grid. Grants no Organizer actions.
_Avoid_: Session link, the link (ambiguous with Organizer Link)

**Organizer Link**:
A separate, private, unguessable link generated alongside the Invite Link when a Session is created. Only this link can start/lock the Session or upload its Transcript — the only thing gating Organizer actions in v1, since there's no login at all. A later phase replaces this with real authenticated access (and audit logging of Organizer actions) rather than link-secrecy.
_Avoid_: Admin link, invite link (the two links grant different, non-overlapping capabilities)

**Participant**:
A person who opens a Session's Invite Link and submits a Grid. Identified across Sessions by **Email** (the stable key); scoped to exactly one Session's leaderboard row per submission.
_Avoid_: Player, user, guest

**Email**:
The participant's stable cross-session identity key. Unverified and trusted in v1 (typed in, no login); the same field a future SSO provider (Google/Microsoft Workspace) verifies in later phases without re-keying history. See [ADR-0001](docs/adr/0001-email-as-identity-key.md).
_Avoid_: Identifier, username, account

**Display Name**:
A cosmetic, freely-editable label a Participant sets per Session for the leaderboard. Never used for identity matching — Email is.
_Avoid_: Name, username

**Grid**:
A Participant's set of exactly Pick Count distinct Picks for a Session. Purely a flat set — no row/column/line scoring, no positional meaning. Rendered visually as tiles for the bingo feel, but the data model has no shape concept. One Grid per (Participant Email, Session) — resubmitting before lock upserts the existing Grid rather than creating a duplicate leaderboard row.
_Avoid_: Card, board, picks (picks are the words themselves, the grid is the container)

**Pick Count**:
The number of Picks a Grid must contain for a given Session, set by the Organizer when creating the invite link (e.g. 9 or 25 as suggested presets — any positive integer is valid, not constrained to a perfect square). Replaces the earlier "3x3 or 5x5 grid size" framing, which wrongly implied a square dimension mattered.
_Avoid_: Grid size, dimensions (no x/y shape exists in the model)

**Pick**:
A single predicted term within a Participant's Grid — a word or a multi-word phrase (e.g. "synergy" or "move the needle") — normalized (lowercased, trimmed) before storage. Picks within one Grid must be unique — a duplicate term is rejected at submission, not silently deduped.
_Avoid_: Guess, entry, word (a Pick isn't always a single word)

**Transcript**:
The raw text/vtt file uploaded by the Organizer after a Session. Processed in memory for term-frequency extraction and discarded immediately — never persisted. Upload is retryable, not one-shot: a failed parse (corrupt file, empty content) or a wrong upload doesn't lock the Session — the Organizer can upload again, since "discarded after extraction" describes what happens to the file, not a one-time-only action.
_Avoid_: Recording, notes

**Jargon Result**:
The persisted, derived term-frequency data extracted from a Transcript via boundary-aware tokenized matching against each Session's Picks (single words, or a contiguous run of tokens for a multi-word phrase — never raw substring search, so "AI" doesn't match inside "said" or "campaign"), scoped to terms participants actually picked — not an arbitrary "top N terms said" list. This keeps the privacy surface self-inflicted: a sensitive term only surfaces if someone picked it. Stopword filtering applies only to single-word Picks; a multi-word phrase is matched as-is, since a phrase like "at the end of the day" is the meaningful unit even though it contains stopwords. If zero Participants submitted a Grid before lock, there are no Picks to match against, so the Jargon Result is empty — a valid (if anticlimactic) outcome, not blocked or treated as an error; nothing special-cases "no participants."
_Avoid_: Frequency data, word counts (acceptable informally, but Jargon Result is canonical when referring to the stored artifact), word-frequency (use term-frequency — Picks aren't always single words)

**Score**:
A Participant's total for a Session: the sum of transcript occurrence counts for each distinct Pick that appears at least once in the Jargon Result (after stopword filtering, for single-word Picks).
_Avoid_: Points, rank (rank is derived from Score, not the same thing)

**Recap Card**:
The single-Session shareable PNG artifact generated from that Session's Jargon Result, showing two things: the leaderboard (Participants ranked by Score) and a "top terms" strip (picked terms ranked by raw occurrence count). Both draw from the same Jargon Result — the top-terms strip is never an unscoped "most-said words" view, since that would reopen the privacy gap closed by scoping Jargon Result to picked terms only (see Flagged ambiguities / ADR context on R2-7). Distinct from the longer-term, longitudinal "jargon insights report" described in the design doc's vision — that requires multiple Sessions' history and doesn't exist in v1. In v1 it's always MumbahJumbah-branded; White-Label (v2+) lets an Operator apply its own branding instead.
_Avoid_: Wrapped card, insights report (reserve "insights report" for the future trends-over-time version)

**Recap Deck** (v2+, not v1):
A plain bundle of multiple Recap Cards from one Operator's Sessions (e.g. one per client engagement). Not a separately designed artifact — no deck-level layout, just an aggregation/export of existing Recap Cards.
_Avoid_: Report, presentation (implies more design work than this is)

**White-Label** (v2+, not v1):
The capability for an Operator to render Recap Cards (and Recap Decks) with its own branding instead of MumbahJumbah's. The basis of the facilitator business model — the facilitator is the Operator, their client sees their branding, not MumbahJumbah's.
_Avoid_: Custom branding, theming (White-Label is the canonical term — it's the named business-model capability, not a generic styling feature)

## Relationships

- An **Operator** owns one or more **Sessions**; an **Organizer** belongs to exactly one **Operator** and creates **Sessions** on its behalf (v1: one Operator, who is also the sole Organizer)
- Creating a **Session** generates exactly one **Invite Link** (for Participants) and exactly one **Organizer Link** (for the Organizer) — distinct capabilities, same Session
- A **Session** has exactly one **Pick Count**, set by the Organizer; every **Grid** submitted for that **Session** must contain exactly that many **Picks**
- A **Participant** submits exactly one **Grid** (a set of **Picks**) per **Session**
- A **Participant** is identified across **Sessions** by **Email**; **Display Name** is per-Session and cosmetic only
- A **Session** has at most one uploaded **Transcript**, which produces exactly one **Jargon Result** and is then discarded
- A **Participant**'s **Score** for a **Session** is computed from their **Picks** against that **Session**'s **Jargon Result**
- A **Session** produces one **Recap Card** from its **Jargon Result**

## Example dialogue

> **Dev:** "When a **Participant** opens the Invite Link a second time next week, how do we know it's the same person?"
> **Domain expert:** "By **Email** — that's the stable key. Their **Display Name** might be totally different; that's fine, it's cosmetic."
> **Dev:** "And the **Recap Card** — is that the Wrapped-style trends report?"
> **Domain expert:** "No, that's v1's single-**Session** snapshot. The trends-over-time report needs **Jargon Result** history across multiple **Sessions**, which doesn't exist yet."

## Flagged ambiguities

- "Transcript" was initially at risk of meaning both the raw upload and the stored frequency data — resolved: **Transcript** is the raw, never-persisted file; **Jargon Result** is the derived, persisted data.
- Participant identity was initially just a free-text name with no stable key, undermining cross-session linkage needed for later phases — resolved: **Email** (unverified in v1) is the identity key; **Display Name** is a separate, cosmetic concept. See [ADR-0001](docs/adr/0001-email-as-identity-key.md).
- The domain term for "a meeting" was originally **Meeting**, but since the facilitator business model (v2+) extends this to workshops and offsite icebreakers that aren't meetings in the video-call sense, renamed to **Session**. "Meeting" remains fine as marketing/product language.
