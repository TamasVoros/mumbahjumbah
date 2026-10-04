import { describe, expect, it } from "vitest";
import { extractJargon, parseVtt, tokenize } from "../src/transcript";

const counts = (text: string, picks: string[]) => Object.fromEntries(extractJargon(text, picks).map((c) => [c.term, c.occurrences]));

describe("tokenize", () => {
  it("lowercases and splits on non-word characters", () => {
    expect(tokenize("Hello, World! It's 3pm.")).toEqual(["hello", "world", "it's", "3pm"]);
  });
});

describe("extractJargon", () => {
  it("matches whole tokens only", () => {
    expect(counts("He said the campaign used AI. AI, ai!", ["ai"])).toEqual({ ai: 3 });
    expect(counts("said campaign again", ["ai"])).toEqual({});
  });

  it("matches multi-word phrases as a contiguous run of whole tokens", () => {
    const text = "We must move the needle. Move the big needle? move   the\nneedle";
    expect(counts(text, ["move the needle"])).toEqual({ "move the needle": 2 });
  });

  it("does not match a phrase across a partial token", () => {
    expect(counts("remove the needle", ["move the needle"])).toEqual({});
  });

  it("filters stopwords for single-word picks only", () => {
    const text = "at the end of the day the team won";
    expect(counts(text, ["the", "at the end of the day"])).toEqual({ "at the end of the day": 1 });
  });

  it("never reports unpicked terms and omits picks that never occur", () => {
    expect(counts("synergy synergy synergy codename", ["pivot"])).toEqual({});
  });

  it("returns nothing for no picks", () => {
    expect(extractJargon("anything", [])).toEqual([]);
  });

  it("sorts by occurrences desc", () => {
    expect(extractJargon("a b b c c c", ["b", "c"]).map((c) => c.term)).toEqual(["c", "b"]);
  });
});

describe("parseVtt", () => {
  const vtt = [
    "﻿WEBVTT",
    "",
    "NOTE this is a comment about secret",
    "",
    "1",
    "00:00:01.000 --> 00:00:03.000",
    "<v Alice Smith>Let us talk about synergy.</v>",
    "",
    "cue-two",
    "00:00:03.500 --> 00:00:05.000 align:start",
    "Bob: The <c.loud>pivot</c> &amp; more",
    "<00:00:04.000>second line",
    "",
  ].join("\r\n");

  it("strips header, notes, ids, timings, tags and speaker labels", () => {
    const text = parseVtt(vtt);
    expect(text).toBe("Let us talk about synergy.\nThe pivot & more\nsecond line");
    expect(text).not.toMatch(/-->|WEBVTT|Alice|Bob|cue-two|secret/);
  });

  it("does not let timestamps become tokens", () => {
    expect(tokenize(parseVtt(vtt))).not.toContain("00");
  });
});
