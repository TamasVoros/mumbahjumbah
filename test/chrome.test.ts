import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession } from "./helpers";
import { createSession as createUnnamed } from "../src/sessions";

const base = "https://example.com";
const get = (path: string) => SELF.fetch(`${base}${path}`);
const lock = (token: string) => SELF.fetch(`${base}/o/${token}/lock`, { method: "POST" });

const expectChrome = (body: string, organizer = false) => {
  expect(body).toContain('<header class="site-header">');
  expect(body).toMatch(/<a class="site-brand" href="\/">/);
  expect(body).not.toContain("site-chip");
  expect(/<header class="site-header">[\s\S]*?<\/header>/.exec(body)![0]).not.toContain("Organizer");
  expect(body).toContain('<summary aria-label="Menu" aria-controls="site-menu-panel" aria-expanded="false">');
  expect(body).toContain('id="site-menu-panel"');
  for (const [href, label] of [["/", "Home"], ["/plans", "See plans"], ["/#privacy", "Privacy"]])
    expect(body).toContain(`<a href="${href}">${label}</a>`);
  expect(body).not.toContain("Sign in");
  // Sticky footer + one container rule, no per-page 100vh hacks.
  expect(body).toContain("min-height:100vh;display:flex;flex-direction:column");
  expect(body).not.toMatch(/\.(wrap|lb-page|board)\{[^}]*min-height:100vh/);
  expect(body.match(/\.site-inner\{[^}]*max-width:80rem/g)).toHaveLength(1);
  expect(body).not.toMatch(/(header|\.site-header)[^{}]*\.site-inner\{[^}]*(max-width|padding)/);
  expect(body).toContain(".site-brand svg{width:22px");
  expect(body).toContain(".site-brand svg{width:28px}");
  expect(body).toContain(".site-brand{font-size:24px");
  expect(body.includes('class="step-strip step-strip--organizer"')).toBe(organizer);
  expect(body).toContain('<footer class="site-footer">');
  expect(body).toContain('href="/plans">See plans</a>');
  expect(body).toContain('href="/#privacy">Privacy</a>');
  expect(body).toContain(`© ${new Date().getUTCFullYear()} MumbahJumbah`);
  expect(body.match(/<footer/g)).toHaveLength(1);
  expect(body.match(/<header class="site-header"/g)).toHaveLength(1);
  expect(body).toContain(".site-header a:focus-visible");
};

describe("shared header and footer on every screen", () => {
  it("landing, with a #privacy anchor for the footer link", async () => {
    const body = await (await get("/")).text();
    expectChrome(body);
    expect(body).toContain('id="privacy"');
  });

  it("plans", async () => expectChrome(await (await get("/plans")).text()));

  it("participant: entry, submitted, locked", async () => {
    const s = await createSession(env.DB, 2);
    expectChrome(await (await get(`/i/${s.invite_link_token}`)).text());
    const post = await SELF.fetch(`${base}/i/${s.invite_link_token}`, {
      method: "POST",
      body: new URLSearchParams([
        ["email", "a@b.co"],
        ["display_name", "A"],
        ["pick", "x"],
        ["pick", "y"],
      ]),
    });
    expect(post.status).toBe(200);
    expectChrome(await post.text());
    await lock(s.organizer_link_token);
    const locked = await get(`/i/${s.invite_link_token}`);
    expect(locked.status).toBe(403);
    expectChrome(await locked.text());
  });

  it("participant: not open yet", async () => {
    const s = await createUnnamed(env.DB, 2);
    const res = await get(`/i/${s.invite_link_token}`);
    expect(res.status).toBe(403);
    expectChrome(await res.text());
  });

  it("organizer: unlocked, locked and leaderboard all show the Organizer step strip", async () => {
    const s = await createSession(env.DB, 2);
    const o = s.organizer_link_token;
    expectChrome(await (await get(`/o/${o}`)).text(), true);
    await lock(o);
    expectChrome(await (await get(`/o/${o}`)).text(), true);
    expectChrome(await (await get(`/o/${o}/leaderboard`)).text(), true);
  });

  it("participant leaderboard has no Organizer step strip", async () => {
    const s = await createSession(env.DB, 2);
    await lock(s.organizer_link_token);
    expectChrome(await (await get(`/i/${s.invite_link_token}/leaderboard`)).text());
  });

  it("error pages: 404 and organizers-only 403", async () => {
    const nf = await get("/i/nope");
    expect(nf.status).toBe(404);
    expectChrome(await nf.text());
    const s = await createSession(env.DB, 2);
    const forbidden = await get(`/o/${s.invite_link_token}`);
    expect(forbidden.status).toBe(403);
    expectChrome(await forbidden.text());
  });
});
