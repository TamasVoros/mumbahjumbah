import { extractJargon, parseVtt, tokenize, type Counted } from "./transcript";

export const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;

export type UploadResult = { ok: true; result: Counted[] } | { ok: false; error: string };

/** Union of all Picks across all Grids of a Session (distinct, as stored). */
export async function sessionPicks(db: D1Database, sessionId: number): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT pk.pick FROM picks pk JOIN participants p ON p.id = pk.participant_id WHERE p.session_id = ?`,
    )
    .bind(sessionId)
    .all<{ pick: string }>();
  return results.map((r) => r.pick);
}

export async function getJargonResult(db: D1Database, sessionId: number): Promise<Counted[]> {
  const { results } = await db
    .prepare(
      `SELECT term, occurrences FROM jargon_results WHERE session_id = ? ORDER BY occurrences DESC, term`,
    )
    .bind(sessionId)
    .all<Counted>();
  return results;
}

/** Atomically replaces the Session's Jargon Result. */
export async function replaceJargonResult(db: D1Database, sessionId: number, rows: Counted[]): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM jargon_results WHERE session_id = ?").bind(sessionId),
    ...rows.map((r) =>
      db
        .prepare("INSERT INTO jargon_results (session_id, term, occurrences) VALUES (?, ?, ?)")
        .bind(sessionId, r.term, r.occurrences),
    ),
  ]);
}

/**
 * Validates and parses an uploaded Transcript in memory, then replaces the Session's Jargon Result.
 * The file content is never written anywhere; only the derived, pick-scoped counts are stored.
 * Any failure leaves the previous Jargon Result untouched so the Organizer can retry.
 */
export async function processTranscript(db: D1Database, sessionId: number, file: unknown): Promise<UploadResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a .txt or .vtt transcript file to upload." };
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".txt") && !name.endsWith(".vtt")) {
    return { ok: false, error: "Only .txt and .vtt transcripts are supported." };
  }
  if (file.size > MAX_TRANSCRIPT_BYTES) {
    return { ok: false, error: "That file is too large (limit 5 MB)." };
  }
  let raw: string;
  try {
    raw = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(await file.arrayBuffer());
  } catch {
    return { ok: false, error: "That file is not valid UTF-8 text." };
  }
  const text = name.endsWith(".vtt") ? parseVtt(raw) : raw;
  if (tokenize(text).length === 0) {
    return { ok: false, error: "No readable text was found in that file." };
  }
  const result = extractJargon(text, await sessionPicks(db, sessionId));
  await replaceJargonResult(db, sessionId, result);
  return { ok: true, result };
}

/** How many Participants picked each distinct term (picks are stored normalized, as are Jargon Result terms). */
export async function getPickerCounts(db: D1Database, sessionId: number): Promise<Map<string, number>> {
  const { results } = await db
    .prepare(
      `SELECT pk.pick AS term, COUNT(*) AS n FROM picks pk JOIN participants p ON p.id = pk.participant_id
       WHERE p.session_id = ? GROUP BY pk.pick`,
    )
    .bind(sessionId)
    .all<{ term: string; n: number }>();
  return new Map(results.map((r) => [r.term, r.n]));
}
