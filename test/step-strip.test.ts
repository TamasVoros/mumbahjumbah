import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { organizerStage } from "../src/organizer";
import { createSession as createUnnamed } from "../src/sessions";
import { createSession, createWaitingSession } from "./helpers";

const base = "https://example.com";
const get = (path: string) => SELF.fetch(`${base}${path}`).then((r) => r.text());
const post = (path: string, body?: BodyInit, headers?: HeadersInit) => SELF.fetch(`${base}${path}`, { method: "POST", body, headers });
const form = (data: Record<string, string>) => ({ body: new URLSearchParams(data), headers: { "content-type": "application/x-www-form-urlencoded" } });

const OLD_PILLS = [">SETUP<", ">OPEN<", ">PICKING<", ">LOCKED<", ">waiting<", ">submitted<", 'class="site-chip"', 'class="chip'];
const noPills = (html: string) => {
  for (const p of OLD_PILLS) expect(html).not.toContain(p);
};

const orgLabel = (n: number, name: string) => `<b>Organizer</b> · ${n}/5 · ${name}`;
const currentIndex = (html: string) => {
  const items = [...html.matchAll(/<li class="is-(done|current|upcoming)"/g)].map((m) => m[1]);
  return { items, current: items.indexOf("current") + 1 };
};

describe("organizerStage mapping", () => {
  it("maps session state plus Jargon Result to stages 1-5", () => {
    expect(organizerStage("setup", false)).toBe(1);
    expect(organizerStage("open", false)).toBe(2);
    expect(organizerStage("picking", false)).toBe(3);
    expect(organizerStage("locked", false)).toBe(4);
    expect(organizerStage("locked", true)).toBe(5);
  });
});

describe("organizer step strip", () => {
  it("shows the right stage on each organizer page, with no state pills", async () => {
    const unnamed = await createUnnamed(env.DB, 2);
    let html = await get(`/o/${unnamed.organizer_link_token}`);
    expect(html).toContain(orgLabel(1, "Name"));
    noPills(html);

    const named = await createWaitingSession(env.DB, 2);
    html = await get(`/o/${named.organizer_link_token}`);
    expect(html).toContain(orgLabel(2, "Invite &amp; timer"));
    noPills(html);

    const picking = await createSession(env.DB, 2);
    html = await get(`/o/${picking.organizer_link_token}`);
    expect(html).toContain(orgLabel(3, "Participants"));
    noPills(html);

    await post(`/i/${picking.invite_link_token}`, ...Object.values(form({ email: "a@x.com", display_name: "Ann", pick: "synergy" })) as [BodyInit, HeadersInit]);
    await post(`/o/${picking.organizer_link_token}/lock`);
    html = await get(`/o/${picking.organizer_link_token}`);
    expect(html).toContain(orgLabel(4, "Transcript"));
    noPills(html);

    const up = new FormData();
    up.set("transcript", new File(["we love synergy"], "t.txt"));
    await post(`/o/${picking.organizer_link_token}/transcript`, up);
    html = await get(`/o/${picking.organizer_link_token}`);
    expect(html).toContain(orgLabel(5, "Leaderboard"));
    noPills(html);

    html = await get(`/o/${picking.organizer_link_token}/leaderboard`);
    expect(html).toContain(orgLabel(5, "Leaderboard"));
    noPills(html);
  });

  it("is accessible: aria-label, one aria-current step, text not colour alone, no links", async () => {
    const s = await createSession(env.DB, 2);
    const html = await get(`/o/${s.organizer_link_token}`);
    expect(html).toContain('<nav class="step-strip step-strip--organizer" aria-label="Progress">');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(currentIndex(html)).toEqual({ items: ["done", "done", "current", "upcoming", "upcoming"], current: 3 });
    expect(html).toContain("Step 3 of 5: Participants (current)");
    expect(html).toContain("Step 1 of 5: Name (done)");
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

  it("Wait while the timer has not started", async () => {
    const s = await createWaitingSession(env.DB, 2);
    const html = await get(`/i/${s.invite_link_token}`);
    expect(step(html)).toBe(2);
    expect(html).toContain("Step 2 of 4: Wait (current)");
    noPills(html);
  });

  it("Pick while the timer runs", async () => {
    const s = await createSession(env.DB, 2);
    const html = await get(`/i/${s.invite_link_token}`);
    expect(step(html)).toBe(3);
    noPills(html);
  });

  it("Done once submitted, locked, and on the participant leaderboard", async () => {
    const s = await createSession(env.DB, 2);
    const res = await post(`/i/${s.invite_link_token}`, ...Object.values(form({ email: "a@x.com", display_name: "Ann", pick: "synergy" })) as [BodyInit, HeadersInit]);
    const submitted = await res.text();
    expect(step(submitted)).toBe(4);
    noPills(submitted);
    await post(`/o/${s.organizer_link_token}/lock`);
    const locked = await get(`/i/${s.invite_link_token}`);
    expect(step(locked)).toBe(4);
    noPills(locked);
    const lb = await get(`/i/${s.invite_link_token}/leaderboard`);
    expect(step(lb)).toBe(4);
  });
});
