import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getLeaderboard } from "../src/leaderboard";
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

async function setup() {
  const s = await createSession(env.DB, 2);
  await submit(s.invite_link_token, "a@x.com", "Zero1", ["nope", "never"]);
  await submit(s.invite_link_token, "b@x.com", "Bold", ["synergy", "ai"]); // 3 + 2 = 5
  await submit(s.invite_link_token, "c@x.com", "Zero2", ["absent", "missing"]);
  await submit(s.invite_link_token, "d@x.com", "TieLate", ["ai", "nope"]); // 2
  await submit(s.invite_link_token, "e@x.com", "TieEarly", ["ai", "other"]); // 2, but submitted after TieLate
  await lock(s.organizer_link_token);
  return s;
}

const T1 = "synergy synergy synergy ai ai";

describe("getLeaderboard", () => {
  it("sums distinct matched picks, orders by score then submission order, keeps zero scorers last", async () => {
    const s = await setup();
    await upload(s.organizer_link_token, T1);
    const board = await getLeaderboard(env.DB, s.id);
    expect(board.map((e) => [e.rank, e.displayName, e.score])).toEqual([
      [1, "Bold", 5],
      [2, "TieLate", 2],
      [3, "TieEarly", 2],
      [4, "Zero1", 0],
      [5, "Zero2", 0],
    ]);
  });

  it("resubmission keeps original submission position for tie-break", async () => {
    const s = await createSession(env.DB, 1);
    await submit(s.invite_link_token, "a@x.com", "First", ["x"]);
    await submit(s.invite_link_token, "b@x.com", "Second", ["x"]);
    await submit(s.invite_link_token, "a@x.com", "First", ["x"]);
    await lock(s.organizer_link_token);
    await upload(s.organizer_link_token, "x x");
    const board = await getLeaderboard(env.DB, s.id);
    expect(board.map((e) => e.displayName)).toEqual(["First", "Second"]);
  });

  it("with no Jargon Result everyone scores 0 in submission order; empty session is empty", async () => {
    const s = await createSession(env.DB, 1);
    await submit(s.invite_link_token, "a@x.com", "A", ["x"]);
    await submit(s.invite_link_token, "b@x.com", "B", ["y"]);
    expect((await getLeaderboard(env.DB, s.id)).map((e) => [e.displayName, e.score])).toEqual([["A", 0], ["B", 0]]);
    const empty = await createSession(env.DB, 1);
    expect(await getLeaderboard(env.DB, empty.id)).toEqual([]);
  });

  it("does not leak scores across sessions", async () => {
    const s = await setup();
    const other = await createSession(env.DB, 1);
    await submit(other.invite_link_token, "z@x.com", "Other", ["synergy"]);
    await lock(other.organizer_link_token);
    await upload(other.organizer_link_token, "synergy");
    await upload(s.organizer_link_token, T1);
    expect((await getLeaderboard(env.DB, other.id)).map((e) => e.score)).toEqual([1]);
  });
});

describe("leaderboard routes", () => {
  it("is served via both the Invite Link and Organizer Link and reflects re-uploads", async () => {
    const s = await setup();
    await upload(s.organizer_link_token, T1);
    for (const path of [`/i/${s.invite_link_token}/leaderboard`, `/o/${s.organizer_link_token}/leaderboard`]) {
      const res = await SELF.fetch(`https://example.com${path}`);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("<td>1</td><td>Bold</td><td>5</td>");
      expect(body).toContain("<td>5</td><td>Zero2</td><td>0</td>");
      expect(body).not.toContain("a@x.com");
    }
    await upload(s.organizer_link_token, "ai ai ai ai");
    const body = await (await SELF.fetch(`https://example.com/i/${s.invite_link_token}/leaderboard`)).text();
    expect(body).toContain("<td>1</td><td>Bold</td><td>4</td>");
    expect(body).toContain("<td>2</td><td>TieLate</td><td>4</td>");
  });

  it("tokens only resolve through their own finder", async () => {
    const s = await setup();
    expect((await SELF.fetch(`https://example.com/i/${s.organizer_link_token}/leaderboard`)).status).toBe(404);
    expect((await SELF.fetch(`https://example.com/o/${s.invite_link_token}/leaderboard`)).status).toBe(404);
  });

  it("is not available before the Session is locked", async () => {
    const s = await createSession(env.DB, 1);
    const res = await SELF.fetch(`https://example.com/i/${s.invite_link_token}/leaderboard`);
    expect(res.status).toBe(409);
  });

  it("links to the leaderboard from the locked Invite page and the Organizer page", async () => {
    const s = await setup();
    const inv = await SELF.fetch(`https://example.com/i/${s.invite_link_token}`);
    expect(await inv.text()).toContain(`/i/${s.invite_link_token}/leaderboard`);
    const org = await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`);
    expect(await org.text()).toContain(`/o/${s.organizer_link_token}/leaderboard`);
  });
});
