import { Hono } from "hono";
import { html } from "hono/html";
import { saveGrid, validateGrid } from "./grids";
import {
  countParticipants,
  createSession,
  findByInviteToken,
  findByOrganizerToken,
  lockSession,
  parsePickCount,
  type Session,
} from "./sessions";

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

const lockedPage = (session: Session) =>
  page(
    "Session locked",
    html`<h1>Session ${session.id} is locked</h1><p>The Organizer has locked this Session, so Grids can no longer be submitted or changed.</p>`,
  );

type FormValues = { email?: string; display_name?: string; picks?: string[] };

const gridForm = (pickCount: number, v: FormValues = {}, error?: string) =>
  html`<h1>Submit your Grid</h1>
    <p>Predict ${pickCount} words or phrases you expect to hear. Each must be different.</p>
    ${error ? html`<p role="alert">${error}</p>` : ""}
    <form method="post">
      <label>Email <input type="email" name="email" value="${v.email ?? ""}" required /></label>
      <label>Display Name <input type="text" name="display_name" value="${v.display_name ?? ""}" required /></label>
      <ol>
        ${Array.from(
          { length: pickCount },
          (_, i) => html`<li><input type="text" name="pick" value="${v.picks?.[i] ?? ""}" required /></li>`,
        )}
      </ol>
      <button type="submit">Submit Grid</button>
    </form>`;

app.get("/i/:token", async (c) => {
  const session = await findByInviteToken(c.env.DB, c.req.param("token"));
  if (!session) return c.html(page("Not found", html`<h1>Session not found</h1>`), 404);
  if (session.locked_at) return c.html(lockedPage(session), 403);
  return c.html(page(`Session ${session.id}`, html`<p>Session ${session.id}</p>${gridForm(session.pick_count)}`));
});

app.post("/i/:token", async (c) => {
  const session = await findByInviteToken(c.env.DB, c.req.param("token"));
  if (!session) return c.html(page("Not found", html`<h1>Session not found</h1>`), 404);
  if (session.locked_at) return c.html(lockedPage(session), 403);
  const raw = await c.req.parseBody({ all: true });
  const result = validateGrid(raw, session.pick_count);
  if (!result.ok) {
    const picks = [raw["pick"]].flat().filter((p): p is string => typeof p === "string");
    const values = {
      email: typeof raw["email"] === "string" ? raw["email"] : "",
      display_name: typeof raw["display_name"] === "string" ? raw["display_name"] : "",
      picks,
    };
    return c.html(
      page(`Session ${session.id}`, html`<p>Session ${session.id}</p>${gridForm(session.pick_count, values, result.error)}`),
      400,
    );
  }
  await saveGrid(c.env.DB, session.id, result.value);
  return c.html(
    page(
      "Grid submitted",
      html`<h1>Grid submitted</h1>
        <p>Thanks, ${result.value.displayName}. Your ${session.pick_count} picks are saved. Resubmit with the same email to change them.</p>
        <p><a href="">Edit your Grid</a></p>`,
    ),
  );
});

const organizerView = async (db: D1Database, session: Session, token: string) => {
  const count = await countParticipants(db, session.id);
  return page(
    "Organizer",
    html`<h1>Organizer: Session ${session.id}</h1>
      <p>Pick Count: ${session.pick_count}</p>
      <p>Participants: ${count}</p>
      ${session.locked_at
        ? html`<p>This Session is locked (since ${session.locked_at} UTC). No further Grids are accepted.</p>`
        : html`<form method="post" action="/o/${token}/lock"><button type="submit">Lock Session</button></form>`}`,
  );
};

app.get("/o/:token", async (c) => {
  const token = c.req.param("token");
  const session = await findByOrganizerToken(c.env.DB, token);
  if (!session) return c.html(page("Not found", html`<h1>Session not found</h1>`), 404);
  return c.html(await organizerView(c.env.DB, session, token));
});

// Only an Organizer Link token can lock; Invite Link tokens never match here.
app.post("/o/:token/lock", async (c) => {
  const token = c.req.param("token");
  const session = await lockSession(c.env.DB, token);
  if (!session) return c.html(page("Not found", html`<h1>Session not found</h1>`), 404);
  return c.html(await organizerView(c.env.DB, session, token));
});

export default app;
