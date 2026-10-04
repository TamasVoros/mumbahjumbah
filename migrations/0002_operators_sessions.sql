-- Operators own Sessions (ADR-0002: shared DB, every table scoped by operator_id).
CREATE TABLE operators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- v1 has exactly one Operator: a real row, referenced by a real foreign key.
INSERT INTO operators (id, name) VALUES (1, 'MumbahJumbah');

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_id INTEGER NOT NULL REFERENCES operators(id),
  pick_count INTEGER NOT NULL CHECK (pick_count > 0),
  organizer_link_token TEXT NOT NULL UNIQUE,
  invite_link_token TEXT NOT NULL UNIQUE,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX sessions_operator_id ON sessions (operator_id);
