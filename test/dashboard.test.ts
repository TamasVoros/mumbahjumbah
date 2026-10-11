import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { median, submitTime } from "../src/dashboard";
import { createSession, createWaitingSession } from "./helpers";

const submit = (token: string, email: string, name: string, picks: string[]) => {
  const body = new URLSearchParams({ email, display_name: name });
  for (const p of picks) body.append("pick", p);
  return SELF.fetch(`https://example.com/i/${token}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
};
const status = (token: string) => SELF.fetch(`https://example.com/o/${token}/status`);

describe("median", () => {
  it("handles empty, odd and even counts", () => {
    expect(median([])).toBe(0);
    expect(median([5])).toBe(5);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([1, 1, 2, 9])).toBe(1.5);
  });
});

describe("submitTime", () => {
  it("is seconds from timer start, ??? without a timer", () => {
    expect(submitTime("2026-03-01T12:00:00.000Z", "2026-03-01T12:00:12.340Z")).toBe("12.3");
    expect(submitTime("2026-03-01T12:00:10.000Z", "2026-03-01T12:00:09.000Z")).toBe("0.0");
    expect(submitTime(null, "2026-03-01T12:00:12.000Z")).toBe("???");
  });
});

describe("GET /o/:token/status", () => {
  it("rejects an invite token with 403 and an unknown token with 404", async () => {
    const s = await createSession(env.DB, 3);
    expect((await status(s.invite_link_token)).status).toBe(403);
    expect((await status("nope-nope")).status).toBe(404);
  });

  it("returns an empty dashboard when nobody joined", async () => {
    const s = await createSession(env.DB, 3);
    const res = await status(s.organizer_link_token);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const j = await res.json<Record<string, any>>();
    expect(j.state).toBe("picking");
    expect(typeof j.now).toBe("number");
    expect(j.timerEndsAt).toBe(Date.parse(s.timer_ends_at!));
    expect(j.participants).toEqual([]);
    expect(j.stats).toEqual({ participants: 0, medianPicks: 0, uniquePicks: 0 });
  });

  it("lists names, submit time and pick counts, with metrics (even-count median), and never emails", async () => {
    const s = await createSession(env.DB, 5);
    await submit(s.invite_link_token, "ann@secret.example", "Ann", ["a", "b", "c"]);
    await submit(s.invite_link_token, "bob@secret.example", "Bob", ["B", "d"]);
    await submit(s.invite_link_token, "cy@secret.example", "Cy", ["a"]);
    await submit(s.invite_link_token, "di@secret.example", "Di", ["a", "b", "c", "d", "e"]);
    // Deterministic submit times: 5 s, 10.5 s, 20 s, 30 s after the timer started.
    const start = Date.parse(s.timer_started_at!);
    for (const [email, secs] of [["ann", 5], ["bob", 10.5], ["cy", 20], ["di", 30]] as const) {
      await env.DB.prepare("UPDATE participants SET created_at = ? WHERE email = ?")
        .bind(new Date(start + secs * 1000).toISOString(), `${email}@secret.example`)
        .run();
    }
    const text = await (await status(s.organizer_link_token)).text();
    expect(text).not.toContain("secret.example");
    const j = JSON.parse(text);
    expect(j.participants).toEqual([
      { name: "Ann", submitTime: "5.0", picks: 3 },
      { name: "Bob", submitTime: "10.5", picks: 2 },
      { name: "Cy", submitTime: "20.0", picks: 1 },
      { name: "Di", submitTime: "30.0", picks: 5 },
    ]);
    // picks per participant: 3,2,1,5 -> median (2+3)/2; distinct: a,b,c,d,e (Bob's "B" normalized to "b")
    expect(j.stats).toEqual({ participants: 4, medianPicks: 2.5, uniquePicks: 5 });
  });

  it("keeps the first submission time when a participant resubmits", async () => {
    const s = await createSession(env.DB, 3);
    await submit(s.invite_link_token, "ann@x.com", "Ann", ["a"]);
    const first = "2026-01-01T00:00:00.000Z";
    await env.DB.prepare("UPDATE participants SET created_at = ?").bind(first).run();
    await submit(s.invite_link_token, "ann@x.com", "Ann", ["a", "b"]);
    const row = await env.DB.prepare("SELECT created_at FROM participants WHERE session_id = ?").bind(s.id).first<{ created_at: string }>();
    expect(row!.created_at).toBe(first);
    const j = await (await status(s.organizer_link_token)).json<Record<string, any>>();
    expect(j.participants).toHaveLength(1);
    expect(j.participants[0].picks).toBe(2);
  });

  it("shows ??? as submit time when the timer was never started", async () => {
    const s = await createWaitingSession(env.DB, 3);
    await env.DB.prepare("INSERT INTO participants (session_id, email, display_name) VALUES (?, 'a@x.com', 'Ann')").bind(s.id).run();
    const j = await (await status(s.organizer_link_token)).json<Record<string, any>>();
    expect(j.state).toBe("open");
    expect(j.participants[0].submitTime).toBe("???");
  });
});

describe("Organizer page dashboard", () => {
  it("renders the table columns, metric cards and polling hook, without emails", async () => {
    const s = await createSession(env.DB, 3);
    await submit(s.invite_link_token, "ann@secret.example", "Ann <b>", ["a", "b"]);
    const html = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`)).text();
    for (const h of ["Name", "Submit time (s)", "Picks"]) expect(html).toContain(`<th scope="col">${h}</th>`);
    for (const k of ["participants", "medianPicks", "uniquePicks"]) expect(html).toContain(`data-stat="${k}"`);
    expect(html).toContain(`data-url="/o/${s.organizer_link_token}/status"`);
    expect(html).toContain('data-live="1"');
    expect(html).toContain("Ann &lt;b&gt;");
    expect(html).not.toContain("secret.example");
  });

  it("shows the empty state when nobody joined", async () => {
    const s = await createSession(env.DB, 3);
    const html = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`)).text();
    expect(html).toContain("Nobody has joined yet");
    expect(html).not.toMatch(/data-empty hidden/);
  });
});
