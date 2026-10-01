# Reverse Bingo: Concept Notes

*Discussion summary, 1 October 2026*
*added Decision log, advanced mixed business model,  1 October 2026*

## Decision Log
The below points serve as notes while the decision log captures some that I arrived to, after thinking through.

### Name and Domain

Did a small research and shortlisted to MumbahJumbah (mumbahjumbah.com) and BlahJack (blahjack.com)

## 1. The Idea

A "reversed bingo" for meetings. Instead of ticking off words as they're heard, participants predict the words **before** the meeting, and are scored afterwards against the real transcript.

## 2. How It Works

1. The organizer creates a meeting and shares a link.
2. Each participant fills in a 3x3 or 5x5 grid of words they expect to be used. Picks lock before the meeting starts.
3. After the meeting, the transcript is analyzed. Filler words ("a", "the", "and") are ignored, so the real jargon stands out.
4. Participants are scored and ranked on a leaderboard.

## 3. Game Modes

| Mode | What you do | How you score |
|---|---|---|
| **Classic grid** | Fill a 3x3 / 5x5 grid | Points per word that appeared, bonus for a full row or column |
| **Top words** (advanced) | List the words you think will be used most | Score by how close your list is to the real top list; correct order earns more |

## 4. Scoring Ideas

- Points scale with how often a word was actually said (20 mentions beat 2).
- **Bold-guess bonus:** words few other players picked earn more, which stops everyone from writing "meeting" and "project".
- No penalty for misses, to keep it fun and low-pressure.

## 5. Open Design Decisions

- **Transcript source:** paste text (easiest start), upload a file, or connect to Teams / Zoom / Meet.
- **Word variants:** should "deliver", "delivered" and "delivery" count as one word? Suggested default: yes.
- **Jargon vs. common words:** automatically ignore very common English words.
- **Privacy:** analyze transcripts without storing them, and make that a visible promise.
- **Link-based:** all participants could just use one link (like the slido qr code) to fill-in their guesses, so the initiator would have to generate that link
- **Concensus removal:** it could happen that some 'irrelevant' words are top mentions while not filtered out for some reason. There should be a way for either the initiator/moderator to remove it or for smaller teams there could a quick vote too. Process to be found out.

## 6. Business Model Options

1. **Freemium for teams**: free for small casual games; paid tiers for recurring leagues, history, custom word lists and branding (a few euros per user per month, or a flat team fee).
2. **Company engagement tool**: pitched as a culture perk with quarterly leaderboards, team vs. team contests and prizes. Per-company or per-seat annual pricing.
3. **Events and conferences**: per-event fee, or sponsors pay to brand the game.
4. **Insight add-on**: a "jargon report" showing which buzzwords dominate and how language changes over time. Use carefully, since employees may feel monitored.
5. **Marketplace integrations**: list in Teams, Slack, Zoom and Google Meet marketplaces for discovery and billing.
6. **Advanced mixed model**: free for teams under 10 people, 'must donate' 1$ for 10-25 people, enterprise deal for above

**Caveats**

- It's a light, fun product, so interest may fade after a few weeks. Recurring leagues and team competitions counter that.
- Individuals rarely pay for novelty; businesses with engagement budgets are the better bet.
- Transcripts are sensitive, so a clear privacy promise is also a selling point.

**Suggested path:** start free and viral through shared links, then convert team and company use into a paid plan with integrations and recurring competitions.

## 7. Patent Question

*(General picture only, not legal advice.)*

**Probably not worth pursuing:**

- Game rules and ordinary business methods are generally excluded in Europe and the US.
- Buzzword bingo, prediction games and word counting already exist, so novelty is weak.
- Software is patentable only with a real technical invention, not an old idea run on a computer.
- In Europe, publicly sharing the idea before filing usually forfeits patent rights. Patents also take years and cost thousands of euros.

**Better protection:**

- **Copyright:** code and design are protected automatically.
- **Trademark:** register a distinctive name and logo (cheap and useful).
- **Speed and execution:** being first, polished and well integrated matters more than a legal monopoly.
- **Community and data:** leaderboards, history and team habits are hard to copy.

A short first consultation with a patent attorney can confirm whether any specific technical part is protectable.

## 8. Next Steps

- [ ] Decide on first game mode: classic grid, top words, or both
- [ ] Build a browser-only prototype (create game, fill grid, paste transcript, see ranking)
- [ ] Settle word-variant and common-word handling
- [ ] Choose a name and check trademark availability
- [ ] Sketch pricing tiers

