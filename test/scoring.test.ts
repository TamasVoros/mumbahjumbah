import { describe, expect, it } from "vitest";
import { scoreSession, termValue } from "../src/scoring";

// The issue's 10-participant worked example. Seven filler participants supply the pick counts;
// agenda is picked by 9 of 10 here (Cleo's listed picks omit it), which is the same 0.1 floor.
function exampleGrids() {
  const others = Array.from({ length: 7 }, (_, i) => {
    const n = i + 1;
    const picks = ["agenda"];
    if (n <= 6) picks.push("synergy");
    if (n <= 4) picks.push("roadmap", "circle back");
    if (n <= 2) picks.push("deep dive");
    return { participantId: 3 + n + 1, picks };
  });
  return [
    { participantId: 1, picks: ["agenda", "synergy", "move the needle", "paradigm shift"] }, // Ana
    { participantId: 2, picks: ["agenda", "roadmap", "circle back", "blockchain"] }, // Ben
    { participantId: 4, picks: ["synergy", "deep dive", "roadmap", "move the needle"] }, // Cleo
    ...others,
  ];
}
const jargon = [
  { term: "agenda", occurrences: 12 },
  { term: "synergy", occurrences: 6 },
  { term: "roadmap", occurrences: 9 },
  { term: "circle back", occurrences: 3 },
  { term: "blockchain", occurrences: 1 },
  { term: "move the needle", occurrences: 2 },
  { term: "deep dive", occurrences: 4 },
];

describe("scoreSession: worked example", () => {
  const grids = exampleGrids();
  const { values, scores } = scoreSession(jargon, grids);

  it("has 10 participants", () => {
    expect(grids).toHaveLength(10);
  });
  it("values each term as in the issue", () => {
    expect(Object.fromEntries(values)).toEqual({
      agenda: 4,
      synergy: 6,
      roadmap: 13,
      "circle back": 15,
      blockchain: 9,
      "move the needle": 19,
      "deep dive": 24,
      "paradigm shift": 0,
    });
  });
  it("scores Ana, Ben and Cleo", () => {
    const score = (id: number) => scores.find((s) => s.participantId === id)!.score;
    expect(score(1)).toBe(29);
    expect(score(2)).toBe(41);
    expect(score(4)).toBe(62);
  });
  it("displayed values sum exactly to the score", () => {
    for (const s of scores) expect(s.picks.reduce((n, p) => n + p.value, 0)).toBe(s.score);
  });
});

describe("termValue", () => {
  it("rarity is 1 below 4 participants and applies from 4", () => {
    expect(termValue("a", 3, 1, 3)).toBe(20); // 10 * log2(4)
    expect(termValue("a", 3, 3, 3)).toBe(20); // everyone, still no rarity at 3
    expect(termValue("a", 3, 1, 4)).toBe(15); // 20 * 0.75
  });
  it("a term picked by everyone scores the 0.1 floor, not 0", () => {
    expect(termValue("a", 3, 4, 4)).toBe(2); // 20 * 0.1
    expect(termValue("a", 12, 10, 10)).toBe(4);
  });
  it("a never-said pick is worth 0", () => {
    expect(termValue("a", 0, 1, 10)).toBe(0);
  });
  it("multi-word picks get 1.5x, single words do not", () => {
    expect(termValue("circle back", 3, 1, 3)).toBe(30);
    expect(termValue("circle", 3, 1, 3)).toBe(20);
  });
  it("rounds per term", () => {
    expect(termValue("a", 4, 1, 3)).toBe(23); // 10 * 2.3219
  });
});

describe("scoreSession edge cases", () => {
  it("counts duplicate picks within one grid once and handles empty sessions", () => {
    const r = scoreSession([{ term: "a", occurrences: 1 }], [{ participantId: 1, picks: ["a", "a"] }]);
    expect(r.scores[0]).toMatchObject({ score: 10, hits: 1 });
    expect(scoreSession([], [])).toEqual({ values: new Map(), scores: [] });
  });
});
