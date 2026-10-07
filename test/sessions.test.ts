import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function create(pick: string) {
  return SELF.fetch("https://example.com/sessions", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ pick_count: pick }),
  });
}

async function createPreset(preset: string, pick: string) {
  return SELF.fetch("https://example.com/sessions", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ pick_preset: preset, pick_count: pick }),
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
    const body = await res.text();
    expect(body).toContain('name="pick_count"');
    const pills = [...body.matchAll(/<input type="radio" name="pick_preset" [^>]*>/g)].map((m) => m[0]);
    expect(pills.map((p) => /value="([^"]+)"/.exec(p)![1])).toEqual(["custom", "5", "10"]);
    expect(pills[0]).toContain("checked");
    expect(pills.slice(1).some((p) => p.includes("checked"))).toBe(false);
  });

  it("inline script disables the number input unless Custom is selected, and requires it for Custom", async () => {
    const body = await (await SELF.fetch("https://example.com/")).text();
    const script = /<script>([\s\S]*?)<\/script>/.exec(body)![1]!;
    const input = { disabled: false, required: false };
    const custom = { checked: true };
    let onChange = () => {};
    const form = {
      querySelector: (sel: string) => (sel.includes("pick_count") ? input : custom),
      addEventListener: (_: string, fn: () => void) => (onChange = fn),
    };
    new Function("document", script)({ querySelector: () => form });
    // Custom selected on load: input live and required.
    expect(input).toEqual({ disabled: false, required: true });
    // Switching to 5/10: input disabled, so it cannot block submission or be sent.
    custom.checked = false;
    onChange();
    expect(input).toEqual({ disabled: true, required: false });
    // Back to Custom.
    custom.checked = true;
    onChange();
    expect(input).toEqual({ disabled: false, required: true });
  });

  it("hides the number input via CSS unless Custom is checked", async () => {
    const body = await (await SELF.fetch("https://example.com/")).text();
    expect(body).toContain("#custom-pick { display: none; }");
    expect(body).toContain("form:has(#pick-custom:checked) #custom-pick { display: flex; }");
  });

  describe("landing page design (DESIGN.md 2A)", () => {
    const get = async () => (await SELF.fetch("https://example.com/")).text();

    it("loads Archivo/Anton/JetBrains Mono and uses the palette tokens", async () => {
      const body = await get();
      for (const f of ["Archivo", "Anton", "JetBrains+Mono"]) expect(body).toContain(f);
      for (const c of ["#1F2F63", "#F4EFE6", "#D2432C", "#E3C26E", "#17140F"]) expect(body).toContain(c);
      expect(body).toContain("1.5px solid var(--ink)");
      expect(body).toContain("border-radius: 2px");
    });

    it("has marketing sections: hero, how it works, who it's for, bottom CTA band, footer", async () => {
      const body = await get();
      expect(body).toContain("Predict the jargon. Win the meeting.");
      expect(body).toContain('id="how"');
      expect(body).toContain("Three steps. One of them is a meeting.");
      expect(body).toContain("Coaches &amp; facilitators");
      expect(body).toContain("Free for a team. Branded for a coach.");
      expect(body).toContain("<footer");
    });

    it("puts exactly one zigzag directly above the Create Session button, and nowhere else", async () => {
      const body = await get();
      expect(body.match(/class="zig"/g)).toHaveLength(1);
      expect(body).toMatch(/class="zig"[^>]*><\/div>\s*<button type="submit" class="btn btn-red">Create Session<\/button>/);
    });

    it("styles the pick-count pills as a segmented control with 44px+ targets", async () => {
      const body = await get();
      expect(body).toContain(".pills .row { display: flex;");
      expect(body).toMatch(/\.pills span \{[^}]*min-height: 48px/);
      expect(body).toMatch(/\.pills input:checked \+ span \{ background: var\(--indigo\)/);
    });

    it("defines focus rings and is responsive without horizontal scroll", async () => {
      const body = await get();
      expect(body).toContain("box-shadow: 0 0 0 3px var(--ring)");
      expect(body).toContain("rgba(31,47,99,.12)");
      expect(body).toContain("0 0 0 4px var(--ring)");
      expect(body).toContain("a:focus-visible, button:focus-visible");
      expect(body).toContain("overflow-x: hidden");
      expect(body).toContain('name="viewport"');
      expect(body).toContain("@media (min-width: 900px)");
    });

    it("renders the error state in the new layout", async () => {
      const res = await createPreset("custom", "0");
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toContain('role="alert"');
      expect(body).toContain("Pick Count must be a positive whole number.");
      expect(body).toContain("New session");
    });
  });

  it("submits a preset pill's count directly, ignoring the number input", async () => {
    for (const n of [5, 10]) {
      const res = await createPreset(String(n), "abc");
      expect(res.status).toBe(201);
      const token = links(await res.text()).invite.split("/i/")[1]!;
      const row = await env.DB.prepare("SELECT pick_count FROM sessions WHERE invite_link_token = ?")
        .bind(token)
        .first<{ pick_count: number }>();
      expect(row!.pick_count).toBe(n);
    }
  });

  it("Custom preset validates the number input like before", async () => {
    expect((await createPreset("custom", "13")).status).toBe(201);
    for (const n of ["0", "-3", "2.5", "abc", ""]) {
      expect((await createPreset("custom", n)).status).toBe(400);
    }
  });

  it("treats an unknown preset value as Custom and validates the number input", async () => {
    expect((await createPreset("9", "")).status).toBe(400);
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
