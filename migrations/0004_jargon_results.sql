-- Jargon Result: derived term-frequency data, scoped to terms participants picked.
-- One row per distinct picked term that occurred at least once. The raw Transcript is never stored.
CREATE TABLE jargon_results (
  session_id INTEGER NOT NULL REFERENCES sessions (id),
  term TEXT NOT NULL,
  occurrences INTEGER NOT NULL CHECK (occurrences > 0),
  PRIMARY KEY (session_id, term)
);
