export const SEED_OPERATOR_ID = 1;

export type Session = {
  id: number;
  operator_id: number;
  pick_count: number;
  organizer_link_token: string;
  invite_link_token: string;
  name: string | null;
  timer_seconds: number | null;
  timer_started_at: string | null;
  timer_ends_at: string | null;
  locked_at: string | null;
  created_at: string;
};

/** 256 bits of randomness, base64url. Each call is independent of any other token. */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const MAX_PICK_COUNT = 100;

/** Parses a whole number from 1 to MAX_PICK_COUNT (no square-grid constraint). Returns null if invalid. */
export function parsePickCount(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n >= 1 && n <= MAX_PICK_COUNT ? n : null;
}

export const MAX_NAME_LENGTH = 80;

/** Trims and validates a Session Name (1-80 chars after trimming). Returns null if invalid. */
export function parseSessionName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name.length >= 1 && name.length <= MAX_NAME_LENGTH ? name : null;
}

export const MIN_TIMER_SECONDS = 30;
export const MAX_TIMER_SECONDS = 60;
export const DEFAULT_TIMER_SECONDS = 30;

/** Parses a whole number of seconds from 30 to 60. Returns null if invalid. */
export function parseTimerSeconds(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n >= MIN_TIMER_SECONDS && n <= MAX_TIMER_SECONDS ? n : null;
}

/**
 * Where a Session is in its life: setup (no name, link closed), open (named, timer not started),
 * picking (timer running), locked (Organizer lock or timer end, the same state).
 */
export type SessionState = "setup" | "open" | "picking" | "locked";

/** Judged at `nowMs`: a timer whose end has passed counts as locked even if the lazy persist hasn't happened yet. */
export function sessionState(s: Session, nowMs: number = Date.now()): SessionState {
  if (s.locked_at) return "locked";
  if (s.timer_ends_at) return nowMs >= Date.parse(s.timer_ends_at) ? "locked" : "picking";
  return s.name === null ? "setup" : "open";
}

/**
 * Lazy expiry, run on every lookup: a Session whose timer has ended is persisted as locked
 * with locked_at = timer_ends_at. No cron or Durable Object involved.
 */
async function settle(db: D1Database, s: Session | null, nowMs: number): Promise<Session | null> {
  if (!s || s.locked_at || !s.timer_ends_at || nowMs < Date.parse(s.timer_ends_at)) return s;
  const updated = await db
    .prepare("UPDATE sessions SET locked_at = timer_ends_at WHERE id = ? AND locked_at IS NULL RETURNING *")
    .bind(s.id)
    .first<Session>();
  return updated ?? (await db.prepare("SELECT * FROM sessions WHERE id = ?").bind(s.id).first<Session>());
}

/**
 * Starts the pick timer via the Organizer token. Only a named, unlocked Session whose timer has not started
 * qualifies (fixed once started, no pause/extend). Null if any of that fails.
 */
export function startTimer(db: D1Database, organizerToken: string, seconds: number, nowMs: number = Date.now()) {
  const start = new Date(nowMs).toISOString();
  const end = new Date(nowMs + seconds * 1000).toISOString();
  return db
    .prepare(
      `UPDATE sessions SET timer_seconds = ?, timer_started_at = ?, timer_ends_at = ?
       WHERE organizer_link_token = ? AND name IS NOT NULL AND locked_at IS NULL AND timer_started_at IS NULL
       RETURNING *`,
    )
    .bind(seconds, start, end, organizerToken)
    .first<Session>();
}

/** Sets the Session Name via the Organizer token, only before the timer starts. Null for an unknown token or a started/locked Session. */
export function renameSession(db: D1Database, organizerToken: string, name: string) {
  return db
    .prepare(
      "UPDATE sessions SET name = ? WHERE organizer_link_token = ? AND locked_at IS NULL AND timer_started_at IS NULL RETURNING *",
    )
    .bind(name, organizerToken)
    .first<Session>();
}

/** New sessions start without a name (Invite Link closed); `name` is for callers that already have one. */
export async function createSession(
  db: D1Database,
  pickCount: number,
  operatorId: number = SEED_OPERATOR_ID,
  name: string | null = null,
): Promise<Session> {
  const session = await db
    .prepare(
      `INSERT INTO sessions (operator_id, pick_count, organizer_link_token, invite_link_token, name)
       VALUES (?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(operatorId, pickCount, generateToken(), generateToken(), name)
    .first<Session>();
  if (!session) throw new Error("failed to create session");
  return session;
}

export async function findByInviteToken(db: D1Database, token: string, nowMs: number = Date.now()) {
  const s = await db.prepare("SELECT * FROM sessions WHERE invite_link_token = ?").bind(token).first<Session>();
  return settle(db, s, nowMs);
}

export async function findByOrganizerToken(db: D1Database, token: string, nowMs: number = Date.now()) {
  const s = await db.prepare("SELECT * FROM sessions WHERE organizer_link_token = ?").bind(token).first<Session>();
  return settle(db, s, nowMs);
}

export async function countParticipants(db: D1Database, sessionId: number): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM participants WHERE session_id = ?")
    .bind(sessionId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Lock & Start Session!: works before the timer starts, while it runs (the timer stops, the Session locks) and
 * after it ended. Idempotent: the first lock timestamp is kept (an expired timer locks at its end).
 * Returns the session, or null for an unknown Organizer token.
 */
export async function lockSession(db: D1Database, organizerToken: string, nowMs: number = Date.now()) {
  const s = await findByOrganizerToken(db, organizerToken, nowMs);
  if (!s || s.locked_at) return s;
  const locked = await db
    .prepare("UPDATE sessions SET locked_at = ? WHERE id = ? AND locked_at IS NULL RETURNING *")
    .bind(new Date(nowMs).toISOString(), s.id)
    .first<Session>();
  return locked ?? (await db.prepare("SELECT * FROM sessions WHERE id = ?").bind(s.id).first<Session>());
}

export type ParticipantRow = { display_name: string; updated_at: string };

/** Names only (never emails), oldest first, for the Organizer's participant list. */
export async function listParticipants(db: D1Database, sessionId: number): Promise<ParticipantRow[]> {
  const { results } = await db
    .prepare("SELECT display_name, updated_at FROM participants WHERE session_id = ? ORDER BY created_at, id")
    .bind(sessionId)
    .all<ParticipantRow>();
  return results;
}
