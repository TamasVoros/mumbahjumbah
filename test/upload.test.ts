import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession } from "../src/sessions";

function submit(token: string, email: string, picks: string[]) {
  const body = new URLSearchParams();
  body.set("email", email);
  body.set("display_name", "Ann");
  for (const p of picks) body.append("pick", p);
  return SELF.fetch(`https://example.com/i/${token}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

const lock = (token: string) => SELF.fetch(`https://example.com/o/${token}/lock`, { method: "POST" });

function upload(token: string, name: string, content: string | Uint8Array) {
  const form = new FormData();
  if (name) form.set("transcript", new File([typeof content === "string" ? content : new Uint8Array(content)], name));
  return SELF.fetch(`https://example.com/o/${token}/transcript`, { method: "POST", body: form });
}

const result = async (id: number) =>
  Object.fromEntries(
    (
      await env.DB.prepare("SELECT term, occurrences FROM jargon_results WHERE session_id = ?")
        .bind(id)
        .all<{ term: string; occurrences: number }>()
    ).results.map((r) => [r.term, r.occurrences]),
  );

async function lockedSession(picksByUser: string[][]) {
  const s = await createSession(env.DB, picksByUser[0]?.length ?? 2);
  for (const [i, picks] of picksByUser.entries()) await submit(s.invite_link_token, `u${i}@x.com`, picks);
  await lock(s.organizer_link_token);
  return s;
}

describe("Transcript upload", () => {
  it("counts picked terms in a .txt with word boundaries and shows them to the Organizer", async () => {
    const s = await lockedSession([["AI", "synergy"], ["ai", "move the needle"]]);
    const res = await upload(s.organizer_link_token, "t.txt", "He said AI is the campaign. AI! Synergy? We move the needle, not the move needle. unpicked unpicked unpicked");
    expect(res.status).toBe(200);
    expect(await result(s.id)).toEqual({ ai: 2, synergy: 1, "move the needle": 1 });
    const page = await res.text();
    expect(page).toContain("Jargon Result");
    expect(page).toContain("<td>ai</td><td>2</td>");
    expect(page).not.toContain("unpicked");
  });

  it("strips VTT structure before matching", async () => {
    const s = await lockedSession([["synergy", "00"]]);
    const vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\n<v Bob>Synergy is key</v>\n\n00:00:02.000 --> 00:00:03.000\nBob: more synergy\n";
    expect((await upload(s.organizer_link_token, "t.VTT", vtt)).status).toBe(200);
    expect(await result(s.id)).toEqual({ synergy: 2 });
  });

  it("replaces the prior Jargon Result on re-upload", async () => {
    const s = await lockedSession([["alpha", "beta"]]);
    await upload(s.organizer_link_token, "a.txt", "alpha alpha beta");
    expect(await result(s.id)).toEqual({ alpha: 2, beta: 1 });
    await upload(s.organizer_link_token, "b.txt", "beta");
    expect(await result(s.id)).toEqual({ beta: 1 });
  });

  it("keeps the prior result when a retry fails, then allows another upload", async () => {
    const s = await lockedSession([["alpha", "beta"]]);
    await upload(s.organizer_link_token, "a.txt", "alpha");
    for (const bad of [
      upload(s.organizer_link_token, "empty.txt", "  \n "),
      upload(s.organizer_link_token, "x.pdf", "alpha"),
      upload(s.organizer_link_token, "", ""),
      upload(s.organizer_link_token, "bin.txt", new Uint8Array([0xff, 0xfe, 0xfa])),
    ]) {
      expect((await bad).status).toBe(400);
    }
    expect(await result(s.id)).toEqual({ alpha: 1 });
    expect((await upload(s.organizer_link_token, "ok.txt", "beta")).status).toBe(200);
    expect(await result(s.id)).toEqual({ beta: 1 });
  });

  it("succeeds with an empty Jargon Result when there are no Grids", async () => {
    const s = await createSession(env.DB, 2);
    await lock(s.organizer_link_token);
    expect((await upload(s.organizer_link_token, "t.txt", "lots of words here")).status).toBe(200);
    expect(await result(s.id)).toEqual({});
  });

  it("requires the Session to be locked", async () => {
    const s = await createSession(env.DB, 2);
    const res = await upload(s.organizer_link_token, "t.txt", "hello");
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("Lock the Session");
    expect(await result(s.id)).toEqual({});
  });

  it("rejects the invite token and bogus tokens", async () => {
    const s = await lockedSession([["alpha", "beta"]]);
    expect((await upload(s.invite_link_token, "t.txt", "alpha")).status).toBe(403);
    expect((await upload("nope", "t.txt", "alpha")).status).toBe(404);
    expect(await result(s.id)).toEqual({});
  });

  it("never persists the raw file content", async () => {
    const s = await lockedSession([["alpha", "beta"]]);
    const secret = "zzqx-confidential-codename alpha";
    await upload(s.organizer_link_token, "t.txt", secret);
    const { results: tables } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'",
    ).all<{ name: string }>();
    for (const { name } of tables) {
      const { results } = await env.DB.prepare(`SELECT * FROM "${name}"`).all();
      expect(JSON.stringify(results)).not.toContain("zzqx");
      expect(JSON.stringify(results)).not.toContain("confidential");
    }
  });
});
