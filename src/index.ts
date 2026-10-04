import { Hono } from "hono";
import { html } from "hono/html";
import { createSession, findByInviteToken, findByOrganizerToken, parsePickCount } from "./sessions";

export type Bindings = { DB: D1Database };

export const app = new Hono<{ Bindings: Bindings }>();

const page = (title: string, body: unknown) => html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body>
    ${body}
  </body>
</html>`;

app.get("/health", async (c) => {
  await c.env.DB.prepare("SELECT 1").first();
  return c.json({ status: "ok" });
});

const createForm = (error?: string) =>
  page(
    "Create a Session",
    html`<h1>Create a Session</h1>
      ${error ? html`<p role="alert">${error}</p>` : ""}
      <form method="post" action="/sessions">
        <label>Pick Count (any positive whole number, e.g. 9 or 25)
          <input type="number" name="pick_count" min="1" step="1" value="9" required />
        </label>
        <button type="submit">Create Session</button>
      </form>`,
  );

app.get("/", (c) => c.html(createForm()));

app.post("/sessions", async (c) => {
  const form = await c.req.parseBody();
  const pickCount = parsePickCount(form["pick_count"]);
  if (pickCount === null) {
    return c.html(createForm("Pick Count must be a positive whole number."), 400);
  }
  const session = await createSession(c.env.DB, pickCount);
  const origin = new URL(c.req.url).origin;
  const invite = `${origin}/i/${session.invite_link_token}`;
  const organizer = `${origin}/o/${session.organizer_link_token}`;
  return c.html(
    page(
      "Session created",
      html`<h1>Session created</h1>
        <p>Pick Count: ${session.pick_count}</p>
        <p>Invite Link (share with Participants): <a id="invite-link" href="${invite}">${invite}</a></p>
        <p>Organizer Link (keep private): <a id="organizer-link" href="${organizer}">${organizer}</a></p>`,
    ),
    201,
  );
});

// Placeholders: real behavior arrives in Slices 2 (Invite Link) and 3 (Organizer Link).
app.get("/i/:token", async (c) => {
  const session = await findByInviteToken(c.env.DB, c.req.param("token"));
  if (!session) return c.html(page("Not found", html`<h1>Session not found</h1>`), 404);
  return c.html(page("Session", html`<h1>Session ${session.id}</h1><p>Pick Count: ${session.pick_count}</p>`));
});

app.get("/o/:token", async (c) => {
  const session = await findByOrganizerToken(c.env.DB, c.req.param("token"));
  if (!session) return c.html(page("Not found", html`<h1>Session not found</h1>`), 404);
  return c.html(
    page("Organizer", html`<h1>Organizer: Session ${session.id}</h1><p>Pick Count: ${session.pick_count}</p>`),
  );
});

export default app;
