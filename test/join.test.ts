import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession } from "./helpers";

const post = (token: string, fields: [string, string][]) =>
  SELF.fetch(`https://example.com/i/${token}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
const rows = async (id: number) =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM participants WHERE session_id = ?").bind(id).first<{ n: number }>())!.n;

describe("Join (open Session)", () => {
  it("GET shows the identity fields and the pick form together, no waiting screen", async () => {
    const s = await createSession(env.DB, 3, "Town hall");
    const res = await SELF.fetch(`https://example.com/i/${s.invite_link_token}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('name="email"');
    expect(html).toContain('name="display_name"');
    expect(html).toContain('id="pickapp"');
    expect(html).not.toContain('id="waiting"');
    expect(html).not.toContain("countdown");
    expect(html).not.toContain('id="timer"');
  });

  it("valid identity with no picks stays on the pick form with the identity kept, nothing persisted", async () => {
    const s = await createSession(env.DB, 3);
    const res = await post(s.invite_link_token, [["email", "a@x.com"], ["display_name", "Ann"]]);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Submit between 1 and 3 picks");
    expect(html).toContain('id="pickapp"');
    expect(html).toContain('value="a@x.com"');
    expect(html).toContain('value="Ann"');
    expect(html).not.toContain('id="waiting"');
    expect(await rows(s.id)).toBe(0);
  });

  it("invalid identity: 400 with inline error, input kept", async () => {
    const s = await createSession(env.DB, 3);
    const bad = await post(s.invite_link_token, [["email", "nope"], ["display_name", "Ann"]]);
    expect(bad.status).toBe(400);
    const html = await bad.text();
    expect(html).toContain("Enter a valid email address.");
    expect(html).toContain('value="Ann"');
    expect(html).not.toContain('id="waiting"');
    expect((await post(s.invite_link_token, [["email", "a@x.com"], ["display_name", "x".repeat(51)]])).status).toBe(400);
    expect((await post(s.invite_link_token, [["email", "a@x.com"], ["display_name", " "]])).status).toBe(400);
    expect(await rows(s.id)).toBe(0);
  });

  it("picks posted while open (no timer started) are saved", async () => {
    const s = await createSession(env.DB, 3);
    const res = await post(s.invite_link_token, [["email", "a@x.com"], ["display_name", "Ann"], ["pick", "one"]]);
    expect(res.status).toBe(200);
    expect(await rows(s.id)).toBe(1);
  });

  it("status endpoint reports only open or locked", async () => {
    const s = await createSession(env.DB, 3);
    const open = await SELF.fetch(`https://example.com/i/${s.invite_link_token}/status`);
    expect(await open.json()).toEqual({ state: "open" });
    await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/lock`, { method: "POST" });
    const locked = await SELF.fetch(`https://example.com/i/${s.invite_link_token}/status`);
    expect(await locked.json()).toEqual({ state: "locked" });
    expect((await SELF.fetch("https://example.com/i/nope/status")).status).toBe(404);
  });

  it("the start-timer endpoint is gone", async () => {
    const s = await createSession(env.DB, 3);
    const res = await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/timer`, { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("identity-only joiners never show in the organizer view", async () => {
    const s = await createSession(env.DB, 3);
    await post(s.invite_link_token, [["email", "ghost@x.com"], ["display_name", "Ghost"]]);
    const org = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`)).text();
    expect(org).not.toContain("Ghost");
    expect(org).not.toContain("ghost@x.com");
  });
});
