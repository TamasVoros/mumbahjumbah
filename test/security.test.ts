import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { saveGrid, validateGrid } from "../src/grids";
import { createSession, lockSession, parsePickCount } from "../src/sessions";

describe("pick count cap", () => {
  it("accepts 1..100 and rejects the rest", () => {
    expect(parsePickCount("1")).toBe(1);
    expect(parsePickCount("100")).toBe(100);
    expect(parsePickCount("101")).toBeNull();
    expect(parsePickCount("9007199254740991")).toBeNull();
  });

  it("is enforced by the database too", async () => {
    await expect(createSession(env.DB, 101)).rejects.toThrow();
  });
});

describe("field limits", () => {
  const ok = { email: "a@x.com", display_name: "Ann", pick: ["one"] };
  it("rejects over-long email, name, and picks", () => {
    expect(validateGrid({ ...ok, email: "a".repeat(250) + "@x.com" }, 1).ok).toBe(false);
    expect(validateGrid({ ...ok, display_name: "n".repeat(51) }, 1).ok).toBe(false);
    expect(validateGrid({ ...ok, pick: ["p".repeat(61)] }, 1).ok).toBe(false);
    expect(validateGrid({ ...ok, pick: ["a b c d e f g h i"] }, 1).ok).toBe(false);
    expect(validateGrid({ ...ok, pick: ["a b c d e f g h"] }, 1).ok).toBe(true);
  });
});

describe("security headers", () => {
  it("sets CSP, framing, nosniff and referrer headers", async () => {
    const res = await SELF.fetch("https://example.com/");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("marks token routes no-store", async () => {
    const s = await createSession(env.DB, 2);
    for (const path of [`/i/${s.invite_link_token}`, `/o/${s.organizer_link_token}`]) {
      expect((await SELF.fetch(`https://example.com${path}`)).headers.get("cache-control")).toBe("no-store");
    }
    const created = await SELF.fetch("https://example.com/sessions", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ pick_preset: "5" }),
    });
    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("no-store");
  });
});

describe("saveGrid vs lock", () => {
  const grid = { email: "a@x.com", displayName: "Ann", picks: ["one", "two"] };
  it("saves while open, writes nothing once locked", async () => {
    const s = await createSession(env.DB, 2);
    expect(await saveGrid(env.DB, s.id, grid)).toBe(true);
    await lockSession(env.DB, s.organizer_link_token);
    expect(await saveGrid(env.DB, s.id, { ...grid, picks: ["x", "y"] })).toBe(false);
    const { results } = await env.DB.prepare(
      "SELECT pk.pick FROM picks pk JOIN participants p ON p.id = pk.participant_id WHERE p.session_id = ? ORDER BY pk.pick",
    )
      .bind(s.id)
      .all<{ pick: string }>();
    expect(results.map((r) => r.pick)).toEqual(["one", "two"]);
  });
});
