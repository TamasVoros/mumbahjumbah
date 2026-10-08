-- Cap pick_count at 100 at the database level too (SQLite cannot add a CHECK to an existing table
-- without a rebuild, so enforce it with triggers). Mirrors MAX_PICK_COUNT in src/sessions.ts.
CREATE TRIGGER sessions_pick_count_cap_insert
BEFORE INSERT ON sessions
WHEN NEW.pick_count > 100
BEGIN
  SELECT RAISE(ABORT, 'pick_count must be between 1 and 100');
END;

CREATE TRIGGER sessions_pick_count_cap_update
BEFORE UPDATE OF pick_count ON sessions
WHEN NEW.pick_count > 100
BEGIN
  SELECT RAISE(ABORT, 'pick_count must be between 1 and 100');
END;
