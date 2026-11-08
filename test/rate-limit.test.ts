import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index";
import { createSession } from "./helpers";

const limiter = (success: boolean, keys: string[] = []): RateLimit => ({
  limit: async ({ key }) => {
    keys.push(key);
    return { success };
  },
});

const post = (path: string, e: object, ip = "203.0.113.7") =>
  app.request(
    path,
    { method: "POST", headers: { "CF-Connecting-IP": ip }, body: new URLSearchParams({ pick_count: "5" }) },
    { ...env, ...e },
  );

describe("rate limiting", () => {
  it("POST /sessions is allowed under the limit, keyed by CF-Connecting-IP", async () => {
    const keys: string[] = [];
    const res = await post("/sessions", { SESSIONS_LIMITER: limiter(true, keys) });
    expect(res.status).not.toBe(429);
    expect(keys).toEqual(["203.0.113.7"]);
  });

  it("POST /sessions returns a styled 429 with Retry-After when over the limit", async () => {
    const res = await post("/sessions", { SESSIONS_LIMITER: limiter(false) });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const html = await res.text();
    expect(html).toContain("429");
    expect(html).toContain("Too many requests");
    expect(html).toContain("#1F2F63");
    expect(html).toContain("Anton");
    expect(html).toContain('href="/"');
  });

  it("POST /i/:token is allowed under the limit and 429s over it", async () => {
    const s = await createSession(env.DB, 2);
    const ok = await post(`/i/${s.invite_link_token}`, { INVITE_LIMITER: limiter(true) });
    expect(ok.status).not.toBe(429);
    const limited = await post(`/i/${s.invite_link_token}`, { INVITE_LIMITER: limiter(false) });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
  });

  it("/health and GET pages are never limited", async () => {
    const both = { SESSIONS_LIMITER: limiter(false), INVITE_LIMITER: limiter(false) };
    expect((await app.request("/health", {}, { ...env, ...both })).status).toBe(200);
    expect((await app.request("/", {}, { ...env, ...both })).status).toBe(200);
  });
});
