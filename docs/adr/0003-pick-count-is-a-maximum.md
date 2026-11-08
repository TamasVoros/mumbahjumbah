# Pick Count is a maximum (1..N picks), not an exact requirement

**Status:** accepted

Originally every Grid had to contain exactly Pick Count Picks. We changed Pick Count to a **maximum**: a Participant submits between 1 and Pick Count distinct Picks. Submitting fewer Picks is a legitimate strategy rather than an error. (Originally "scoring is unchanged: the sum of occurrence counts"; that scoring is superseded by [ADR-0005](0005-scoring-v2-term-values.md).)

**Why:** an exact count forces filler picks from participants who have fewer genuine predictions, which pollutes the Jargon Result and makes per-participant pick counts uniform and therefore uninformative. With a maximum, "median picks per participant" becomes a meaningful statistic.

**Consequences:**
- `validateGrid` rejects 0 and more than Pick Count picks with "Submit between 1 and N picks"; duplicates, length and word limits are unchanged.
- No schema change: `sessions.pick_count` keeps its name and constraints (1..100); resubmission still upserts the Participant and replaces all of their Picks, so a resubmit may change the number of Picks.
- Participant UI says "up to N", enables submit from 1 pick, and the no-JS fallback only requires the first input.
- Organizer create form labels the field "Maximum picks".
