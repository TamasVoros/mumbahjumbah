import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createSession } from "./helpers";

// Migration 0008 has already run (on an empty table) in setup, and 0009 has since dropped the timer columns.
// Re-add the one 0008 reads, seed rows, and re-run its SQL against them.
const migration = env.TEST_MIGRATIONS.find((m) => m.name.startsWith("0008_"))!;

const set = (id: number, locked: string | null, ends: string | null) =>
  env.DB.prepare("UPDATE sessions SET locked_at = ?, timer_ends_at = ? WHERE id = ?").bind(locked, ends, id).run();

const lockedAt = async (id: number) =>
  (await env.DB.prepare("SELECT locked_at FROM sessions WHERE id = ?").bind(id).first<{ locked_at: string | null }>())!
    .locked_at;

describe("migration 0008: lock sessions whose timer already ran", () => {
  it("locks started-but-unlocked Sessions at the timer end and leaves the rest alone", async () => {
    await env.DB.prepare("ALTER TABLE sessions ADD COLUMN timer_ends_at TEXT").run();
    const ended = await createSession(env.DB, 2);
    const running = await createSession(env.DB, 2);
    const alreadyLocked = await createSession(env.DB, 2);
    const neverStarted = await createSession(env.DB, 2);
    const endedAt = "2020-01-01T00:01:00.000Z";
    const runningAt = "2999-01-01T00:01:00.000Z";
    await set(ended.id, null, endedAt);
    await set(running.id, null, runningAt);
    await set(alreadyLocked.id, "2019-05-05T00:00:00.000Z", endedAt);

    for (const q of migration.queries) await env.DB.prepare(q).run();

    expect(await lockedAt(ended.id)).toBe(endedAt);
    expect(await lockedAt(running.id)).toBe(runningAt);
    expect(await lockedAt(alreadyLocked.id)).toBe("2019-05-05T00:00:00.000Z");
    expect(await lockedAt(neverStarted.id)).toBeNull();
    await env.DB.prepare("ALTER TABLE sessions DROP COLUMN timer_ends_at").run();
  });
});
