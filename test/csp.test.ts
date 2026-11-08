import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession } from "./helpers";

const nonceOf = (csp: string) => /script-src [^;]*'nonce-([^']+)'/.exec(csp)?.[1];

describe("CSP nonces", () => {
  it("has no unsafe-inline for scripts or style elements, and uses a fresh nonce per request", async () => {
    const a = await SELF.fetch("https://example.com/");
    const b = await SELF.fetch("https://example.com/");
    const cspA = a.headers.get("content-security-policy")!;
    expect(cspA).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(cspA).not.toMatch(/style-src [^;]*unsafe-inline/);
    expect(cspA).toContain("style-src-attr 'unsafe-inline'");
    expect(nonceOf(cspA)).toBeTruthy();
    expect(nonceOf(cspA)).not.toBe(nonceOf(b.headers.get("content-security-policy")!));
  });

  it("stamps the nonce on every script and style tag on each page", async () => {
    const s = await createSession(env.DB, 2);
    const urls = [
      "/",
      `/i/${s.invite_link_token}`,
      `/o/${s.organizer_link_token}`,
      `/o/${s.organizer_link_token}/leaderboard`,
      "/plans",
      "/nope-404",
    ];
    let tagCount = 0;
    for (const u of urls) {
      const res = await SELF.fetch("https://example.com" + u);
      const nonce = nonceOf(res.headers.get("content-security-policy")!)!;
      const html = await res.text();
      for (const t of html.match(/<(script|style)\b[^>]*>/g) ?? []) {
        tagCount++;
        expect(t, `${u}: ${t}`).toContain(`nonce="${nonce}"`);
      }
    }
    expect(tagCount).toBeGreaterThan(5);
  });
});
