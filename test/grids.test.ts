import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession } from "./helpers";

async function newSession(pickCount: number) {
  return createSession(env.DB, pickCount);
}

function submit(token: string, email: string, picks: string[], name = "Ann") {
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

async function picksFor(sessionId: number, email: string) {
  const { results } = await env.DB.prepare(
    `SELECT pk.pick FROM picks pk JOIN participants p ON p.id = pk.participant_id
     WHERE p.session_id = ? AND p.email = ? ORDER BY pk.pick`,
  )
    .bind(sessionId, email)
    .all<{ pick: string }>();
  return results.map((r) => r.pick);
}

const countParticipants = async (sessionId: number) =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM participants WHERE session_id = ?").bind(sessionId).first<{ n: number }>())!.n;

describe("Invite Link form", () => {
  it("serves exactly pick_count input cells", async () => {
    const s = await newSession(5);
    const html = await (await SELF.fetch(`https://example.com/i/${s.invite_link_token}`)).text();
    expect(html.match(/name="pick"/g)).toHaveLength(5);
    expect(html).toContain('name="email"');
    expect(html).toContain('name="display_name"');
  });
});

describe("Submit Grid", () => {
  it("persists a valid submission, normalized", async () => {
    const s = await newSession(3);
    const res = await submit(s.invite_link_token, "Ann@Example.com ", [" Synergy ", "PIVOT", "agile"]);
    expect(res.status).toBe(200);
    expect(await picksFor(s.id, "ann@example.com")).toEqual(["agile", "pivot", "synergy"]);
    const p = await env.DB.prepare("SELECT display_name FROM participants WHERE session_id = ?").bind(s.id).first();
    expect(p).toMatchObject({ display_name: "Ann" });
  });

  it("accepts 1..N picks (Pick Count is a maximum)", async () => {
    const s = await newSession(3);
    for (const [i, picks] of [["a"], ["a", "b"], ["a", "b", "c"]].entries()) {
      const res = await submit(s.invite_link_token, `p${i}@b.co`, picks);
      expect(res.status).toBe(200);
      expect(await picksFor(s.id, `p${i}@b.co`)).toEqual(picks);
    }
  });

  it("rejects zero and more than N picks with a clear message", async () => {
    const s = await newSession(3);
    const none = await submit(s.invite_link_token, "a@b.co", []);
    expect(none.status).toBe(400);
    expect(await none.text()).toContain("Submit between 1 and 3 picks (you submitted 0)");
    const blank = await submit(s.invite_link_token, "a@b.co", [" ", ""]);
    expect(blank.status).toBe(400);
    const many = await submit(s.invite_link_token, "a@b.co", ["a", "b", "c", "d"]);
    expect(many.status).toBe(400);
    expect(await many.text()).toContain("Submit between 1 and 3 picks (you submitted 4)");
    expect(await countParticipants(s.id)).toBe(0);
  });

  it("resubmission may change the number of picks", async () => {
    const s = await newSession(3);
    await submit(s.invite_link_token, "a@b.co", ["a", "b", "c"]);
    expect((await submit(s.invite_link_token, "a@b.co", ["z"])).status).toBe(200);
    expect(await picksFor(s.id, "a@b.co")).toEqual(["z"]);
    expect(await countParticipants(s.id)).toBe(1);
  });

  it("rejects duplicates (after normalization) with a clear error and stores nothing", async () => {
    const s = await newSession(3);
    const res = await submit(s.invite_link_token, "a@b.co", ["Synergy", "pivot", " synergy "]);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Duplicate pick");
    expect(await countParticipants(s.id)).toBe(0);
  });

  it("accepts multi-word phrase picks", async () => {
    const s = await newSession(2);
    const res = await submit(s.invite_link_token, "a@b.co", ["Move  the Needle", "at the end of the day"]);
    expect(res.status).toBe(200);
    expect(await picksFor(s.id, "a@b.co")).toEqual(["at the end of the day", "move the needle"]);
  });

  it("resubmission with the same email overwrites the Grid without a duplicate row", async () => {
    const s = await newSession(2);
    await submit(s.invite_link_token, "a@b.co", ["one", "two"], "Ann");
    const res = await submit(s.invite_link_token, "A@B.co", ["three", "four"], "Annie");
    expect(res.status).toBe(200);
    expect(await countParticipants(s.id)).toBe(1);
    expect(await picksFor(s.id, "a@b.co")).toEqual(["four", "three"]);
    const p = await env.DB.prepare("SELECT display_name FROM participants WHERE session_id = ?").bind(s.id).first();
    expect(p).toMatchObject({ display_name: "Annie" });
  });

  it("scopes the same email separately per session", async () => {
    const a = await newSession(1);
    const b = await newSession(1);
    await submit(a.invite_link_token, "a@b.co", ["x"]);
    await submit(b.invite_link_token, "a@b.co", ["y"]);
    expect(await picksFor(a.id, "a@b.co")).toEqual(["x"]);
    expect(await picksFor(b.id, "a@b.co")).toEqual(["y"]);
  });

  it("rejects missing email/name, unknown token, and locked sessions", async () => {
    const s = await newSession(1);
    expect((await submit(s.invite_link_token, "not-an-email", ["x"])).status).toBe(400);
    expect((await submit(s.invite_link_token, "a@b.co", ["x"], " ")).status).toBe(400);
    expect((await submit("nope", "a@b.co", ["x"])).status).toBe(404);
    await env.DB.prepare("UPDATE sessions SET locked_at = '2026-01-01' WHERE id = ?").bind(s.id).run();
    expect((await submit(s.invite_link_token, "a@b.co", ["x"])).status).toBe(409);
  });

  it("escapes user input when re-rendering the form on error", async () => {
    const s = await newSession(2);
    const res = await submit(s.invite_link_token, "a@b.co", ['"><script>x</script>', '"><script>x</script>'], "<b>");
    const text = await res.text();
    expect(text).not.toContain("<script>x");
    expect(text).toContain("&lt;script&gt;");
  });
});
