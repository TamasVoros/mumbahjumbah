import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession } from "../src/sessions";

function submit(token: string, email: string, picks: string[]) {
  const body = new URLSearchParams();
  body.set("email", email);
  body.set("display_name", "Ann");
  for (const p of picks) body.append("pick", p);
  return SELF.fetch(`https://example.com/i/${token}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

const lock = (token: string) => SELF.fetch(`https://example.com/o/${token}/lock`, { method: "POST" });

const lockedAt = async (id: number) =>
  (await env.DB.prepare("SELECT locked_at FROM sessions WHERE id = ?").bind(id).first<{ locked_at: string | null }>())!
    .locked_at;

describe("Organizer view", () => {
  it("shows participant count and a lock button", async () => {
    const s = await createSession(env.DB, 2);
    await submit(s.invite_link_token, "a@x.com", ["one", "two"]);
    await submit(s.invite_link_token, "b@x.com", ["one", "two"]);
    const html = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`)).text();
    expect(html).toContain("Participants: 2");
    expect(html).toContain(`action="/o/${s.organizer_link_token}/lock"`);
  });

  it("does not resolve an invite token", async () => {
    const s = await createSession(env.DB, 2);
    expect((await SELF.fetch(`https://example.com/o/${s.invite_link_token}`)).status).toBe(403);
  });

  it("shows locked state without a lock button once locked", async () => {
    const s = await createSession(env.DB, 2);
    await lock(s.organizer_link_token);
    const html = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`)).text();
    expect(html).toContain("locked");
    expect(html).not.toContain("/lock");
  });
});

describe("Lock Session", () => {
  it("locks via the organizer link and is idempotent", async () => {
    const s = await createSession(env.DB, 2);
    expect(await lockedAt(s.id)).toBeNull();
    expect((await lock(s.organizer_link_token)).status).toBe(200);
    const first = await lockedAt(s.id);
    expect(first).not.toBeNull();
    expect((await lock(s.organizer_link_token)).status).toBe(200);
    expect(await lockedAt(s.id)).toBe(first);
  });

  it("rejects locking with the invite link token", async () => {
    const s = await createSession(env.DB, 2);
    expect((await lock(s.invite_link_token)).status).toBe(403);
    expect(await lockedAt(s.id)).toBeNull();
  });

  it("rejects locking with a bogus or missing token", async () => {
    const s = await createSession(env.DB, 2);
    expect((await lock("nope")).status).toBe(404);
    expect((await SELF.fetch("https://example.com/o//lock", { method: "POST" })).status).toBe(404);
    expect((await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/lock`)).status).toBe(404);
    expect(await lockedAt(s.id)).toBeNull();
  });

  it("rejects a new submission after lock", async () => {
    const s = await createSession(env.DB, 2);
    await lock(s.organizer_link_token);
    const res = await submit(s.invite_link_token, "new@x.com", ["a", "b"]);
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("locked");
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM participants WHERE session_id = ?").bind(s.id).first<{ n: number }>();
    expect(n!.n).toBe(0);
  });

  it("allows resubmission before lock but rejects it after", async () => {
    const s = await createSession(env.DB, 2);
    expect((await submit(s.invite_link_token, "a@x.com", ["a", "b"])).status).toBe(200);
    expect((await submit(s.invite_link_token, "a@x.com", ["c", "d"])).status).toBe(200);
    await lock(s.organizer_link_token);
    expect((await submit(s.invite_link_token, "a@x.com", ["e", "f"])).status).toBe(403);
    const { results } = await env.DB.prepare(
      "SELECT pk.pick FROM picks pk JOIN participants p ON p.id = pk.participant_id WHERE p.session_id = ? ORDER BY pk.pick",
    )
      .bind(s.id)
      .all<{ pick: string }>();
    expect(results.map((r) => r.pick)).toEqual(["c", "d"]);
  });
});
