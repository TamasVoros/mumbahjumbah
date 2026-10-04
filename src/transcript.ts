/**
 * Pure transcript logic: VTT stripping, tokenizing, and boundary-aware matching.
 * Nothing here touches storage; the raw transcript lives only in these function calls.
 */

/** Common English function words. Applied to single-word Picks only (never to phrases). */
export const STOPWORDS: ReadonlySet<string> = new Set(
  (
    "a about above after again all also am an and any are as at be because been before being below between both but by " +
    "can could did do does doing down during each few for from further had has have having he her here hers him his how " +
    "i if in into is it its just me more most my no nor not of off on once only or other our out over own same she should " +
    "so some such than that the their them then there these they this those through to too under until up very was we were " +
    "what when where which while who whom why will with would you your yours"
  ).split(" "),
);

const TOKEN_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** Lowercased runs of letters/digits (inner apostrophes kept). Everything else is a boundary. */
export function tokenize(text: string): string[] {
  return (text.normalize("NFC").toLowerCase().match(TOKEN_RE) ?? []).map((t) => t.replace(/’/g, "'"));
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " ", "&quot;": '"' };
const SPEAKER_LABEL_RE = /^[\p{Lu}][\p{L}.'-]*(?: [\p{Lu}][\p{L}.'-]*){0,3}:\s+/u;

/** Strips WebVTT structure (header, NOTE/STYLE/REGION blocks, cue ids, timings, tags, speaker labels) to plain text. */
export function parseVtt(raw: string): string {
  const blocks = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split(/\n{2,}/);
  const out: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const timing = lines.findIndex((l) => l.includes("-->"));
    if (timing === -1) continue; // header, NOTE, STYLE, REGION, or stray text without a cue timing
    for (const line of lines.slice(timing + 1)) {
      const text = line
        .replace(/<[^>]*>/g, "")
        .replace(/&(?:amp|lt|gt|nbsp|quot);/g, (e) => ENTITIES[e]!)
        .replace(SPEAKER_LABEL_RE, "")
        .trim();
      if (text) out.push(text);
    }
  }
  return out.join("\n");
}

export type Counted = { term: string; occurrences: number };

/**
 * Counts occurrences of each distinct pick in the text. Single words match whole tokens;
 * phrases match a contiguous run of whole tokens. Single-word stopword picks are dropped.
 * Only picks that occur at least once are returned (sorted by count desc, then term).
 */
export function extractJargon(text: string, picks: Iterable<string>): Counted[] {
  const byKey = new Map<string, string[]>(); // token-sequence key -> picks that normalize to it
  const lengths = new Set<number>();
  for (const pick of new Set(picks)) {
    const tokens = tokenize(pick);
    if (tokens.length === 0) continue;
    if (tokens.length === 1 && STOPWORDS.has(tokens[0]!)) continue;
    const key = tokens.join(" ");
    byKey.set(key, [...(byKey.get(key) ?? []), pick]);
    lengths.add(tokens.length);
  }
  const counts = new Map<string, number>();
  if (byKey.size > 0) {
    const tokens = tokenize(text);
    for (const n of lengths) {
      for (let i = 0; i + n <= tokens.length; i++) {
        const key = n === 1 ? tokens[i]! : tokens.slice(i, i + n).join(" ");
        if (byKey.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const result: Counted[] = [];
  for (const [key, n] of counts) for (const term of byKey.get(key)!) result.push({ term, occurrences: n });
  return result.sort((a, b) => b.occurrences - a.occurrences || a.term.localeCompare(b.term));
}
