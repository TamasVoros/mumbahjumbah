# Use email as the Participant identity key, unverified in v1

**Status:** accepted

v1 needs participants to be linkable across sessions so that later phases (recurring team leaderboards, history) are additive rather than a rewrite — a freely-retyped display name can't guarantee that ("Alex" vs "alex" vs "Alexandra"). We considered a generated per-participant token/link instead, but chose **email** as the stable key because it's the same primitive SSO providers (Google/Microsoft Workspace) hand back as their core verified claim. v1 trusts the typed-in email with no verification (no login, no magic link) to preserve the zero-friction, no-accounts framing; a later phase adds a `verified_via` flag and an SSO step in front of the same field, without re-keying any historical participant data.

Display Name is kept as a separate, per-session cosmetic field — never used for identity matching.
