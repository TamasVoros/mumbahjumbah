import satori, { init as initSatori } from "satori/standalone";
import yogaWasm from "satori/yoga.wasm";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import archivo400 from "./fonts/archivo-latin-400-normal.woff";
import archivo800 from "./fonts/archivo-latin-800-normal.woff";
import anton from "./fonts/anton-latin-400-normal.woff";
import jetbrainsMono from "./fonts/jetbrains-mono-latin-400-normal.woff";
import type { LeaderboardEntry } from "./leaderboard";
import type { Counted } from "./transcript";

export const RECAP_WIDTH = 1200;
export const RECAP_HEIGHT = 630;
const PODIUM_ROWS = 3;

let wasmReady: Promise<void> | undefined;
// Workers forbid compiling wasm from bytes at runtime, so both engines get precompiled modules.
const ensureWasm = () =>
  (wasmReady ??= Promise.all([initWasm(resvgWasm), initSatori(yogaWasm)]).then(() => undefined));

// DESIGN.md palette.
const INDIGO = "#1F2F63";
const NIGHT = "#172352";
const INDIGO_LINE = "#3C4E8A";
const BONE = "#F4EFE6";
const INK = "#17140F";
const RED = "#D2432C";
const RAFFIA = "#E3C26E";

const SANS = "Archivo";
const NUMERAL = "Anton";
const MONO = "JetBrains Mono";

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children },
});

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// Logo mark from DESIGN.md §5 (64x84 viewBox), bone on indigo.
const LOGO_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 84" width="44" height="58">` +
  `<path d="M32 2C14 2 6 16 6 38c0 24 10 44 26 44s26-20 26-44C58 16 50 2 32 2Z" fill="${BONE}"/>` +
  `<path d="M12 24L32 12L52 24" fill="none" stroke="${INDIGO}" stroke-width="5"/>` +
  `<path d="M13 40L28 36L22 48Z" fill="${INDIGO}"/>` +
  `<path d="M51 40L36 36L42 48Z" fill="${INDIGO}"/>` +
  `<path d="M32 54L38 64L32 76L26 64Z" fill="${INDIGO}"/></svg>`;

// Zigzag from DESIGN.md §5 (16px tile, 2.5px red stroke) at 2x scale, drawn as one full-width path.
function zigzagSvg(width: number): string {
  let d = "M0 24";
  for (let x = 0; x < width; x += 32) d += `L${x + 16} 8L${x + 32} 24`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="32"><path d="${d}" fill="none" stroke="${RED}" stroke-width="5"/></svg>`;
}

const dataUri = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;
const img = (src: string, width: number, height: number, style: Record<string, unknown> = {}): Node => ({
  type: "img",
  props: { src, width, height, style },
});

/**
 * Recap Card layout (mockup 5A at 2x). Inputs are the leaderboard and the Jargon Result only;
 * the most-said word is the Jargon Result (already scoped to picked terms). Only display names
 * are drawn, never emails.
 */
export function recapLayout(board: LeaderboardEntry[], jargon: Counted[]): Node {
  const top = [...jargon].sort((a, b) => b.occurrences - a.occurrences || a.term.localeCompare(b.term))[0];
  const podium = board.slice(0, PODIUM_ROWS);
  const winner = podium[0];

  const headline = winner ? `${truncate(winner.displayName, 16)} called it.` : "No Grids, no winner.";
  const stat = top
    ? [
        `${winner ? `${winner.score} points. ` : ""}Most-said word:`,
        // NBSP: satori trims a plain trailing space before an inline element.
        el("b", { fontWeight: 800 }, ` “${truncate(top.term, 24)}”`),
        `, ${top.occurrences} ${top.occurrences === 1 ? "time" : "times"}.`,
      ]
    : [winner ? `${winner.score} points. ` : "", "No picks matched the transcript."];

  const rows = podium.map((e, i) =>
    i === 0
      ? el(
          "div",
          { alignItems: "center", backgroundColor: RAFFIA, color: INK, padding: "20px 28px", borderRadius: 4, marginBottom: 16 },
          [
            el("div", { fontFamily: NUMERAL, fontSize: 68, lineHeight: 1, marginRight: 24 }, String(e.rank)),
            el("div", { flex: 1, fontWeight: 800, fontSize: 32 }, truncate(e.displayName, 10)),
            el("div", { fontFamily: NUMERAL, fontSize: 60, lineHeight: 1 }, String(e.score)),
          ],
        )
      : el(
          "div",
          { alignItems: "center", backgroundColor: NIGHT, border: `3px solid ${INDIGO_LINE}`, color: BONE, padding: "16px 28px", borderRadius: 4, marginBottom: 16 },
          [
            el("div", { fontFamily: NUMERAL, fontSize: 44, lineHeight: 1, color: RAFFIA, marginRight: 24 }, String(e.rank)),
            el("div", { flex: 1, fontWeight: 800, fontSize: 28 }, truncate(e.displayName, 12)),
            el("div", { fontFamily: NUMERAL, fontSize: 40, lineHeight: 1 }, String(e.score)),
          ],
        ),
  );

  const players = board.length;
  const eyebrow = `${players} ${players === 1 ? "PLAYER" : "PLAYERS"}`;

  return el(
    "div",
    {
      position: "relative",
      width: RECAP_WIDTH,
      height: RECAP_HEIGHT,
      backgroundColor: INDIGO,
      color: BONE,
      fontFamily: SANS,
    },
    [
      el("div", { position: "absolute", left: 72, top: 60, alignItems: "center" }, [
        img(dataUri(LOGO_SVG), 44, 58),
        el("div", { fontWeight: 800, fontSize: 36, marginLeft: 20 }, "MumbahJumbah"),
      ]),
      el("div", { position: "absolute", left: 72, top: 184, flexDirection: "column" }, [
        el("div", { fontFamily: MONO, fontSize: 24, letterSpacing: 2, color: RAFFIA, marginBottom: 12 }, eyebrow),
        el("div", { fontWeight: 800, fontSize: 68, lineHeight: 1.05, width: 600, marginBottom: 12 }, headline),
        el("div", { fontSize: 28, lineHeight: 1.4, width: 580, opacity: 0.9, flexWrap: "wrap" }, stat),
      ]),
      el("div", { position: "absolute", right: 72, top: 60, width: 400, flexDirection: "column" }, rows),
      img(dataUri(zigzagSvg(RECAP_WIDTH)), RECAP_WIDTH, 32, { position: "absolute", left: 0, top: 510 }),
      el(
        "div",
        {
          position: "absolute",
          left: 72,
          right: 72,
          bottom: 28,
          justifyContent: "space-between",
          fontFamily: MONO,
          fontSize: 22,
          letterSpacing: 1.5,
          opacity: 0.85,
        },
        [el("div", {}, "PREDICT THE JARGON. WIN THE MEETING."), el("div", {}, "MUMBAHJUMBAH.COM")],
      ),
    ],
  );
}

export async function renderRecapPng(board: LeaderboardEntry[], jargon: Counted[]): Promise<Uint8Array> {
  await ensureWasm();
  const svg = await satori(recapLayout(board, jargon) as never, {
    width: RECAP_WIDTH,
    height: RECAP_HEIGHT,
    fonts: [
      { name: "Archivo", data: archivo400, weight: 400, style: "normal" },
      { name: "Archivo", data: archivo800, weight: 800, style: "normal" },
      { name: "Anton", data: anton, weight: 400, style: "normal" },
      { name: "JetBrains Mono", data: jetbrainsMono, weight: 400, style: "normal" },
    ],
  });
  const resvg = new Resvg(svg);
  try {
    return resvg.render().asPng();
  } finally {
    resvg.free();
  }
}
