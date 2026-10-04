import satori, { init as initSatori } from "satori/standalone";
import yogaWasm from "satori/yoga.wasm";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import interRegular from "./fonts/inter-400.woff";
import interBold from "./fonts/inter-700.woff";
import type { LeaderboardEntry } from "./leaderboard";
import type { Counted } from "./transcript";

export const RECAP_WIDTH = 1200;
export const RECAP_HEIGHT = 630;
const MAX_BOARD_ROWS = 6;
const MAX_TERMS = 7;

let wasmReady: Promise<void> | undefined;
// Workers forbid compiling wasm from bytes at runtime, so both engines get precompiled modules.
const ensureWasm = () =>
  (wasmReady ??= Promise.all([initWasm(resvgWasm), initSatori(yogaWasm)]).then(() => undefined));

const BRAND = "#6d28d9";
const INK = "#1f2937";
const MUTED = "#6b7280";

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children },
});

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Recap Card layout. Inputs are the leaderboard and the Jargon Result only; the top-terms
 * strip is the Jargon Result (already scoped to picked terms), ranked by occurrences desc.
 * Only display names are drawn, never emails.
 */
export function recapLayout(board: LeaderboardEntry[], jargon: Counted[]): Node {
  const terms = [...jargon].sort((a, b) => b.occurrences - a.occurrences || a.term.localeCompare(b.term)).slice(0, MAX_TERMS);
  const rows = board.slice(0, MAX_BOARD_ROWS);
  const more = board.length - rows.length;

  const boardCol = el("div", { flexDirection: "column", flex: 1, marginRight: 40 }, [
    el("div", { fontSize: 32, fontWeight: 700, color: BRAND, marginBottom: 18 }, "Leaderboard"),
    ...(rows.length === 0
      ? [el("div", { fontSize: 30, color: MUTED }, "No Grids were submitted.")]
      : rows.map((e) =>
          el("div", { alignItems: "center", fontSize: 36, color: INK, marginBottom: 14 }, [
            el("div", { width: 80, fontWeight: 700, color: e.rank === 1 ? BRAND : MUTED }, `#${e.rank}`),
            el("div", { flex: 1 }, truncate(e.displayName, 22)),
            el("div", { fontWeight: 700 }, String(e.score)),
          ]),
        )),
    ...(more > 0 ? [el("div", { fontSize: 20, color: MUTED }, `+ ${more} more`)] : []),
  ]);

  const termsCol = el("div", { flexDirection: "column", width: 440 }, [
    el("div", { fontSize: 32, fontWeight: 700, color: BRAND, marginBottom: 18 }, "Top terms"),
    ...(terms.length === 0
      ? [el("div", { fontSize: 30, color: MUTED }, "No picks matched the transcript.")]
      : terms.map((t) =>
          el("div", { alignItems: "center", fontSize: 34, color: INK, marginBottom: 14 }, [
            el("div", { flex: 1 }, truncate(t.term, 20)),
            el("div", { fontWeight: 700, color: BRAND }, `x${t.occurrences}`),
          ]),
        )),
  ]);

  return el(
    "div",
    {
      flexDirection: "column",
      width: RECAP_WIDTH,
      height: RECAP_HEIGHT,
      padding: 48,
      backgroundColor: "#f5f3ff",
      fontFamily: "Inter",
    },
    [
      el("div", { alignItems: "baseline", marginBottom: 28 }, [
        el("div", { fontSize: 52, fontWeight: 700, color: BRAND }, "MumbahJumbah"),
        el("div", { fontSize: 26, color: MUTED, marginLeft: 20 }, "Recap Card"),
      ]),
      el("div", { flex: 1 }, [boardCol, termsCol]),
      el("div", { fontSize: 22, color: MUTED }, "Reverse Bingo: predict the jargon, then hear it."),
    ],
  );
}

export async function renderRecapPng(board: LeaderboardEntry[], jargon: Counted[]): Promise<Uint8Array> {
  await ensureWasm();
  const svg = await satori(recapLayout(board, jargon) as never, {
    width: RECAP_WIDTH,
    height: RECAP_HEIGHT,
    fonts: [
      { name: "Inter", data: interRegular, weight: 400, style: "normal" },
      { name: "Inter", data: interBold, weight: 700, style: "normal" },
    ],
  });
  const resvg = new Resvg(svg);
  try {
    return resvg.render().asPng();
  } finally {
    resvg.free();
  }
}
