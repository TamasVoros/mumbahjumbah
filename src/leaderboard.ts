export type LeaderboardEntry = {
  rank: number;
  participantId: number;
  displayName: string;
  score: number;
};

/**
 * Ranked leaderboard for a Session, computed live from its current Jargon Result.
 * Score = sum of occurrences of each distinct Pick present in the Jargon Result (picks are a set,
 * so no double counting). Zero-score participants are included. Ordering: score desc, then
 * submission order (participants.id, assigned at first submission; resubmitting keeps the row and
 * therefore the position). Ranks are positional (1..n); tied scores are not given a shared rank.
 */
export async function getLeaderboard(db: D1Database, sessionId: number): Promise<LeaderboardEntry[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id AS id, p.display_name AS display_name, COALESCE(SUM(j.occurrences), 0) AS score
       FROM participants p
       LEFT JOIN picks pk ON pk.participant_id = p.id
       LEFT JOIN jargon_results j ON j.session_id = p.session_id AND j.term = pk.pick
       WHERE p.session_id = ?
       GROUP BY p.id
       ORDER BY score DESC, p.id ASC`,
    )
    .bind(sessionId)
    .all<{ id: number; display_name: string; score: number }>();
  return results.map((r, i) => ({ rank: i + 1, participantId: r.id, displayName: r.display_name, score: r.score }));
}
