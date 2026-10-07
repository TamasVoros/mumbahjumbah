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

describe("recapLayout", () => {
  it("lists top terms by occurrences desc and says so when nothing matched", () => {
    const t = text(recapLayout([], [{ term: "a", occurrences: 1 }, { term: "b", occurrences: 9 }]));
    expect(t.indexOf("b")).toBeLessThan(t.lastIndexOf("a "));
    expect(text(recapLayout([], []))).toContain("No picks matched");
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
    expect((await SELF.fetch(`https://example.com/o/${s.invite_link_token}/recap.png`)).status).toBe(403);
    const lb = await (await SELF.fetch(`https://example.com/i/${s.invite_link_token}/leaderboard`)).text();
    expect(lb).toContain(`/i/${s.invite_link_token}/recap.png`);
    const lbo = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/leaderboard`)).text();
    expect(lbo).toContain(`/o/${s.organizer_link_token}/recap.png`);
  });
});
