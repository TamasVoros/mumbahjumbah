import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession } from "../src/sessions";

const base = "https://example.com";
const post = (path: string) => SELF.fetch(`${base}${path}`, { method: "POST" });

describe("Organizers only 403 (wrong link type)", () => {
  it("returns the Organizers only page for an invite token on every organizer route", async () => {
    const s = await createSession(env.DB, 2);
    const t = s.invite_link_token;
    const responses = [
      await SELF.fetch(`${base}/o/${t}`),
      await post(`/o/${t}/lock`),
      await post(`/o/${t}/transcript`),
      await SELF.fetch(`${base}/o/${t}/leaderboard`),
      await SELF.fetch(`${base}/o/${t}/recap.png`),
    ];
    for (const res of responses) {
      expect(res.status).toBe(403);
      const body = await res.text();
      expect(body).toContain("Organizers only");
      expect(body).toContain("This page needs the private organizer link. The invite link won't open it.");
    }
  });

  it("renders the 8A 403 card with the design tokens and a link back to the invite page", async () => {
    const s = await createSession(env.DB, 2);
    const body = await (await SELF.fetch(`${base}/o/${s.invite_link_token}`)).text();
    expect(body).toContain('class="err-card"');
    expect(body).toContain('<span class="code">403</span>');
    expect(body).toContain("--indigo:#1F2F63");
    expect(body).toContain(`href="/i/${s.invite_link_token}"`);
    expect(body).toContain("Use the invite link");
  });

  it("does not lock the Session when attempted with the invite token", async () => {
    const s = await createSession(env.DB, 2);
    await post(`/o/${s.invite_link_token}/lock`);
    const row = await env.DB.prepare("SELECT locked_at FROM sessions WHERE id = ?")
      .bind(s.id)
      .first<{ locked_at: string | null }>();
    expect(row!.locked_at).toBeNull();
  });

  it("keeps 404 for unknown tokens and for the organizer token on invite routes", async () => {
    const s = await createSession(env.DB, 2);
    expect((await SELF.fetch(`${base}/o/nope`)).status).toBe(404);
    expect((await post("/o/nope/lock")).status).toBe(404);
    expect((await SELF.fetch(`${base}/i/${s.organizer_link_token}`)).status).toBe(404);
  });

  it("leaves the locked-Session 403 on invite routes unchanged", async () => {
    const s = await createSession(env.DB, 2);
    await post(`/o/${s.organizer_link_token}/lock`);
    const res = await SELF.fetch(`${base}/i/${s.invite_link_token}`);
    expect(res.status).toBe(403);
    const body = await res.text();
    expect(body).toContain("is locked");
    expect(body).not.toContain("Organizers only");
  });
});
