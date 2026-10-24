import type { Counted } from "./transcript";

export const MIN_PARTICIPANTS_FOR_RARITY = 4;
export const RARITY_FLOOR = 0.1;
export const PHRASE_MULTIPLIER = 1.5;
export const VALUE_SCALE = 10;

export type ScoringGrid = { participantId: number; picks: string[] };
export type PickValue = { term: string; occurrences: number; value: number };
export type ParticipantScore = { participantId: number; score: number; hits: number; picks: PickValue[] };

const isPhrase = (term: string) => term.trim().split(/\s+/).length >= 2;

/**
 * Value of one term, the same for everyone who picked it (ADR-0005):
 * round(10 * log2(1 + occurrences) * phrase * rarity). A term absent from the Jargon Result
 * (0 occurrences) is worth 0.
 */
export function termValue(term: string, occurrences: number, pickCount: number, participants: number): number {
  if (occurrences <= 0) return 0;
  const share = participants > 0 ? pickCount / participants : 0;
  const rarity = participants < MIN_PARTICIPANTS_FOR_RARITY ? 1 : Math.max(1 - share, RARITY_FLOOR);
  return Math.round(VALUE_SCALE * Math.log2(1 + occurrences) * (isPhrase(term) ? PHRASE_MULTIPLIER : 1) * rarity);
}

/**
 * Pure scoring: Jargon Result occurrences + every Grid in the Session in, per-term values and
 * per-participant scores out. Values are rounded per term before summing, so the values shown
 * next to a participant's picks add up exactly to their score. Output follows the input grid order.
 */
export function scoreSession(jargon: Counted[], grids: ScoringGrid[]) {
  const occurrences = new Map(jargon.map((j) => [j.term, j.occurrences]));
  const pickCounts = new Map<string, number>();
  for (const g of grids) for (const p of new Set(g.picks)) pickCounts.set(p, (pickCounts.get(p) ?? 0) + 1);

  const values = new Map<string, number>();
  for (const [term, n] of pickCounts) values.set(term, termValue(term, occurrences.get(term) ?? 0, n, grids.length));

  const scores: ParticipantScore[] = grids.map((g) => {
    const picks = [...new Set(g.picks)].map((term) => ({
      term,
      occurrences: occurrences.get(term) ?? 0,
      value: values.get(term) ?? 0,
    }));
    return {
      participantId: g.participantId,
      score: picks.reduce((s, p) => s + p.value, 0),
      hits: picks.filter((p) => p.occurrences > 0).length,
      picks,
    };
  });
  return { values, scores };
}
