export const SEED_OPERATOR_ID = 1;

export type Session = {
  id: number;
  operator_id: number;
  pick_count: number;
  organizer_link_token: string;
  invite_link_token: string;
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

/** Parses a positive integer (no square-grid constraint). Returns null if invalid. */
export function parsePickCount(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function createSession(
  db: D1Database,
  pickCount: number,
  operatorId: number = SEED_OPERATOR_ID,
): Promise<Session> {
  const session = await db
    .prepare(
      `INSERT INTO sessions (operator_id, pick_count, organizer_link_token, invite_link_token)
       VALUES (?, ?, ?, ?) RETURNING *`,
    )
    .bind(operatorId, pickCount, generateToken(), generateToken())
    .first<Session>();
  if (!session) throw new Error("failed to create session");
  return session;
}

export function findByInviteToken(db: D1Database, token: string) {
  return db.prepare("SELECT * FROM sessions WHERE invite_link_token = ?").bind(token).first<Session>();
}

export function findByOrganizerToken(db: D1Database, token: string) {
  return db.prepare("SELECT * FROM sessions WHERE organizer_link_token = ?").bind(token).first<Session>();
}

export async function countParticipants(db: D1Database, sessionId: number): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM participants WHERE session_id = ?")
    .bind(sessionId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Idempotent: the first lock timestamp is kept. Returns the session, or null for an unknown Organizer token. */
export function lockSession(db: D1Database, organizerToken: string) {
  return db
    .prepare(
      `UPDATE sessions SET locked_at = COALESCE(locked_at, datetime('now'))
       WHERE organizer_link_token = ? RETURNING *`,
    )
    .bind(organizerToken)
    .first<Session>();
}
