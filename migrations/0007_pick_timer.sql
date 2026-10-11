-- Pick timer. All three NULL means the timer has not been started. Times are ISO-8601 UTC strings
-- (e.g. 2026-01-01T12:00:30.000Z), set server-side, so they compare correctly as text.
ALTER TABLE sessions ADD COLUMN timer_seconds INTEGER;
ALTER TABLE sessions ADD COLUMN timer_started_at TEXT;
ALTER TABLE sessions ADD COLUMN timer_ends_at TEXT;
