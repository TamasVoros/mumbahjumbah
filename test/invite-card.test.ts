import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSession as createUnnamed } from "../src/sessions";
import { createSession } from "./helpers";
import { qrSvg } from "../src/qr";

const get = (path: string) => SELF.fetch(`https://example.com${path}`);

describe("organizer invite card", () => {
  it("is hidden until the session has a name", async () => {
    const s = await createUnnamed(env.DB, 3);
    const body = await (await get(`/o/${s.organizer_link_token}`)).text();
    expect(body).not.toContain('class="invite__qr"');
    expect(body).not.toContain("invite-qr.svg");
    expect((await get(`/o/${s.organizer_link_token}/invite-qr.svg`)).status).toBe(404);
  });

  it("shows QR, URL, copy and download once named, with no external requests", async () => {
    const s = await createSession(env.DB, 3);
    const invite = `https://example.com/i/${s.invite_link_token}`;
    const body = await (await get(`/o/${s.organizer_link_token}`)).text();
    expect(body).toContain('class="invite"');
    expect(body).toContain(qrSvg(invite));
    expect(body).toContain(`id="invite-link" href="${invite}"`);
    expect(body).toContain(`data-copy="${invite}"`);
    expect(body).toContain(`href="/o/${s.organizer_link_token}/invite-qr.svg" download`);
    expect(body).not.toMatch(/<(img|script|link)[^>]+(src|href)="https?:\/\/(?!example\.com)/);
  });

  it("serves the QR as a downloadable SVG for the organizer only", async () => {
    const s = await createSession(env.DB, 3);
    const res = await get(`/o/${s.organizer_link_token}/invite-qr.svg`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(await res.text()).toBe(qrSvg(`https://example.com/i/${s.invite_link_token}`));
    expect((await get(`/o/${s.invite_link_token}/invite-qr.svg`)).status).toBe(403);
  });
});
