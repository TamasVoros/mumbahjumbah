import { createSession as create } from "../src/sessions";

/** Creates a named, unlocked Session: open, so its Invite Link shows the pick form. */
export const createSession = (db: D1Database, pickCount: number, name = "Test session") =>
  create(db, pickCount, undefined, name);
