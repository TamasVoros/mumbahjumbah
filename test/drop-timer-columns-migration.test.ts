import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("migration 0009: drop the timer columns", () => {
  it("leaves no timer_* column on sessions", async () => {
    const cols = await env.DB.prepare("SELECT name FROM pragma_table_info('sessions')").all<{ name: string }>();
    expect(cols.results.map((c) => c.name).filter((n) => n.startsWith("timer_"))).toEqual([]);
  });

  it("leaves no index, trigger or view whose SQL mentions a timer column", async () => {
    const rows = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type IN ('index','trigger','view') AND sql LIKE '%timer_%'",
    ).all();
    expect(rows.results).toEqual([]);
  });
});
