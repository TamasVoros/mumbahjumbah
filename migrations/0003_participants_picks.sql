-- Participants are scoped to one Session; email is the unverified identity key (ADR-0001),
-- stored lowercase. One row per (session, email) = one Grid per Participant per Session.
CREATE TABLE participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (session_id, email)
);

-- A Grid is the flat set of a Participant's Picks (normalized: lowercased, trimmed).
CREATE TABLE picks (
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  pick TEXT NOT NULL,
  PRIMARY KEY (participant_id, pick)
);
