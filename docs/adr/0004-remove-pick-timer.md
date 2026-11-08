# Remove the Pick Timer; Lock & Start is the only way picking ends

**Status:** accepted

The Pick Timer (a 30-60 second countdown the Organizer started once the Session had a name) is removed. A Session now moves setup (no name) → open (named, Invite Link live, Participants join and pick in one pass) → locked, and **Lock & Start Session!** is the only way picking ends. Submissions are accepted while the Session is not locked, and the Session Name freezes at lock.

**Why:** the timer was unnecessary. It added a waiting screen, a synced countdown and lazy server-side expiry for little value, since the Organizer can already lock the Session at any moment.

**Consequences:**
- The participant-side submit-time column on the Organizer dashboard is dropped, with no replacement. It needed a start reference (the timer start) that no longer exists, and it was deliberately not rebased onto another reference such as the Session Name time or the Invite Link going live.
- Behavior change: early joiners can submit as soon as the Session is named, so the Invite Link going live is the effective start. There is no "wait for go" moment for Participants.
- A deliberate "go" signal (Participants held until the Organizer releases them) would be a separate feature, not part of this change.
- `DESIGN.md` has no timer or countdown styles, so it needed no change.
