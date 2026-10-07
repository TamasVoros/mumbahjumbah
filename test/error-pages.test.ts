import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession, lockSession } from "../src/sessions";

describe("error pages", () => {
  it("404 uses the error card with DESIGN.md palette, type and way out", async () => {
    const res = await SELF.fetch("https://example.com/i/nope");
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('class="error-card"');
    expect(html).toContain("404");
    expect(html).toContain("That link doesn’t go anywhere.");
    expect(html).toContain("Ask your organizer for a fresh one.");
    expect(html).toContain('href="/"');
    for (const token of ["#1F2F63", "#E3C26E", "#F4EFE6", "#17140F", "Anton", "Archivo"]) {
      expect(html).toContain(token);
    }
    expect(html).toContain('name="viewport"');
  });

  it("is responsive: fluid width capped, no fixed width wider than 375px", async () => {
    const html = await (await SELF.fetch("https://example.com/o/nope")).text();
    expect(html).toContain("width:100%;max-width:420px");
    expect(html).not.toMatch(/[^-]width:\s*(3[8-9]\d|[4-9]\d\d|\d{4,})px/);
  });

  it("locked-session 403 keeps its copy and links (restyled as the #20 locked screen, not the error card)", async () => {
    const s = await createSession(env.DB, 2);
    await lockSession(env.DB, s.organizer_link_token);
    const res = await SELF.fetch(`https://example.com/i/${s.invite_link_token}`);
    expect(res.status).toBe(403);
    const html = await res.text();
    expect(html).toContain(`Session ${s.id} is locked`);
    expect(html).toContain("The Organizer has locked this Session, so Grids can no longer be submitted or changed.");
    expect(html).toContain(`href="/i/${s.invite_link_token}/leaderboard"`);
    expect(html).toContain(`href="/i/${s.invite_link_token}/recap.png"`);
  });
});
