import { createSession as create } from "../src/sessions";

/**
 * Creates a Session that already has a name and a running pick timer (an hour long, so it never expires
 * mid-test), i.e. one whose Invite Link shows the pick form. Use `createWaitingSession` for the pre-timer state.
 */
export const createSession = async (db: D1Database, pickCount: number, name = "Test session") => {
  const s = await create(db, pickCount, undefined, name);
  const now = Date.now();
  return (await db
    .prepare("UPDATE sessions SET timer_seconds = 60, timer_started_at = ?, timer_ends_at = ? WHERE id = ? RETURNING *")
    .bind(new Date(now).toISOString(), new Date(now + 3_600_000).toISOString(), s.id)
    .first<typeof s>())!;
};

/** A named Session whose timer has not been started (participants wait). */
export const createWaitingSession = (db: D1Database, pickCount: number, name = "Test session") =>
  create(db, pickCount, undefined, name);
