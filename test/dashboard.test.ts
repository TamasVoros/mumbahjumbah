import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { median } from "../src/dashboard";
import { createSession } from "./helpers";

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
    expect(j.state).toBe("open");
    expect(Object.keys(j).sort()).toEqual(["participants", "state", "stats"]);
    expect(j.participants).toEqual([]);
    expect(j.stats).toEqual({ participants: 0, medianPicks: 0, uniquePicks: 0 });
  });

  it("lists names and pick counts, with metrics (even-count median), and never emails", async () => {
    const s = await createSession(env.DB, 5);
    await submit(s.invite_link_token, "ann@secret.example", "Ann", ["a", "b", "c"]);
    await submit(s.invite_link_token, "bob@secret.example", "Bob", ["B", "d"]);
    await submit(s.invite_link_token, "cy@secret.example", "Cy", ["a"]);
    await submit(s.invite_link_token, "di@secret.example", "Di", ["a", "b", "c", "d", "e"]);
    // Deterministic order: oldest first.
    for (const [i, email] of ["ann", "bob", "cy", "di"].entries()) {
      await env.DB.prepare("UPDATE participants SET created_at = ? WHERE email = ?")
        .bind(new Date(Date.UTC(2026, 2, 1, 12, 0, i)).toISOString(), `${email}@secret.example`)
        .run();
    }
    const text = await (await status(s.organizer_link_token)).text();
    expect(text).not.toContain("secret.example");
    const j = JSON.parse(text);
    expect(j.participants).toEqual([
      { name: "Ann", picks: 3 },
      { name: "Bob", picks: 2 },
      { name: "Cy", picks: 1 },
      { name: "Di", picks: 5 },
    ]);
    // picks per participant: 3,2,1,5 -> median (2+3)/2; distinct: a,b,c,d,e (Bob's "B" normalized to "b")
    expect(j.stats).toEqual({ participants: 4, medianPicks: 2.5, uniquePicks: 5 });
  });

  it("a resubmit updates the same row rather than adding a participant", async () => {
    const s = await createSession(env.DB, 3);
    await submit(s.invite_link_token, "ann@x.com", "Ann", ["a"]);
    await submit(s.invite_link_token, "ann@x.com", "Ann", ["a", "b"]);
    const j = await (await status(s.organizer_link_token)).json<Record<string, any>>();
    expect(j.participants).toEqual([{ name: "Ann", picks: 2 }]);
  });

  it("reports locked after Lock & Start", async () => {
    const s = await createSession(env.DB, 3);
    await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/lock`, { method: "POST" });
    const j = await (await status(s.organizer_link_token)).json<Record<string, any>>();
    expect(j.state).toBe("locked");
  });
});

describe("Organizer page dashboard", () => {
  it("renders the table columns, metric cards and polling hook, without emails", async () => {
    const s = await createSession(env.DB, 3);
    await submit(s.invite_link_token, "ann@secret.example", "Ann <b>", ["a", "b"]);
    const html = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`)).text();
    for (const h of ["Name", "Picks"]) expect(html).toContain(`<th scope="col">${h}</th>`);
    expect(html).not.toContain("Submit time");
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
