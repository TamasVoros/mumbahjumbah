import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const get = async (path: string) => SELF.fetch(`https://example.com${path}`);

describe("GET /plans", () => {
  it("renders three plans with placeholder prices", async () => {
    const res = await get("/plans");
    expect(res.status).toBe(200);
    const body = await res.text();
    for (const t of ["Team", "Coach", "Organization", "FREE", "PRICE TBC", "ON REQUEST", "Start free", "Choose Coach", "Get in touch"]) {
      expect(body).toContain(t);
    }
    expect(body.match(/class="plan plan-/g)).toHaveLength(3);
  });

  it("links the Team plan CTA to create-session", async () => {
    const body = await (await get("/plans")).text();
    expect(body).toContain('<a class="cta" href="/">Start free</a>');
  });

  it("uses the DESIGN.md palette and is responsive", async () => {
    const body = await (await get("/plans")).text();
    for (const c of ["#1F2F63", "#F4EFE6", "#D2432C", "#E3C26E", "#17140F"]) expect(body).toContain(c);
    expect(body).toContain("width=device-width");
    expect(body).toContain("min-width:900px");
  });

  it("marks Coach and Organization buttons aria-disabled (no payment flow)", async () => {
    const body = await (await get("/plans")).text();
    expect(body.match(/<button type="button" class="cta" aria-disabled="true"/g)).toHaveLength(2);
  });

  it("has no fixed widths that could force horizontal scroll", async () => {
    const body = await (await get("/plans")).text();
    expect(body).toContain("box-sizing:border-box");
    expect(body).not.toMatch(/[^-]width:\d{3,}px/);
  });

  it("is linked from the landing page", async () => {
    const body = await (await get("/")).text();
    expect(body).toContain('<a href="/plans">See plans</a>');
  });
});
