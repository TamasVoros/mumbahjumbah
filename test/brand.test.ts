import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("brand head", () => {
  it.each(["/", "/plans", "/i/nope"])("%s links icons, manifest and theme-color", async (path) => {
    const body = await (await SELF.fetch(`https://example.com${path}`)).text();
    expect(body).toContain('rel="icon" href="/favicon.ico"');
    expect(body).toContain('href="/favicon.svg"');
    expect(body).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"');
    expect(body).toContain('rel="manifest" href="/site.webmanifest"');
    expect(body).toContain('name="theme-color" content="#1F2F63"');
  });

  it("landing page carries Open Graph and Twitter tags", async () => {
    const body = await (await SELF.fetch("https://example.com/")).text();
    expect(body).toContain('property="og:image" content="https://mumbahjumbah.com/og-image.png"');
    expect(body).toContain('property="og:title"');
    expect(body).toContain('property="og:description"');
    expect(body).toContain('name="twitter:card" content="summary_large_image"');
  });
});

describe("static brand assets", () => {
  it.each([
    ["/favicon.ico", "image/x-icon"],
    ["/favicon.svg", "image/svg+xml"],
    ["/apple-touch-icon.png", "image/png"],
    ["/icon-192.png", "image/png"],
    ["/icon-512.png", "image/png"],
    ["/icon-maskable-512.png", "image/png"],
    ["/og-image.png", "image/png"],
    ["/site.webmanifest", "application/manifest+json"],
  ])("%s is served", async (path, type) => {
    const res = await env.ASSETS.fetch(`https://example.com${path}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain(type.split("/")[1] === "x-icon" ? "icon" : type);
    await res.arrayBuffer();
  });

  it("dynamic routes are unaffected", async () => {
    expect((await SELF.fetch("https://example.com/health")).status).toBe(200);
  });

  it("favicon.svg is the full mark with no c2pa metadata", async () => {
    const svg = await (await env.ASSETS.fetch("https://example.com/favicon.svg")).text();
    expect(svg).not.toContain("c2pa");
    expect(svg).toContain("M32 54L38 64L32 76L26 64Z");
  });
});
