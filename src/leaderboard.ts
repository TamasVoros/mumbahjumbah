import { getJargonResult } from "./jargon";
import { scoreSession, type PickValue } from "./scoring";

export type LeaderboardEntry = {
  rank: number;
  participantId: number;
  displayName: string;
  score: number;
  hits: number;
  picks: PickValue[];
};

/**
 * Ranked leaderboard for a Session, computed live from its current Jargon Result and Grids using
 * the scoring in src/scoring.ts (ADR-0005). Zero-score participants are included. Ordering:
 * score desc, then hits desc (picks present in the Jargon Result), then submission order
 * (participants.id, assigned at first submission; resubmitting keeps the row and therefore the
 * position). Ranks are positional (1..n); tied entries are not given a shared rank.
 */
export async function getLeaderboard(db: D1Database, sessionId: number): Promise<LeaderboardEntry[]> {
  const [jargon, participants, picks] = await Promise.all([
    getJargonResult(db, sessionId),
    db
      .prepare("SELECT id, display_name FROM participants WHERE session_id = ? ORDER BY id")
      .bind(sessionId)
      .all<{ id: number; display_name: string }>(),
    db
      .prepare(
        `SELECT pk.participant_id AS pid, pk.pick AS pick FROM picks pk
         JOIN participants p ON p.id = pk.participant_id WHERE p.session_id = ? ORDER BY pk.participant_id, pk.rowid`,
      )
      .bind(sessionId)
      .all<{ pid: number; pick: string }>(),
  ]);
  const byParticipant = new Map<number, string[]>();
  for (const r of picks.results) byParticipant.set(r.pid, [...(byParticipant.get(r.pid) ?? []), r.pick]);

  const { scores } = scoreSession(
    jargon,
    participants.results.map((p) => ({ participantId: p.id, picks: byParticipant.get(p.id) ?? [] })),
  );
  const names = new Map(participants.results.map((p) => [p.id, p.display_name]));
  return scores
    .sort((a, b) => b.score - a.score || b.hits - a.hits || a.participantId - b.participantId)
    .map((s, i) => ({ rank: i + 1, displayName: names.get(s.participantId)!, ...s }));
}
