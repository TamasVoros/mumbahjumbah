import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession, lockSession } from "../src/sessions";

const url = (t: string) => `https://example.com/i/${t}`;

const post = (token: string, picks: string[], email = "sam@acme.co") => {
  const body = new URLSearchParams({ email, display_name: "Sam" });
  for (const p of picks) body.append("pick", p);
  return SELF.fetch(url(token), { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
};

describe("invite-link screens follow DESIGN.md", () => {
  it("entry: palette tokens, fonts, focus ring, viewport, pill entry hooks", async () => {
    const s = await createSession(env.DB, 9);
    const html = await (await SELF.fetch(url(s.invite_link_token))).text();
    for (const token of ["#1F2F63", "#F4EFE6", "#D2432C", "rgba(31,47,99,.12)", "Archivo", "JetBrains Mono", "Anton"]) {
      expect(html).toContain(token);
    }
    expect(html).toContain('name="viewport"');
    expect(html).toContain("YOUR PICKS");
    expect(html).toContain('id="pickfield"');
    expect(html).toContain("Submit grid");
    expect(html).toContain("@media (min-width:900px)");
  });

  it("entry: inline script is syntactically valid", async () => {
    const s = await createSession(env.DB, 3);
    const html = await (await SELF.fetch(url(s.invite_link_token))).text();
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
    expect(() => new Function(script)).not.toThrow();
  });

  it("entry: validation error re-renders with prior picks escaped", async () => {
    const s = await createSession(env.DB, 3);
    const res = await post(s.invite_link_token, ["<b>x</b>", "y"]);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("submitted: chip summary view", async () => {
    const s = await createSession(env.DB, 2);
    const res = await post(s.invite_link_token, ["synergy", "pivot"]);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("sam@acme.co");
    expect(html).toContain("submitted");
    expect(html).toContain('<li class="pill">synergy</li>');
    expect(html).toContain("YOUR PICKS · 2 / 2");
    expect(html).toContain("Edit your Grid");
  });

  it("locked: waiting-for-transcript view, still 403", async () => {
    const s = await createSession(env.DB, 2);
    await lockSession(env.DB, s.organizer_link_token);
    for (const res of [await SELF.fetch(url(s.invite_link_token)), await post(s.invite_link_token, ["a", "b"])]) {
      expect(res.status).toBe(403);
      const html = await res.text();
      expect(html).toContain("WAITING FOR TRANSCRIPT");
      expect(html).toContain("locked");
      expect(html).toContain("/leaderboard");
    }
  });
});
