/** Lowercase, trim, and collapse inner whitespace. Multi-word phrases are kept whole. */
export function normalizePick(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type GridInput = { email: string; displayName: string; picks: string[] };

export type GridResult = { ok: true; value: GridInput } | { ok: false; error: string };

export const MAX_EMAIL_LENGTH = 254;
export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_PICK_LENGTH = 60;
export const MAX_PICK_WORDS = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates a raw submission against a Session's Pick Count. Duplicates are rejected, never deduped. */
export function validateGrid(
  raw: { email?: unknown; display_name?: unknown; pick?: unknown },
  pickCount: number,
): GridResult {
  const email = typeof raw.email === "string" ? normalizeEmail(raw.email) : "";
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };

  const displayName = typeof raw.display_name === "string" ? raw.display_name.trim() : "";
  if (!displayName) return { ok: false, error: "Enter a display name." };
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return { ok: false, error: `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.` };
  }

  const rawPicks = (Array.isArray(raw.pick) ? raw.pick : raw.pick === undefined ? [] : [raw.pick]).filter(
    (p): p is string => typeof p === "string",
  );
  const picks = rawPicks.map(normalizePick).filter((p) => p !== "");

  if (picks.length !== pickCount) {
    return {
      ok: false,
      error: `Submit exactly ${pickCount} picks (you submitted ${picks.length}).`,
    };
  }
  for (const p of picks) {
    if (p.length > MAX_PICK_LENGTH || p.split(" ").length > MAX_PICK_WORDS) {
      return {
        ok: false,
        error: `Each pick must be at most ${MAX_PICK_WORDS} words and ${MAX_PICK_LENGTH} characters.`,
      };
    }
  }
  const seen = new Set<string>();
  for (const p of picks) {
    if (seen.has(p)) return { ok: false, error: `Duplicate pick: "${p}". Every pick must be different.` };
    seen.add(p);
  }
  return { ok: true, value: { email, displayName, picks } };
}

/**
 * Upserts the Participant for (session, email) and replaces their Grid in one atomic batch. Every statement
 * re-checks that the Session is still unlocked, so a submission racing a lock cannot land after it.
 * Returns false (nothing written) if the Session is locked.
 */
export async function saveGrid(db: D1Database, sessionId: number, grid: GridInput): Promise<boolean> {
  const open = "EXISTS (SELECT 1 FROM sessions WHERE id = ? AND locked_at IS NULL)";
  const [upsert] = await db.batch<{ id: number }>([
    db
      .prepare(
        `INSERT INTO participants (session_id, email, display_name) SELECT ?, ?, ? WHERE ${open}
         ON CONFLICT (session_id, email) DO UPDATE SET
           display_name = excluded.display_name,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         RETURNING id`,
      )
      .bind(sessionId, grid.email, grid.displayName, sessionId),
    db
      .prepare(
        `DELETE FROM picks WHERE ${open}
           AND participant_id = (SELECT id FROM participants WHERE session_id = ? AND email = ?)`,
      )
      .bind(sessionId, sessionId, grid.email),
    ...grid.picks.map((p) =>
      db
        .prepare(
          `INSERT INTO picks (participant_id, pick)
           SELECT id, ? FROM participants WHERE session_id = ? AND email = ? AND ${open}`,
        )
        .bind(p, sessionId, grid.email, sessionId),
    ),
  ]);
  return (upsert?.results.length ?? 0) > 0;
}
