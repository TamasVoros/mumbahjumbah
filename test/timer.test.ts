import { SELF, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseTimerSeconds } from "../src/sessions";
import { createWaitingSession } from "./helpers";

const T0 = Date.parse("2026-03-01T12:00:00.000Z");

// Only Date is faked: D1 and fetch keep running on the real event loop.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

const form = (body: Record<string, string> = {}) => ({
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(body),
});
const org = (token: string, path: string, body?: Record<string, string>) =>
  SELF.fetch(`https://example.com/o/${token}${path}`, form(body));
const startTimer = (token: string, seconds?: string) => org(token, "/timer", seconds === undefined ? {} : { seconds });
const lock = (token: string) => org(token, "/lock");
const invite = (token: string) => SELF.fetch(`https://example.com/i/${token}`);
const submit = (token: string, email: string, picks: string[]) => {
  const body = new URLSearchParams({ email, display_name: "Ann" });
  for (const p of picks) body.append("pick", p);
  return SELF.fetch(`https://example.com/i/${token}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
};
const status = async (token: string) => (await SELF.fetch(`https://example.com/i/${token}/status`)).json<Record<string, unknown>>();
const row = (id: number) => env.DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first<Record<string, unknown>>();
const participants = async (id: number) =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM participants WHERE session_id = ?").bind(id).first<{ n: number }>())!.n;

describe("parseTimerSeconds", () => {
  it("accepts only whole numbers from 30 to 60", () => {
    expect(["30", "45", "60", " 33 "].map(parseTimerSeconds)).toEqual([30, 45, 60, 33]);
    for (const bad of ["29", "61", "0", "-30", "30.5", "abc", "", "1e2", undefined, 30]) {
      expect(parseTimerSeconds(bad)).toBeNull();
    }
  });
});

describe("Start timer", () => {
  it("defaults to 30 s and sets the start and end server-side", async () => {
    const s = await createWaitingSession(env.DB, 3);
    expect((await startTimer(s.organizer_link_token)).status).toBe(200);
    const r = await row(s.id);
    expect(r).toMatchObject({
      timer_seconds: 30,
      timer_started_at: "2026-03-01T12:00:00.000Z",
      timer_ends_at: "2026-03-01T12:00:30.000Z",
      locked_at: null,
    });
  });

  it("accepts 30 to 60 s and rejects anything else with 400, leaving the timer unstarted", async () => {
    const s = await createWaitingSession(env.DB, 3);
    for (const bad of ["29", "61", "abc", "", "-5", "45.5"]) {
      expect((await startTimer(s.organizer_link_token, bad)).status).toBe(400);
    }
    expect((await row(s.id))!.timer_started_at).toBeNull();
    expect((await startTimer(s.organizer_link_token, "60")).status).toBe(200);
    expect((await row(s.id))).toMatchObject({ timer_seconds: 60, timer_ends_at: "2026-03-01T12:01:00.000Z" });
  });

  it("cannot start before the Session has a name", async () => {
    const unnamed = await (await import("../src/sessions")).createSession(env.DB, 3);
    const res = await startTimer(unnamed.organizer_link_token, "30");
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("Name the Session before starting the timer");
    expect((await row(unnamed.id))!.timer_started_at).toBeNull();
  });

  it("is fixed once started: no restart, no extend, no rename", async () => {
    const s = await createWaitingSession(env.DB, 3);
    await startTimer(s.organizer_link_token, "30");
    vi.setSystemTime(T0 + 10_000);
    expect((await startTimer(s.organizer_link_token, "60")).status).toBe(409);
    expect((await org(s.organizer_link_token, "/name", { name: "Renamed" })).status).toBe(409);
    expect(await row(s.id)).toMatchObject({ timer_seconds: 30, timer_ends_at: "2026-03-01T12:00:30.000Z", name: "Test session" });
  });

  it("needs the organizer token and rejects a locked Session", async () => {
    const s = await createWaitingSession(env.DB, 3);
    expect((await startTimer(s.invite_link_token)).status).toBe(403);
    await lock(s.organizer_link_token);
    expect((await startTimer(s.organizer_link_token)).status).toBe(409);
    expect((await row(s.id))!.timer_started_at).toBeNull();
  });

  it("organizer page shows the 30-60 input (default 30) and Start timer before start, a countdown after", async () => {
    const s = await createWaitingSession(env.DB, 3);
    const before = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`)).text();
    expect(before).toContain('name="seconds"');
    expect(before).toContain('min="30"');
    expect(before).toContain('max="60"');
    expect(before).toContain('value="30"');
    expect(before).toContain("Start timer");
    expect(before).toContain("Lock &amp; Start Session!");
    await startTimer(s.organizer_link_token, "40");
    const after = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`)).text();
    expect(after).toContain("Timer running");
    expect(after).toContain('id="org-timer"');
    expect(after).not.toContain('name="seconds"');
    expect(after).toContain("PICKING");
  });
});

describe("Participants before and during the timer", () => {
  it("wait until the timer starts: waiting screen, no pick form, submissions refused", async () => {
    const s = await createWaitingSession(env.DB, 3, "Town hall");
    const res = await invite(s.invite_link_token);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Town hall");
    expect(html).toContain("Waiting for the organizer to start");
    expect(html).not.toContain('id="pickapp"');
    expect(await status(s.invite_link_token)).toMatchObject({ state: "open", endsAt: null });

    const post = await submit(s.invite_link_token, "a@x.com", ["one"]);
    expect(post.status).toBe(409);
    expect(await participants(s.id)).toBe(0);
  });

  it("see the pick form and a synced countdown once it starts", async () => {
    const s = await createWaitingSession(env.DB, 3);
    await startTimer(s.organizer_link_token, "45");
    vi.setSystemTime(T0 + 5_000);
    const html = await (await invite(s.invite_link_token)).text();
    expect(html).toContain('id="pickapp"');
    expect(html).toContain('id="timer"');
    expect(html).toContain(`data-ends="${T0 + 45_000}"`);
    expect(html).toContain(`data-now="${T0 + 5_000}"`);
    expect(html).toContain(`data-status="/i/${s.invite_link_token}/status"`);
    expect(html).toContain(">40 s<");
    expect(await status(s.invite_link_token)).toEqual({ state: "picking", now: T0 + 5_000, endsAt: T0 + 45_000, seconds: 45 });
  });

  it("can submit while the timer runs, and resubmit up to the last millisecond", async () => {
    const s = await createWaitingSession(env.DB, 3);
    await startTimer(s.organizer_link_token, "30");
    expect((await submit(s.invite_link_token, "a@x.com", ["one"])).status).toBe(200);
    vi.setSystemTime(T0 + 29_999);
    expect((await submit(s.invite_link_token, "a@x.com", ["two"])).status).toBe(200);
    expect(await participants(s.id)).toBe(1);
  });

  it("status endpoint: unknown token 404, unnamed Session 403", async () => {
    expect((await SELF.fetch("https://example.com/i/nope/status")).status).toBe(404);
    const unnamed = await (await import("../src/sessions")).createSession(env.DB, 3);
    const res = await SELF.fetch(`https://example.com/i/${unnamed.invite_link_token}/status`);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ state: "setup" });
  });
});

describe("Timer end locks the Session (lazy, server-enforced)", () => {
  it("at now >= timer_ends_at the Session is locked with locked_at = timer_ends_at, no organizer action", async () => {
    const s = await createWaitingSession(env.DB, 3);
    await startTimer(s.organizer_link_token, "30");
    expect((await row(s.id))!.locked_at).toBeNull();

    vi.setSystemTime(T0 + 30_000); // exactly the end: strict cutoff
    const res = await invite(s.invite_link_token);
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("WAITING FOR TRANSCRIPT");
    expect((await row(s.id))!.locked_at).toBe("2026-03-01T12:00:30.000Z");
    expect(await status(s.invite_link_token)).toMatchObject({ state: "locked", endsAt: null });
  });

  it("rejects a late submit with 409, a clear message and the typed picks, writing nothing", async () => {
    const s = await createWaitingSession(env.DB, 3);
    await startTimer(s.organizer_link_token, "30");
    expect((await submit(s.invite_link_token, "a@x.com", ["early"])).status).toBe(200);

    vi.setSystemTime(T0 + 30_000);
    const res = await submit(s.invite_link_token, "a@x.com", ["late-one", "late-two"]);
    expect(res.status).toBe(409);
    const html = await res.text();
    expect(html).toContain("Time’s up");
    expect(html).toContain("late-one");
    expect(html).toContain("late-two");
    const { results } = await env.DB.prepare(
      "SELECT pk.pick FROM picks pk JOIN participants p ON p.id = pk.participant_id WHERE p.session_id = ?",
    )
      .bind(s.id)
      .all<{ pick: string }>();
    expect(results.map((r) => r.pick)).toEqual(["early"]);
    expect((await submit(s.invite_link_token, "new@x.com", ["x"])).status).toBe(409);
    expect(await participants(s.id)).toBe(1);
  });

  it("is enforced even if no request has seen the expiry yet (saveGrid checks the clock itself)", async () => {
    const { saveGrid } = await import("../src/grids");
    const s = await createWaitingSession(env.DB, 3);
    await startTimer(s.organizer_link_token, "30");
    const grid = { email: "a@x.com", displayName: "Ann", picks: ["one"] };
    expect(await saveGrid(env.DB, s.id, grid, T0 + 30_000)).toBe(false);
    expect(await saveGrid(env.DB, s.id, grid, T0 + 29_999)).toBe(true);
    // Never-started timer: nothing can be saved either.
    const w = await createWaitingSession(env.DB, 3);
    expect(await saveGrid(env.DB, w.id, grid, T0)).toBe(false);
  });

  it("organizer page, leaderboard and transcript upload see the expired Session as locked", async () => {
    const s = await createWaitingSession(env.DB, 3);
    await startTimer(s.organizer_link_token, "30");
    vi.setSystemTime(T0 + 31_000);
    const page = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`)).text();
    expect(page).toContain("This Session is locked");
    expect(page).not.toContain("Timer running");
    expect((await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/leaderboard`)).status).toBe(200);
    expect((await row(s.id))!.locked_at).toBe("2026-03-01T12:00:30.000Z");
  });
});

describe("Lock & Start Session!", () => {
  it("while the timer runs it stops the timer and locks now", async () => {
    const s = await createWaitingSession(env.DB, 3);
    await startTimer(s.organizer_link_token, "60");
    expect((await submit(s.invite_link_token, "a@x.com", ["one"])).status).toBe(200);
    vi.setSystemTime(T0 + 12_000);
    expect((await lock(s.organizer_link_token)).status).toBe(200);
    expect((await row(s.id))!.locked_at).toBe("2026-03-01T12:00:12.000Z");
    expect((await submit(s.invite_link_token, "a@x.com", ["two"])).status).toBe(409);
    expect(await status(s.invite_link_token)).toMatchObject({ state: "locked" });
    // The old end time passing later changes nothing.
    vi.setSystemTime(T0 + 90_000);
    await invite(s.invite_link_token);
    expect((await row(s.id))!.locked_at).toBe("2026-03-01T12:00:12.000Z");
  });

  it("is valid before the timer ever started, and the timer can no longer start", async () => {
    const s = await createWaitingSession(env.DB, 3);
    expect((await lock(s.organizer_link_token)).status).toBe(200);
    const r = await row(s.id);
    expect(r!.locked_at).toBe("2026-03-01T12:00:00.000Z");
    expect(r!.timer_started_at).toBeNull();
    expect((await invite(s.invite_link_token)).status).toBe(403);
    expect((await submit(s.invite_link_token, "a@x.com", ["one"])).status).toBe(409);
  });

  it("after the timer ended it is idempotent and keeps locked_at = timer_ends_at", async () => {
    const s = await createWaitingSession(env.DB, 3);
    await startTimer(s.organizer_link_token, "30");
    vi.setSystemTime(T0 + 45_000);
    expect((await lock(s.organizer_link_token)).status).toBe(200);
    expect((await row(s.id))!.locked_at).toBe("2026-03-01T12:00:30.000Z");
  });

  it("still requires a name", async () => {
    const unnamed = await (await import("../src/sessions")).createSession(env.DB, 3);
    expect((await lock(unnamed.organizer_link_token)).status).toBe(409);
  });
});
