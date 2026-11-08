-- Remove the Pick Timer columns added in 0007. Nothing references them: the only index on sessions is
-- on operator_id, the 0005 triggers only touch pick_count, and there are no views or CHECKs on them.
-- Migration 0008 already locked any session whose timer ran, so no data is lost that still matters.
ALTER TABLE sessions DROP COLUMN timer_seconds;
ALTER TABLE sessions DROP COLUMN timer_started_at;
ALTER TABLE sessions DROP COLUMN timer_ends_at;
