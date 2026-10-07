import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function create(pick: string) {
  return SELF.fetch("https://example.com/sessions", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ pick_count: pick }),
  });
}

function links(body: string) {
  const invite = /id="invite-link" href="([^"]+)"/.exec(body)![1]!;
  const organizer = /id="organizer-link" href="([^"]+)"/.exec(body)![1]!;
  return { invite, organizer };
}

describe("Create Session", () => {
  it("serves the form", async () => {
    const res = await SELF.fetch("https://example.com/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('name="pick_count"');
  });

  it("persists a session under the seed operator with distinct, resolving links", async () => {
    const res = await create("7");
    expect(res.status).toBe(201);
    const { invite, organizer } = links(await res.text());
    const inviteToken = invite.split("/i/")[1]!;
    const organizerToken = organizer.split("/o/")[1]!;

    const row = await env.DB.prepare("SELECT * FROM sessions WHERE invite_link_token = ?")
      .bind(inviteToken)
      .first<Record<string, unknown>>();
    expect(row).toMatchObject({
      operator_id: 1,
      pick_count: 7,
      organizer_link_token: organizerToken,
      locked_at: null,
    });
    const op = await env.DB.prepare("SELECT id FROM operators WHERE id = ?").bind(row!.operator_id).first();
    expect(op).not.toBeNull();

    // Different token spaces: neither contains/derives from the other.
    expect(inviteToken).not.toBe(organizerToken);
    expect(organizerToken).not.toContain(inviteToken);
    expect(inviteToken.length).toBeGreaterThanOrEqual(43);

    const inv = await SELF.fetch(invite);
    const org = await SELF.fetch(organizer);
    expect(inv.status).toBe(200);
    expect(org.status).toBe(200);
    expect(await inv.text()).toContain(`Session ${row!.id}`);
    expect(await org.text()).toContain(`Session ${row!.id}`);

    // Tokens are not interchangeable between routes.
    expect((await SELF.fetch(`https://example.com/o/${inviteToken}`)).status).toBe(403);
    expect((await SELF.fetch(`https://example.com/i/${organizerToken}`)).status).toBe(404);
  });

  it("accepts any positive integer pick count", async () => {
    for (const n of ["1", "2", "10", "13", "100"]) {
      expect((await create(n)).status).toBe(201);
    }
  });

  it("rejects non-positive or non-integer pick counts", async () => {
    for (const n of ["0", "-3", "2.5", "abc", "", "1e3"]) {
      expect((await create(n)).status).toBe(400);
    }
  });
});
