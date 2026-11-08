import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { organizerStage } from "../src/organizer";
import { createSession as createUnnamed } from "../src/sessions";
import { createSession } from "./helpers";

const base = "https://example.com";
const get = (path: string) => SELF.fetch(`${base}${path}`).then((r) => r.text());
const post = (path: string, body?: BodyInit, headers?: HeadersInit) => SELF.fetch(`${base}${path}`, { method: "POST", body, headers });
const form = (data: Record<string, string>) => ({ body: new URLSearchParams(data), headers: { "content-type": "application/x-www-form-urlencoded" } });

const OLD_PILLS = [">SETUP<", ">OPEN<", ">PICKING<", ">Wait<", ">LOCKED<", ">waiting<", ">submitted<", 'class="site-chip"', 'class="chip'];
const noPills = (html: string) => {
  for (const p of OLD_PILLS) expect(html).not.toContain(p);
};

const orgLabel = (n: number, name: string) => `<b>Organizer</b> · ${n}/4 · ${name}`;
const currentIndex = (html: string) => {
  const items = [...html.matchAll(/<li class="is-(done|current|upcoming)"/g)].map((m) => m[1]);
  return { items, current: items.indexOf("current") + 1 };
};

describe("organizerStage mapping", () => {
  it("maps session state plus Jargon Result to stages 1-4", () => {
    expect(organizerStage("setup", false)).toBe(1);
    expect(organizerStage("open", false)).toBe(2);
    expect(organizerStage("locked", false)).toBe(3);
    expect(organizerStage("locked", true)).toBe(4);
  });
});

describe("organizer step strip", () => {
  it("shows the right stage on each organizer page, with no state pills", async () => {
    const unnamed = await createUnnamed(env.DB, 2);
    let html = await get(`/o/${unnamed.organizer_link_token}`);
    expect(html).toContain(orgLabel(1, "Name"));
    noPills(html);

    const named = await createSession(env.DB, 2);
    html = await get(`/o/${named.organizer_link_token}`);
    expect(html).toContain(orgLabel(2, "Invite"));
    noPills(html);

    const picking = await createSession(env.DB, 2);

    await post(`/i/${picking.invite_link_token}`, ...Object.values(form({ email: "a@x.com", display_name: "Ann", pick: "synergy" })) as [BodyInit, HeadersInit]);
    await post(`/o/${picking.organizer_link_token}/lock`);
    html = await get(`/o/${picking.organizer_link_token}`);
    expect(html).toContain(orgLabel(3, "Transcript"));
    noPills(html);

    const up = new FormData();
    up.set("transcript", new File(["we love synergy"], "t.txt"));
    await post(`/o/${picking.organizer_link_token}/transcript`, up);
    html = await get(`/o/${picking.organizer_link_token}`);
    expect(html).toContain(orgLabel(4, "Leaderboard"));
    noPills(html);

    html = await get(`/o/${picking.organizer_link_token}/leaderboard`);
    expect(html).toContain(orgLabel(4, "Leaderboard"));
    noPills(html);
  });

  it("is accessible: aria-label, one aria-current step, text not colour alone, no links", async () => {
    const s = await createSession(env.DB, 2);
    const html = await get(`/o/${s.organizer_link_token}`);
    expect(html).toContain('<nav class="step-strip step-strip--organizer" aria-label="Progress">');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(currentIndex(html)).toEqual({ items: ["done", "current", "upcoming", "upcoming"], current: 2 });
    expect(html).toContain("Step 2 of 4: Invite (current)");
    expect(html).toContain("Step 1 of 4: Name (done)");
    const strip = html.slice(html.indexOf('<nav class="step-strip'), html.indexOf("</nav>", html.indexOf('<nav class="step-strip')));
    expect(strip).not.toContain("<a ");
  });

  it("sits directly below the nav", async () => {
    const s = await createSession(env.DB, 2);
    const html = await get(`/o/${s.organizer_link_token}`);
    expect(html.indexOf("</header>")).toBeLessThan(html.indexOf('class="step-strip'));
    expect(html.indexOf('class="step-strip')).toBeLessThan(html.indexOf("<main"));
  });
});

describe("player step strip", () => {
  const step = (html: string) => {
    expect(html).toContain('<nav class="step-strip step-strip--player" aria-label="Progress">');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    return currentIndex(html).current;
  };

  it("Join on the invite link before any identity was entered", async () => {
    const s = await createSession(env.DB, 2);
    const html = await get(`/i/${s.invite_link_token}`);
    expect(step(html)).toBe(1);
    expect(html).toContain("Step 1 of 3: Join (current)");
    expect(html).not.toContain("Wait");
    noPills(html);
  });

  it("Pick once a valid identity is entered, still on the pick form", async () => {
    const s = await createSession(env.DB, 2);
    const res = await post(`/i/${s.invite_link_token}`, ...Object.values(form({ email: "a@x.com", display_name: "Ann" })) as [BodyInit, HeadersInit]);
    const html = await res.text();
    expect(res.status).toBe(400);
    expect(step(html)).toBe(2);
    expect(html).toContain("Step 2 of 3: Pick (current)");
    expect(html).toContain('id="pickapp"');
    noPills(html);
  });

  it("Done once submitted, locked, and on the participant leaderboard", async () => {
    const s = await createSession(env.DB, 2);
    const res = await post(`/i/${s.invite_link_token}`, ...Object.values(form({ email: "a@x.com", display_name: "Ann", pick: "synergy" })) as [BodyInit, HeadersInit]);
    const submitted = await res.text();
    expect(step(submitted)).toBe(3);
    noPills(submitted);
    await post(`/o/${s.organizer_link_token}/lock`);
    const locked = await get(`/i/${s.invite_link_token}`);
    expect(step(locked)).toBe(3);
    noPills(locked);
    const lb = await get(`/i/${s.invite_link_token}/leaderboard`);
    expect(step(lb)).toBe(3);
  });
});
