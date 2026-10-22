import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const BASE = "https://example.com";
const FORBIDDEN = [/timer/i, /countdown/i, /id="waiting"/i, /waiting/i, /submit time/i, /submitted at/i, /seconds/i];

const form = (fields: [string, string][]) => ({
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(fields),
});

function expectTimerFree(html: string) {
  for (const re of FORBIDDEN) expect(html, String(re)).not.toMatch(re);
}

describe("Timer-free flow, end to end over HTTP", () => {
  it("create → name → join early → lock → late 409 → transcript → leaderboard", async () => {
    const home = await SELF.fetch(`${BASE}/`);
    expectTimerFree(await home.text());

    const created = await SELF.fetch(`${BASE}/sessions`, { ...form([["pick_count", "3"]]), redirect: "manual" });
    expect(created.status).toBe(303);
    const orgPath = created.headers.get("location")!;
    const orgToken = orgPath.split("/").pop()!;

    // Unnamed: no pick form yet, and Lock is refused.
    const unnamed = await SELF.fetch(`${BASE}${orgPath}`);
    expectTimerFree(await unnamed.text());
    expect((await SELF.fetch(`${BASE}/o/${orgToken}/lock`, { method: "POST" })).status).toBe(409);

    const named = await SELF.fetch(`${BASE}/o/${orgToken}/name`, form([["name", "Weekly sync"]]));
    expect(named.status).toBe(200);
    const namedHtml = await named.text();
    expectTimerFree(namedHtml);
    expect(namedHtml).toContain("Lock");
    const invite = namedHtml.match(/\/i\/([A-Za-z0-9_-]+)/)![1]!;

    // Early submission right after naming; no waiting screen.
    const joinPage = await (await SELF.fetch(`${BASE}/i/${invite}`)).text();
    expectTimerFree(joinPage);
    expect(joinPage).toContain('id="pickapp"');
    const joined = await SELF.fetch(
      `${BASE}/i/${invite}`,
      form([["email", "ann@x.com"], ["display_name", "Ann"], ["pick", "synergy"], ["pick", "pivot"], ["pick", "bandwidth"]]),
    );
    expect(joined.status).toBe(200);
    expectTimerFree(await joined.text());

    const orgOpen = await (await SELF.fetch(`${BASE}/o/${orgToken}`)).text();
    expectTimerFree(orgOpen);

    const locked = await SELF.fetch(`${BASE}/o/${orgToken}/lock`, { method: "POST" });
    expect(locked.status).toBe(200);
    expectTimerFree(await locked.text());

    const late = await SELF.fetch(
      `${BASE}/i/${invite}`,
      form([["email", "bob@x.com"], ["display_name", "Bob"], ["pick", "late"]]),
    );
    expect(late.status).toBe(409);
    const lateHtml = await late.text();
    expect(lateHtml).toContain("The Session is locked");
    expect(lateHtml).toContain("late");
    expect(lateHtml).not.toContain('name="pick"');
    expectTimerFree(lateHtml);

    const fd = new FormData();
    fd.set("transcript", new File(["We need synergy and more bandwidth. Synergy again."], "t.txt"));
    const up = await SELF.fetch(`${BASE}/o/${orgToken}/transcript`, { method: "POST", body: fd, redirect: "manual" });
    expect(up.status).toBe(303);

    for (const path of [`/o/${orgToken}/leaderboard`, `/i/${invite}/leaderboard`, `/o/${orgToken}`, `/i/${invite}`]) {
      const res = await SELF.fetch(`${BASE}${path}`);
      const html = await res.text();
      expectTimerFree(html);
      if (path.endsWith("leaderboard")) expect(html).toContain("Ann");
    }
  });
});
