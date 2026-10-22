import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession } from "./helpers";

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
    expect(page).toContain("What was actually said");
    expect(page).toContain('<li class="top" style="--w:100%"><b>ai</b>');
    expect(page).not.toContain("unpicked");
  });

  it("redirects a successful upload (303) to the leaderboard: strip 4/4, toast, recap and re-upload links", async () => {
    const s = await lockedSession([["alpha", "beta"]]);
    const res = await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/transcript`, {
      method: "POST",
      body: (() => { const f = new FormData(); f.set("transcript", new File(["alpha"], "t.txt")); return f; })(),
      redirect: "manual",
    });
    expect(res.status).toBe(303);
    const loc = res.headers.get("location")!;
    expect(loc.startsWith(`/o/${s.organizer_link_token}/leaderboard`)).toBe(true);
    const page = await (await SELF.fetch(`https://example.com${loc}`)).text();
    expect(page).toContain("4/4");
    expect(page).toContain("Transcript processed and discarded. Jargon Result updated.");
    expect(page).toContain(`/o/${s.organizer_link_token}/recap.png`);
    expect(page).toContain(`href="/o/${s.organizer_link_token}?step=transcript"`);
    expect(page).toContain("Upload a different transcript");
    // Plain leaderboard visit: no toast. Invite-side leaderboard has no organizer actions.
    const plain = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/leaderboard`)).text();
    expect(plain).not.toContain("Transcript processed and discarded");
    const inv = await (await SELF.fetch(`https://example.com/i/${s.invite_link_token}/leaderboard`)).text();
    expect(inv).not.toContain("Upload a different transcript");
  });

  it("stage 4 (locked, no result) shows only summary + upload; ?step=transcript reopens it for re-scoring", async () => {
    const s = await lockedSession([["alpha", "beta"]]);
    const page = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`)).text();
    expect(page).toContain("3/4");
    expect(page).toContain("Locked at");
    expect(page).toContain("1 participant");
    expect(page).toContain("Score the session");
    expect(page).not.toContain("Invite link");
    expect(page).not.toContain("What the room said");
    await upload(s.organizer_link_token, "a.txt", "alpha alpha");
    const again = await SELF.fetch(`https://example.com/o/${s.organizer_link_token}?step=transcript`, { redirect: "manual" });
    expect(again.status).toBe(200);
    const html = await again.text();
    expect(html).toContain("3/4");
    expect(html).toContain("Score the session");
    await upload(s.organizer_link_token, "b.txt", "beta");
    expect(await result(s.id)).toEqual({ beta: 1 });
    const lb = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/leaderboard`)).text();
    expect(lb).toContain("<b>beta</b>");
    expect(lb).not.toContain("<b>alpha</b>");
  });

  it("a failed upload stays on stage 4 with an error toast", async () => {
    const s = await lockedSession([["alpha", "beta"]]);
    const res = await upload(s.organizer_link_token, "empty.txt", "  ");
    expect(res.status).toBe(400);
    const page = await res.text();
    expect(page).toContain('role="alert"');
    expect(page).toContain("3/4");
    expect(page).toContain("Score the session");
  });

  it("accepts pasted transcript text, preferring a chosen file", async () => {
    const s = await lockedSession([["alpha", "beta"]]);
    const paste = (text: string, file?: string) => {
      const form = new FormData();
      form.set("transcript_text", text);
      if (file !== undefined) form.set("transcript", new File([file], "f.txt"));
      return SELF.fetch(`https://example.com/o/${s.organizer_link_token}/transcript`, { method: "POST", body: form });
    };
    expect((await paste("alpha alpha beta")).status).toBe(200);
    expect(await result(s.id)).toEqual({ alpha: 2, beta: 1 });
    expect((await paste("alpha", "beta")).status).toBe(200);
    expect(await result(s.id)).toEqual({ beta: 1 });
    expect((await paste("   ")).status).toBe(400);
    expect(await result(s.id)).toEqual({ beta: 1 });
  });

  it("renders the upload panel and unseen picks per the design", async () => {
    const s = await lockedSession([["alpha", "beta"]]);
    const before = await (await SELF.fetch(`https://example.com/o/${s.organizer_link_token}`)).text();
    expect(before).toContain("Drop a transcript here");
    expect(before).toContain(".TXT · .VTT");
    expect(before).not.toContain(".SRT");
    expect(before).toContain("Score the session");
    expect(before).toContain("Transcripts are read in memory, then deleted.");
    const page = await (await upload(s.organizer_link_token, "t.txt", "alpha alpha alpha beta")).text();
    expect(page).toContain("<b>alpha</b>");
    expect(page).toContain("<b>beta</b>");
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
