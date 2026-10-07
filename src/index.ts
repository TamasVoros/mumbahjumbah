import { Hono } from "hono";
import { html } from "hono/html";
import { saveGrid, validateGrid } from "./grids";
import { getLeaderboard } from "./leaderboard";
import { renderRecapPng } from "./recap";
import { getJargonResult, processTranscript } from "./jargon";
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

const PICK_PRESETS = ["5", "10"] as const;

// Pills are radio inputs, so the form works without JS; :has() reveals the custom field only for Custom.
const createForm = (error?: string) =>
  page(
    "Create a Session",
    html`<h1>Create a Session</h1>
      <style>
        .pills { --indigo: #1F2F63; border: 0; padding: 0; display: flex; gap: 8px; }
        .pills label { cursor: pointer; position: relative; }
        .pills input { position: absolute; opacity: 0; }
        .pills span { display: inline-block; min-height: 44px; line-height: 44px; padding: 0 18px; border: 1.5px solid var(--indigo); border-radius: 99px; }
        .pills input:checked + span { background: var(--indigo); color: #fff; }
        .pills input:focus-visible + span { outline: 2px solid var(--indigo); outline-offset: 2px; }
        #custom-pick { display: none; }
        form:has(#pick-custom:checked) #custom-pick { display: block; }
      </style>
      ${error ? html`<p role="alert">${error}</p>` : ""}
      <form method="post" action="/sessions">
        <fieldset class="pills">
          <legend>Pick Count</legend>
          <label><input type="radio" name="pick_preset" id="pick-custom" value="custom" checked /><span>Custom</span></label>
          ${PICK_PRESETS.map(
            (n) => html`<label><input type="radio" name="pick_preset" value="${n}" /><span>${n}</span></label>`,
          )}
        </fieldset>
        <label id="custom-pick">Any positive whole number, e.g. 9 or 25
          <input type="number" name="pick_count" min="1" step="1" value="9" />
        </label>
        <button type="submit">Create Session</button>
      </form>
      <script>
        // Only the Custom number input takes part in validation and submission; for 5/10 it is disabled,
        // so a stale invalid value in the hidden field can never block a preset submit.
        (function () {
          var form = document.querySelector('form[action="/sessions"]');
          var input = form.querySelector('input[name="pick_count"]');
          function sync() {
            var custom = form.querySelector("#pick-custom").checked;
            input.disabled = !custom;
            input.required = custom;
          }
          form.addEventListener("change", sync);
          sync();
        })();
      </script>`,
  );

app.get("/", (c) => c.html(createForm()));

app.post("/sessions", async (c) => {
  const form = await c.req.parseBody();
  // A preset pill supplies the count directly; Custom (or no preset) reads the number input.
  // Either way the value goes through the same parsePickCount validation.
  const preset = form["pick_preset"];
  const raw =
    typeof preset === "string" && (PICK_PRESETS as readonly string[]).includes(preset) ? preset : form["pick_count"];
  const pickCount = parsePickCount(raw);
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
    html`<h1>Session ${session.id} is locked</h1><p>The Organizer has locked this Session, so Grids can no longer be submitted or changed.</p>
      <p><a href="/i/${session.invite_link_token}/leaderboard">View the leaderboard</a> | <a href="/i/${session.invite_link_token}/recap.png">Recap Card (PNG)</a></p>`,
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

const organizerView = async (db: D1Database, session: Session, token: string, message?: { error?: string; ok?: string }) => {
  const count = await countParticipants(db, session.id);
  const jargon = session.locked_at ? await getJargonResult(db, session.id) : [];
  return page(
    "Organizer",
    html`<h1>Organizer: Session ${session.id}</h1>
      <p>Pick Count: ${session.pick_count}</p>
      <p>Participants: ${count}</p>
      ${session.locked_at ? html`<p><a href="/o/${token}/leaderboard">View the leaderboard</a> | <a href="/o/${token}/recap.png">Recap Card (PNG)</a></p>` : ""}
      ${message?.error ? html`<p role="alert">${message.error}</p>` : ""}
      ${message?.ok ? html`<p role="status">${message.ok}</p>` : ""}
      ${session.locked_at
        ? html`<p>This Session is locked (since ${session.locked_at} UTC). No further Grids are accepted.</p>
            <h2>Upload Transcript</h2>
            <p>Upload a .txt or .vtt file. It is read in memory and discarded; only counts for words and phrases Participants picked are kept. Uploading again replaces the previous Jargon Result.</p>
            <form method="post" action="/o/${token}/transcript" enctype="multipart/form-data">
              <input type="file" name="transcript" accept=".txt,.vtt" required />
              <button type="submit">Upload Transcript</button>
            </form>
            <h2>Jargon Result</h2>
            ${jargon.length === 0
              ? html`<p>No Jargon Result yet (or no picked term was said).</p>`
              : html`<table>
                  <thead><tr><th>Term</th><th>Occurrences</th></tr></thead>
                  <tbody>
                    ${jargon.map((j) => html`<tr><td>${j.term}</td><td>${j.occurrences}</td></tr>`)}
                  </tbody>
                </table>`}`
        : html`<form method="post" action="/o/${token}/lock"><button type="submit">Lock Session</button></form>
            <p>Lock the Session to upload a Transcript.</p>`}`,
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

// Only an Organizer Link token can upload; the Session must be locked first (picks are final).
app.post("/o/:token/transcript", async (c) => {
  const token = c.req.param("token");
  const session = await findByOrganizerToken(c.env.DB, token);
  if (!session) return c.html(page("Not found", html`<h1>Session not found</h1>`), 404);
  if (!session.locked_at) {
    return c.html(
      await organizerView(c.env.DB, session, token, { error: "Lock the Session before uploading a Transcript." }),
      409,
    );
  }
  let file: unknown;
  try {
    file = (await c.req.parseBody())["transcript"];
  } catch {
    return c.html(await organizerView(c.env.DB, session, token, { error: "Could not read the upload." }), 400);
  }
  const res = await processTranscript(c.env.DB, session.id, file);
  if (!res.ok) return c.html(await organizerView(c.env.DB, session, token, { error: res.error }), 400);
  return c.html(await organizerView(c.env.DB, session, token, { ok: "Transcript processed and discarded. Jargon Result updated." }));
});

const leaderboardPage = async (db: D1Database, session: Session, recapUrl: string) => {
  const [board, jargon] = await Promise.all([getLeaderboard(db, session.id), getJargonResult(db, session.id)]);
  return page(
    "Leaderboard",
    html`<h1>Leaderboard: Session ${session.id}</h1>
      <p><a id="recap-link" href="${recapUrl}">Recap Card (shareable PNG)</a></p>
      ${jargon.length === 0
        ? html`<p>No Jargon Result yet (or no picked term was said), so everyone is at 0 for now.</p>`
        : ""}
      ${board.length === 0
        ? html`<p>No Grids were submitted.</p>`
        : html`<table>
            <thead><tr><th>Rank</th><th>Participant</th><th>Score</th></tr></thead>
            <tbody>
              ${board.map((e) => html`<tr><td>${e.rank}</td><td>${e.displayName}</td><td>${e.score}</td></tr>`)}
            </tbody>
          </table>`}`,
  );
};

const notLocked = () =>
  page("Leaderboard not ready", html`<h1>Leaderboard not ready</h1><p>The leaderboard appears once the Organizer has locked the Session and uploaded a Transcript.</p>`);

// Each route resolves only its own token type, so neither link grants the other's capabilities.
app.get("/i/:token/leaderboard", async (c) => {
  const session = await findByInviteToken(c.env.DB, c.req.param("token"));
  if (!session) return c.html(page("Not found", html`<h1>Session not found</h1>`), 404);
  if (!session.locked_at) return c.html(notLocked(), 409);
  return c.html(await leaderboardPage(c.env.DB, session, `/i/${session.invite_link_token}/recap.png`));
});

app.get("/o/:token/leaderboard", async (c) => {
  const session = await findByOrganizerToken(c.env.DB, c.req.param("token"));
  if (!session) return c.html(page("Not found", html`<h1>Session not found</h1>`), 404);
  if (!session.locked_at) return c.html(notLocked(), 409);
  return c.html(await leaderboardPage(c.env.DB, session, `/o/${session.organizer_link_token}/recap.png`));
});

const recap = async (db: D1Database, session: Session) => {
  const [board, jargon] = await Promise.all([getLeaderboard(db, session.id), getJargonResult(db, session.id)]);
  const png = await renderRecapPng(board, jargon);
  return new Response(png, { headers: { "content-type": "image/png", "cache-control": "no-store" } });
};

// Token-scoped (not /sessions/:id) so the image is as unguessable as the leaderboard pages.
app.get("/i/:token/recap.png", async (c) => {
  const session = await findByInviteToken(c.env.DB, c.req.param("token"));
  if (!session) return c.html(page("Not found", html`<h1>Session not found</h1>`), 404);
  if (!session.locked_at) return c.html(notLocked(), 409);
  return recap(c.env.DB, session);
});

app.get("/o/:token/recap.png", async (c) => {
  const session = await findByOrganizerToken(c.env.DB, c.req.param("token"));
  if (!session) return c.html(page("Not found", html`<h1>Session not found</h1>`), 404);
  if (!session.locked_at) return c.html(notLocked(), 409);
  return recap(c.env.DB, session);
});

export default app;
