import type { DashboardStatus } from "./dashboard-ui";
import { sessionState, type Session } from "./sessions";

export const NO_SUBMIT_TIME = "???";

/** Median of a list of numbers; the mean of the two middle values for an even count; 0 for an empty list. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Seconds from timer start to first submission, one decimal ("12.3"). "???" when the timer never started
 * (or either timestamp is unusable). Never negative.
 */
export function submitTime(timerStartedAt: string | null, submittedAt: string): string {
  if (!timerStartedAt) return NO_SUBMIT_TIME;
  const secs = (Date.parse(submittedAt) - Date.parse(timerStartedAt)) / 1000;
  return Number.isFinite(secs) ? Math.max(0, secs).toFixed(1) : NO_SUBMIT_TIME;
}

type Raw = { display_name: string; created_at: string; picks: number };

/** Names only, never emails. created_at is the first submission (resubmits upsert and keep it). */
export async function getDashboardStatus(
  db: D1Database,
  session: Session,
  nowMs: number = Date.now(),
): Promise<DashboardStatus> {
  const [people, unique] = await Promise.all([
    db
      .prepare(
        `SELECT p.display_name, p.created_at, (SELECT COUNT(*) FROM picks pk WHERE pk.participant_id = p.id) AS picks
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
    submitTime: submitTime(session.timer_started_at, r.created_at),
    picks: r.picks,
  }));
  const state = sessionState(session, nowMs);
  return {
    state,
    now: nowMs,
    timerEndsAt: state === "picking" ? Date.parse(session.timer_ends_at ?? "") : null,
    participants,
    stats: {
      participants: participants.length,
      medianPicks: median(participants.map((p) => p.picks)),
      uniquePicks: unique?.n ?? 0,
    },
  };
}
