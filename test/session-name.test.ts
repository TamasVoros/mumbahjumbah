import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession as createNamed } from "./helpers";
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

  it("stage 1 shows only the strip, heading, name field and Save button", async () => {
    const s = await createSession(env.DB, 3);
    const body = await getOrganizer(s.organizer_link_token);
    expect(body).toContain("<b>Organizer</b> · 1/4 · Name");
    expect(body).toContain("<h1>Name your session</h1>");
    expect(body).toContain("Participants see this on their pages.");
    expect(body).toContain('<label class="label" for="session-name">Session name</label>');
    expect(body).toMatch(/<input id="session-name" class="name-input" name="name" type="text" maxlength="80" required\s+autocomplete="off" autofocus placeholder="e\.g\. Q3 All-Hands"/);
    expect(body).toContain('class="pencil"');
    expect(body).toContain("Save and continue");
    expect(body).toContain('class="zigzag');
    for (const gone of [">SETUP<", 'class="stats', "<table", "invite-title", "Lock &amp; Start", 'class="title-input"', "data-name-form", "requestSubmit(", `Session ${s.id}`, 'class="toast"']) {
      expect(body).not.toContain(gone);
    }
  });

  it("stage 1 re-renders with an error toast on a bad name, and advances to stage 2 on a good one", async () => {
    const s = await createSession(env.DB, 3);
    const bad = await postName(s.organizer_link_token, "");
    expect(bad.status).toBe(400);
    const badBody = await bad.text();
    expect(badBody).toMatch(/<p class="toast" role="alert">Session name must be 1 to 80 characters\./);
    expect(badBody).toContain('id="session-name"');
    const ok = await (await postName(s.organizer_link_token, "Retro")).text();
    expect(ok).toContain("2/4");
    expect(ok).toContain('class="title-input"');
    expect(ok).toContain('class="pencil"');
    expect(ok).toContain("Lock &amp; Start Session!");
    expect(ok).not.toContain('id="session-name"');
  });

  it("stage 2 title is the inline input with pencil affordance and blur-save", async () => {
    const s = await createNamed(env.DB, 2, "Editable");
    const body = await getOrganizer(s.organizer_link_token);
    expect(body).toMatch(/<h1 class="title-wrap"><input class="title-input" name="name" type="text" maxlength="80" required/);
    expect(body).toContain('class="pencil"');
    expect(body).toContain("requestSubmit");
  });

  it("shows the title as a plain h1 once the Session is locked", async () => {
    const s = await createNamed(env.DB, 2, "Plain title");
    expect(await getOrganizer(s.organizer_link_token)).toContain('value="Plain title"');
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
    // Named is enough: the pick form is there with no timer to start.
    expect(body).toContain('name="display_name"');
    expect(body).toContain('id="pickapp"');

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
