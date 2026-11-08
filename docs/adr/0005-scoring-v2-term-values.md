# Scoring v2: per-term values weighted by rarity, phrase length and diminishing frequency

**Status:** accepted. Supersedes the "sum of occurrence counts" scoring wording in [ADR-0003](0003-pick-count-is-a-maximum.md).

Score used to be the sum of transcript occurrences of each distinct Pick, which rewarded common filler words said often over risky or multi-word predictions. Score is now the sum of per-term **values**; a term has one value, the same for everyone who picked it.

```
value(term) = round( 10 × hit × phrase × rarity )

hit    = log2(1 + occurrences)          // occurrences from the Jargon Result
phrase = 1.5 if the Pick has 2+ words, else 1
rarity = max(1 − s, 0.1)                // s = participants who picked the term / participants with a Grid
         rarity = 1 when the Session has fewer than 4 participants
```

**Decisions:**
- Round per term, then sum, so the values shown next to a Participant's Picks add up exactly to their Score.
- No term is dismissed: the 0.1 floor makes a word everyone picked worth a token amount, so top terms and the leaderboard show the same words.
- A Pick absent from the Jargon Result is worth 0. Words said but never picked never appear (Jargon Result privacy scope unchanged).
- Misses carry no penalty (as in ADR-0003).
- Tiebreaks: Score desc, then hits (Picks present in the Jargon Result) desc, then submission order (`participants.id`). Ranks stay positional.
- Values are derived (Jargon Result occurrences + pick counts across Grids), never stored. The pure function lives in `src/scoring.ts`; `getLeaderboard` feeds it.

**Consequences:**
- ADR-0003's statement that "scoring is unchanged (sum of occurrence counts)" no longer holds; submitting fewer Picks still just means fewer chances to score.
- Because the leaderboard page is shared by link rather than tied to an identity, each Participant's per-Pick values appear in an expandable breakdown there; Picks that were never said are collapsed into a "never said" count so unsaid Picks stay private.
- Out of scope: miss penalties, a separate solo-hit bonus, anti-collusion measures (coordinated picks gain nothing, since rarity falls as more people pick a term).
