import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { dashboardPanel, type DashboardStatus } from "../../src/dashboard-ui";

const status = (rows: DashboardStatus["participants"], state: DashboardStatus["state"] = "open"): DashboardStatus => ({
  state,
  participants: rows,
  stats: { participants: rows.length, medianPicks: rows.length ? 2.5 : 0, uniquePicks: rows.length * 2 },
});

// Runs the real inline polling script; the poll timer is captured so the test fires it by hand.
const load = (initial: DashboardStatus, next: DashboardStatus) => {
  const timers: Array<() => void> = [];
  let reloads = 0;
  const dom = new JSDOM(`<body>${String(dashboardPanel(initial, "/o/t/status", true, "Nobody yet"))}</body>`, {
    runScripts: "dangerously",
    beforeParse(w) {
      (w as any).fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(next) });
      (w as any).setTimeout = (fn: () => void) => void timers.push(fn);
    },
  });
  const doc = dom.window.document;
  const poll = async () => {
    timers.shift()!();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { doc, poll, timers, reloads: () => reloads };
};

describe("dashboard polling script", () => {
  it("fills the table and cards in place from the status JSON, without reload", async () => {
    const t = load(status([]), status([{ name: "Ann <b>", picks: 3 }, { name: "Bob", picks: 2 }]));
    expect(t.doc.querySelector("table")!.hidden).toBe(true);
    expect(t.doc.querySelector<HTMLElement>("[data-empty]")!.hidden).toBe(false);
    await t.poll();
    const rows = [...t.doc.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((td) => td.textContent));
    expect(rows).toEqual([["Ann <b>", "3"], ["Bob", "2"]]);
    expect(t.doc.querySelector("tbody b")).toBeNull(); // names are text, never markup
    expect(t.doc.querySelector("table")!.hidden).toBe(false);
    expect(t.doc.querySelector<HTMLElement>("[data-empty]")!.hidden).toBe(true);
    expect(t.doc.querySelector('[data-stat="participants"]')!.textContent).toBe("2");
    expect(t.doc.querySelector('[data-stat="medianPicks"]')!.textContent).toBe("2.5");
    expect(t.doc.querySelector('[data-stat="uniquePicks"]')!.textContent).toBe("4");
    expect(t.timers.length).toBe(1); // schedules the next poll
  });
});
