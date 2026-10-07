import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { recapLayout, renderRecapPng } from "../src/recap";
import { createSession } from "../src/sessions";

function submit(token: string, email: string, name: string, picks: string[]) {
  const body = new URLSearchParams();
  body.set("email", email);
  body.set("display_name", name);
  for (const p of picks) body.append("pick", p);
  return SELF.fetch(`https://example.com/i/${token}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}
const lock = (t: string) => SELF.fetch(`https://example.com/o/${t}/lock`, { method: "POST" });
function upload(t: string, content: string) {
  const form = new FormData();
  form.set("transcript", new File([content], "t.txt"));
  return SELF.fetch(`https://example.com/o/${t}/transcript`, { method: "POST", body: form });
}
const isPng = (b: Uint8Array) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v);

const text = (n: unknown): string =>
  typeof n === "string" ? n : Array.isArray(n) ? n.map(text).join(" ") : n && typeof n === "object" ? text((n as { props: { children?: unknown } }).props.children) : "";

describe("renderRecapPng", () => {
  it("renders a PNG for a known fixture without throwing", async () => {
    const png = await renderRecapPng(
      [
        { rank: 1, participantId: 1, displayName: "Bold", score: 5 },
        { rank: 2, participantId: 2, displayName: "Zero", score: 0 },
      ],
      [{ term: "synergy", occurrences: 3 }, { term: "ai", occurrences: 2 }],
    );
    expect(isPng(png)).toBe(true);
    expect(png.length).toBeGreaterThan(1000);
  });

  it("renders a PNG for the empty case", async () => {
    expect(isPng(await renderRecapPng([], []))).toBe(true);
  });
});

const be32 = (b: Uint8Array, o: number) => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;

describe("recap PNG dimensions", () => {
  it("is 1200x630", async () => {
    const png = await renderRecapPng(
      [{ rank: 1, participantId: 1, displayName: "Marcus", score: 58 }],
      [{ term: "synergy", occurrences: 7 }],
    );
    expect(be32(png, 16)).toBe(1200);
    expect(be32(png, 20)).toBe(630);
  });
});

describe("recapLayout", () => {
  const board = [
    { rank: 1, participantId: 1, displayName: "Marcus", score: 58 },
    { rank: 2, participantId: 2, displayName: "Priya", score: 41 },
    { rank: 3, participantId: 3, displayName: "Jo", score: 33 },
    { rank: 4, participantId: 4, displayName: "Fourth", score: 1 },
  ];

  it("shows headline, stat line with the most-said word, and only the top 3", () => {
    const t = text(recapLayout(board, [{ term: "a", occurrences: 1 }, { term: "synergy", occurrences: 7 }]));
    expect(t).toContain("Marcus called it.");
    expect(t).toContain("58 points.");
    expect(t).toContain("“synergy”");
    expect(t).toContain("7 times");
    expect(t).toContain("Priya");
    expect(t).toContain("Jo");
    expect(t).not.toContain("Fourth");
    expect(t).toContain("4 PLAYERS");
    expect(t).toContain("PREDICT THE JARGON. WIN THE MEETING.");
    expect(t).toContain("MUMBAHJUMBAH.COM");
  });

  it("says so when nothing matched, and handles an empty board", () => {
    expect(text(recapLayout([], []))).toContain("No picks matched");
    expect(text(recapLayout([], []))).toContain("No Grids, no winner.");
  });

  it("uses the brand palette and fonts, with logo mark and full-width zigzag", () => {
    const json = JSON.stringify(recapLayout(board, []));
    expect(json).toContain("#1F2F63"); // indigo ground
    expect(json).toContain("#E3C26E"); // raffia 1st place
    expect(json).toContain("#3C4E8A"); // indigo-line 2nd/3rd
    for (const f of ["Archivo", "Anton", "JetBrains Mono"]) expect(json).toContain(f);
    expect(json).not.toContain("Inter");
    const srcs = [...json.matchAll(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/g)].map((m) => atob(m[1]!));
    expect(srcs.some((s) => s.includes('viewBox="0 0 64 84"'))).toBe(true);
    expect(srcs.some((s) => s.includes('width="1200"') && s.includes("#D2432C"))).toBe(true);
  });
});

describe("recap routes", () => {
  it("returns a PNG for a non-empty session; unpicked frequent words never appear in the layout", async () => {
    const s = await createSession(env.DB, 1);
    await submit(s.invite_link_token, "a@x.com", "Ann", ["synergy"]);
    await lock(s.organizer_link_token);
    await upload(s.organizer_link_token, "synergy synergy banana banana banana banana");
    for (const path of [`/i/${s.invite_link_token}/recap.png`, `/o/${s.organizer_link_token}/recap.png`]) {
      const res = await SELF.fetch(`https://example.com${path}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(isPng(new Uint8Array(await res.arrayBuffer()))).toBe(true);
    }
    const { getJargonResult } = await import("../src/jargon");
    const { getLeaderboard } = await import("../src/leaderboard");
    const layout = text(recapLayout(await getLeaderboard(env.DB, s.id), await getJargonResult(env.DB, s.id)));
    expect(layout).toContain("synergy");
    expect(layout).not.toContain("banana");
    expect(layout).not.toContain("a@x.com");
  });

  it("returns a PNG for an empty session (no participants)", async () => {
    const s = await createSession(env.DB, 1);
    await lock(s.organizer_link_token);
    await upload(s.organizer_link_token, "hello world");
    const res = await SELF.fetch(`https://example.com/i/${s.invite_link_token}/recap.png`);
    expect(res.status).toBe(200);
    expect(isPng(new Uint8Array(await res.arrayBuffer()))).toBe(true);
  });

  it("404 for unknown token, 409 before lock, token types not interchangeable, links on leaderboard", async () => {
    expect((await SELF.fetch("https://example.com/i/nope/recap.png")).status).toBe(404);
    const s = await createSession(env.DB, 1);
    expect((await SELF.fetch(`https://example.com/i/${s.invite_link_token}/recap.png`)).status).toBe(409);
    await lock(s.organizer_link_token);
    expect((await SELF.fetch(`https://example.com/o/${s.invite_link_token}/recap.png`)).status).toBe(404);
    const lb = await (await SELF.fetch(`https://example.com/i/${s.invite_link_token}/leaderboard`)).text();
    expect(lb).toContain(`/i/${s.invite_link_token}/recap.png`);
    const lbo = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/leaderboard`)).text();
    expect(lbo).toContain(`/o/${s.organizer_link_token}/recap.png`);
  });
});
