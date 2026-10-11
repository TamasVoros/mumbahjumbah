-- Session name (nullable). NULL means "not open yet": the Invite Link stays closed until the Organizer saves a name.
ALTER TABLE sessions ADD COLUMN name TEXT;

-- Grandfather existing sessions: they already have shared Invite Links, so they stay open under a default name.
UPDATE sessions SET name = 'Untitled session';
