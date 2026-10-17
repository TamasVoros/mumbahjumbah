import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createWaitingSession } from "./helpers";

const post = (token: string, fields: [string, string][]) =>
  SELF.fetch(`https://example.com/i/${token}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
const rows = async (id: number) =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM participants WHERE session_id = ?").bind(id).first<{ n: number }>())!.n;

describe("Join before the timer (open state)", () => {
  it("GET shows the identity form, no waiting screen and no pick form", async () => {
    const s = await createWaitingSession(env.DB, 3, "Town hall");
    const res = await SELF.fetch(`https://example.com/i/${s.invite_link_token}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('name="email"');
    expect(html).toContain('name="display_name"');
    expect(html).toContain(">Join<");
    expect(html).not.toContain('id="waiting"');
    expect(html).not.toContain('id="pickapp"');
  });

  it("valid identity: 200 waiting screen greeting by name, edit form, nothing persisted", async () => {
    const s = await createWaitingSession(env.DB, 3);
    const res = await post(s.invite_link_token, [["email", "a@x.com"], ["display_name", "Ann"]]);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="waiting"');
    expect(html).toContain("You’re in as Ann");
    expect(html).toContain("Edit name or email");
    expect(html).toContain('value="a@x.com"');
    expect(html).not.toContain('id="pickapp"');
    expect(await rows(s.id)).toBe(0);
  });

  // Regression: ISSUE-001 — the waiting page is a POST response, so location.reload() re-posted the join form
  // when the timer started and showed "Submit between 1 and N picks" with no action from the participant.
  // Found by /qa on 2026-10-17
  it("waiting screen leaves via a GET navigation, never a reload that would re-post the join form", async () => {
    const s = await createWaitingSession(env.DB, 3);
    const html = await (await post(s.invite_link_token, [["email", "a@x.com"], ["display_name", "Ann"]])).text();
    expect(html).toContain("location.replace(location.pathname+location.search)");
    expect(html).not.toContain("location.reload()");
  });

  it("invalid identity: 400 with inline error, no waiting screen, input kept", async () => {
    const s = await createWaitingSession(env.DB, 3);
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

  it("picks posted while open: 409 waiting view with notice, nothing saved", async () => {
    const s = await createWaitingSession(env.DB, 3);
    const res = await post(s.invite_link_token, [["email", "a@x.com"], ["display_name", "Ann"], ["pick", "one"]]);
    expect(res.status).toBe(409);
    const html = await res.text();
    expect(html).toContain("nothing was saved");
    expect(html).toContain('id="waiting"');
    expect(await rows(s.id)).toBe(0);
  });

  it("identity-only joiners never show in the organizer view", async () => {
    const s = await createWaitingSession(env.DB, 3);
    await post(s.invite_link_token, [["email", "ghost@x.com"], ["display_name", "Ghost"]]);
    const org = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`)).text();
    expect(org).not.toContain("Ghost");
    expect(org).not.toContain("ghost@x.com");
  });
});
