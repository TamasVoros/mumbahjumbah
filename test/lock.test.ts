import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession } from "./helpers";

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
    expect(html).toContain("<span class=\"num\" data-stat=\"participants\">2</span>");
    expect(html).toContain("Lock &amp; Start Session!");
    expect(html).toContain("2/4 · Invite");
    expect(html).not.toContain('class="chip chip--open"');
    expect(html).not.toContain("a@x.com");
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
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("The Session is locked");
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM participants WHERE session_id = ?").bind(s.id).first<{ n: number }>();
    expect(n!.n).toBe(0);
  });

  it("allows resubmission before lock but rejects it after", async () => {
    const s = await createSession(env.DB, 2);
    expect((await submit(s.invite_link_token, "a@x.com", ["a", "b"])).status).toBe(200);
    expect((await submit(s.invite_link_token, "a@x.com", ["c", "d"])).status).toBe(200);
    await lock(s.organizer_link_token);
    expect((await submit(s.invite_link_token, "a@x.com", ["e", "f"])).status).toBe(409);
    const { results } = await env.DB.prepare(
      "SELECT pk.pick FROM picks pk JOIN participants p ON p.id = pk.participant_id WHERE p.session_id = ? ORDER BY pk.pick",
    )
      .bind(s.id)
      .all<{ pick: string }>();
    expect(results.map((r) => r.pick)).toEqual(["c", "d"]);
  });
});

describe("No timer: Lock & Start is the only cutoff", () => {
  const name = (token: string, n: string) =>
    SELF.fetch(`https://example.com/o/${token}/name`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name: n }),
    });
  const row = (id: number) => env.DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first<Record<string, unknown>>();

  it("a named, unlocked Session accepts submissions with nothing started", async () => {
    const s = await createSession(env.DB, 2);
    expect((await submit(s.invite_link_token, "a@x.com", ["one"])).status).toBe(200);
  });

  it("the organizer page offers Lock & Start as soon as the Session is open, with no timer UI", async () => {
    const s = await createSession(env.DB, 2);
    const html = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`)).text();
    expect(html).toContain("Lock &amp; Start Session!");
    for (const gone of ["org-timer", "Start timer", 'name="seconds"', "Timer running", "/timer"]) {
      expect(html).not.toContain(gone);
    }
  });

  it("strict cutoff: saveGrid itself refuses once locked, and writes nothing", async () => {
    const { saveGrid } = await import("../src/grids");
    const s = await createSession(env.DB, 3);
    const grid = { email: "a@x.com", displayName: "Ann", picks: ["one"] };
    expect(await saveGrid(env.DB, s.id, grid)).toBe(true);
    await lock(s.organizer_link_token);
    expect(await saveGrid(env.DB, s.id, { ...grid, picks: ["late"] })).toBe(false);
    const { results } = await env.DB.prepare(
      "SELECT pk.pick FROM picks pk JOIN participants p ON p.id = pk.participant_id WHERE p.session_id = ?",
    )
      .bind(s.id)
      .all<{ pick: string }>();
    expect(results.map((r) => r.pick)).toEqual(["one"]);
  });

  it("late submission after lock: 409 read-only view with the typed picks, nothing saved", async () => {
    const s = await createSession(env.DB, 3);
    await lock(s.organizer_link_token);
    const res = await submit(s.invite_link_token, "a@x.com", ["late-one", "late-two"]);
    expect(res.status).toBe(409);
    const html = await res.text();
    expect(html).toContain("late-one");
    expect(html).toContain("late-two");
    expect(html).not.toContain('name="pick"');
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM participants WHERE session_id = ?").bind(s.id).first<{ n: number }>();
    expect(n!.n).toBe(0);
  });

  it("the Session Name freezes at lock", async () => {
    const s = await createSession(env.DB, 2, "Before");
    expect((await name(s.organizer_link_token, "During")).status).toBe(200);
    await lock(s.organizer_link_token);
    const res = await name(s.organizer_link_token, "After");
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("The Session is locked, so its name can’t change.");
    expect((await row(s.id))!.name).toBe("During");
  });

  it("locking is idempotent: the first lock timestamp is kept", async () => {
    const s = await createSession(env.DB, 2);
    await lock(s.organizer_link_token);
    const first = (await row(s.id))!.locked_at;
    expect(first).toBeTruthy();
    expect((await lock(s.organizer_link_token)).status).toBe(200);
    expect((await row(s.id))!.locked_at).toBe(first);
  });

  it("an unnamed Session accepts no submissions and cannot lock", async () => {
    const { createSession: createUnnamed } = await import("../src/sessions");
    const { saveGrid } = await import("../src/grids");
    const s = await createUnnamed(env.DB, 2);
    expect(await saveGrid(env.DB, s.id, { email: "a@x.com", displayName: "Ann", picks: ["one"] })).toBe(false);
    expect((await lock(s.organizer_link_token)).status).toBe(409);
  });
});
