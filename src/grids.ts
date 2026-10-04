/** Lowercase, trim, and collapse inner whitespace. Multi-word phrases are kept whole. */
export function normalizePick(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type GridInput = { email: string; displayName: string; picks: string[] };

export type GridResult = { ok: true; value: GridInput } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates a raw submission against a Session's Pick Count. Duplicates are rejected, never deduped. */
export function validateGrid(
  raw: { email?: unknown; display_name?: unknown; pick?: unknown },
  pickCount: number,
): GridResult {
  const email = typeof raw.email === "string" ? normalizeEmail(raw.email) : "";
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };

  const displayName = typeof raw.display_name === "string" ? raw.display_name.trim() : "";
  if (!displayName) return { ok: false, error: "Enter a display name." };

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
  const seen = new Set<string>();
  for (const p of picks) {
    if (seen.has(p)) return { ok: false, error: `Duplicate pick: "${p}". Every pick must be different.` };
    seen.add(p);
  }
  return { ok: true, value: { email, displayName, picks } };
}

/** Upserts the Participant for (session, email) and replaces their Grid, atomically. */
export async function saveGrid(db: D1Database, sessionId: number, grid: GridInput): Promise<number> {
  const participant = await db
    .prepare(
      `INSERT INTO participants (session_id, email, display_name) VALUES (?, ?, ?)
       ON CONFLICT (session_id, email) DO UPDATE SET
         display_name = excluded.display_name,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       RETURNING id`,
    )
    .bind(sessionId, grid.email, grid.displayName)
    .first<{ id: number }>();
  if (!participant) throw new Error("failed to save participant");
  await db.batch([
    db.prepare("DELETE FROM picks WHERE participant_id = ?").bind(participant.id),
    ...grid.picks.map((p) =>
      db.prepare("INSERT INTO picks (participant_id, pick) VALUES (?, ?)").bind(participant.id, p),
    ),
  ]);
  return participant.id;
}
