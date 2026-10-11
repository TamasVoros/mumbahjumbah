import { createSession as create } from "../src/sessions";

/** Creates a Session that already has a name, i.e. one whose Invite Link is open. */
export const createSession = (db: D1Database, pickCount: number, name = "Test session") =>
  create(db, pickCount, undefined, name);
