import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession as createNamed, createWaitingSession } from "./helpers";
import { createSession } from "../src/sessions";

const postName = (token: string, name: string) =>
  SELF.fetch(`https://example.com/o/${token}/name`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name }),
  });

const getOrganizer = async (token: string) => (await SELF.fetch(`https://example.com/o/${token}`)).text();

const nameOf = async (id: number) =>
  (await env.DB.prepare("SELECT name FROM sessions WHERE id = ?").bind(id).first<{ name: string | null }>())!.name;

describe("Session Name gates the Invite Link", () => {
  it("hides the invite link on the organizer page until a name is saved", async () => {
    const s = await createSession(env.DB, 3);
    const before = await getOrganizer(s.organizer_link_token);
    expect(before).toContain(`action="/o/${s.organizer_link_token}/name"`);
    expect(before).not.toContain(s.invite_link_token);
    expect(before).not.toContain('id="invite-link"');

    const res = await postName(s.organizer_link_token, "  Q3 all-hands  ");
    expect(res.status).toBe(200);
    const after = await res.text();
    expect(after).toContain(`/i/${s.invite_link_token}`);
    expect(after).toContain('value="Q3 all-hands"');
    expect(after).toContain('role="status"');
    expect(after).toContain("Name saved. Invite link ready.");
    expect(await nameOf(s.id)).toBe("Q3 all-hands");
  });

  it("renders the name as an inline title input, with no name card, button or Session <id> fallback", async () => {
    const s = await createSession(env.DB, 3);
    const body = await getOrganizer(s.organizer_link_token);
    expect(body).toMatch(/<h1><input class="title-input" name="name" type="text" maxlength="80" required/);
    expect(body).toContain('placeholder="Name your session"');
    expect(body).toContain('value=""');
    expect(body).not.toContain(`Session ${s.id}`);
    expect(body).not.toContain("Save name");
    expect(body).not.toContain('id="session-name"');
    expect(body).not.toContain('class="toast"');
    expect(body).toContain("requestSubmit");
  });

  it("shows the title as a plain h1 once the timer starts or the Session is locked", async () => {
    const s = await createWaitingSession(env.DB, 2, "Plain title");
    expect(await getOrganizer(s.organizer_link_token)).toContain('value="Plain title"');
    await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/timer`, { method: "POST" });
    const picking = await getOrganizer(s.organizer_link_token);
    expect(picking).toContain("<h1>Plain title</h1>");
    expect(picking).not.toContain('class="title-input"');
    await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/lock`, { method: "POST" });
    const locked = await getOrganizer(s.organizer_link_token);
    expect(locked).toContain("<h1>Plain title</h1>");
    expect(locked).not.toContain('class="title-input"');
  });

  it("shows an alert toast on an invalid name and escapes the name in the input", async () => {
    const s = await createSession(env.DB, 3);
    const res = await postName(s.organizer_link_token, "x".repeat(81));
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/<p class="toast" role="alert">Session name must be 1 to 80 characters\./);
    const named = await (await postName(s.organizer_link_token, '"><script>x</script>')).text();
    expect(named).not.toContain("<script>x</script>");
  });

  it("rejects empty, whitespace-only and over-80-char names without saving", async () => {
    const s = await createSession(env.DB, 3);
    for (const bad of ["", "   ", "x".repeat(81), `  ${"y".repeat(81)}  `]) {
      const res = await postName(s.organizer_link_token, bad);
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toContain("Session name must be 1 to 80 characters.");
      expect(body).not.toContain(s.invite_link_token);
    }
    expect(await nameOf(s.id)).toBeNull();
    expect((await postName(s.organizer_link_token, "z".repeat(80))).status).toBe(200);
    expect(await nameOf(s.id)).toBe("z".repeat(80));
  });

  it("shows 'not open yet' (not 404, no pick form) on the invite route before a name exists", async () => {
    const s = await createSession(env.DB, 3);
    for (const method of ["GET", "POST"]) {
      const res = await SELF.fetch(`https://example.com/i/${s.invite_link_token}`, {
        method,
        ...(method === "POST"
          ? {
              headers: { "content-type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ email: "a@x.com", display_name: "A", pick: "one" }),
            }
          : {}),
      });
      expect(res.status).toBe(403);
      const body = await res.text();
      expect(body).toContain("This session isn’t open yet.");
      expect(body).not.toContain('name="pick"');
      expect(body).not.toContain("pickfield");
    }
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM participants WHERE session_id = ?").bind(s.id).first<{ n: number }>();
    expect(count!.n).toBe(0);
  });

  it("opens the invite route once the name is saved and shows the name to participants", async () => {
    const s = await createSession(env.DB, 2);
    await postName(s.organizer_link_token, "Standup");
    const res = await SELF.fetch(`https://example.com/i/${s.invite_link_token}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<h1>Standup</h1>");
    // Named but the timer isn't running yet: participants join (identity form), no pick form.
    expect(body).toContain('name="display_name"');
    expect(body).not.toContain('id="pickapp"');
    await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/timer`, { method: "POST" });
    expect(await (await SELF.fetch(`https://example.com/i/${s.invite_link_token}`)).text()).toContain('id="pickapp"');

    const submit = await SELF.fetch(`https://example.com/i/${s.invite_link_token}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams([["email", "a@x.com"], ["display_name", "Ann"], ["pick", "one"], ["pick", "two"]]),
    });
    expect(submit.status).toBe(200);
    expect(await submit.text()).toContain("<h1>Standup</h1>");
  });

  it("allows renaming until lock, then rejects and keeps the locked name on participant pages", async () => {
    const s = await createSession(env.DB, 2);
    await postName(s.organizer_link_token, "First");
    expect((await postName(s.organizer_link_token, "Second")).status).toBe(200);
    expect(await nameOf(s.id)).toBe("Second");

    await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/lock`, { method: "POST" });
    const res = await postName(s.organizer_link_token, "Third");
    expect(res.status).toBe(409);
    expect(await nameOf(s.id)).toBe("Second");

    const locked = await SELF.fetch(`https://example.com/i/${s.invite_link_token}`);
    expect(locked.status).toBe(403);
    expect(await locked.text()).toContain("<h1>Second</h1>");
  });

  it("refuses to lock a Session that has no name", async () => {
    const s = await createSession(env.DB, 2);
    const res = await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/lock`, { method: "POST" });
    expect(res.status).toBe(409);
    const row = await env.DB.prepare("SELECT locked_at FROM sessions WHERE id = ?").bind(s.id).first<{ locked_at: string | null }>();
    expect(row!.locked_at).toBeNull();
  });

  it("only the Organizer Link can set the name", async () => {
    const s = await createSession(env.DB, 2);
    expect((await postName(s.invite_link_token, "Hijack")).status).toBe(403);
    expect((await postName("nope", "Hijack")).status).toBe(404);
    expect(await nameOf(s.id)).toBeNull();
  });

  it("escapes the name in HTML", async () => {
    const s = await createSession(env.DB, 2);
    await postName(s.organizer_link_token, "<script>alert(1)</script>");
    const body = await (await SELF.fetch(`https://example.com/i/${s.invite_link_token}`)).text();
    expect(body).not.toContain("<script>alert(1)</script>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("grandfathers existing sessions: migration 0006 gives pre-existing rows a default name", async () => {
    // Re-run the migration's backfill against a legacy-shaped row (name NULL) to prove it opens it.
    const s = await createSession(env.DB, 2);
    await env.DB.prepare("UPDATE sessions SET name = 'Untitled session' WHERE name IS NULL AND id = ?").bind(s.id).run();
    const res = await SELF.fetch(`https://example.com/i/${s.invite_link_token}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<h1>Untitled session</h1>");
  });

  it("shows the name on the leaderboard", async () => {
    const s = await createNamed(env.DB, 2, "Board night");
    await SELF.fetch(`https://example.com/o/${s.organizer_link_token}/lock`, { method: "POST" });
    const body = await (await SELF.fetch(`https://example.com/i/${s.invite_link_token}/leaderboard`)).text();
    expect(body).toContain("Leaderboard: Board night");
  });
});
