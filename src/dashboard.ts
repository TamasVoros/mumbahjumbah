import type { DashboardStatus } from "./dashboard-ui";
import { sessionState, type Session } from "./sessions";

/** Median of a list of numbers; the mean of the two middle values for an even count; 0 for an empty list. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

type Raw = { display_name: string; picks: number };

/** Names only, never emails. */
export async function getDashboardStatus(
  db: D1Database,
  session: Session,
): Promise<DashboardStatus> {
  const [people, unique] = await Promise.all([
    db
      .prepare(
        `SELECT p.display_name, (SELECT COUNT(*) FROM picks pk WHERE pk.participant_id = p.id) AS picks
         FROM participants p WHERE p.session_id = ? ORDER BY p.created_at, p.id`,
      )
      .bind(session.id)
      .all<Raw>(),
    db
      .prepare(
        `SELECT COUNT(DISTINCT pk.pick) AS n FROM picks pk JOIN participants p ON p.id = pk.participant_id WHERE p.session_id = ?`,
      )
      .bind(session.id)
      .first<{ n: number }>(),
  ]);
  const participants = people.results.map((r) => ({
    name: r.display_name,
    picks: r.picks,
  }));
  const state = sessionState(session);
  return {
    state,
    participants,
    stats: {
      participants: participants.length,
      medianPicks: median(participants.map((p) => p.picks)),
      uniquePicks: unique?.n ?? 0,
    },
  };
}
