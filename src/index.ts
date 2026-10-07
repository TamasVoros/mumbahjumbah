import { Hono, type Context } from "hono";
import { html, raw } from "hono/html";
import { errorCard, shell as uiShell } from "./ui/components";
import { saveGrid, validateGrid } from "./grids";
import { entryView, lockedView, submittedView } from "./player-ui";
import { getLeaderboard } from "./leaderboard";
import { plansPage } from "./plans";
import { renderRecapPng } from "./recap";
import { organizerView } from "./organizer";
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

const ZIGZAG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M0 12L8 4L16 12' fill='none' stroke='%23D2432C' stroke-width='2.5'/%3E%3C/svg%3E\")";

// Shared stylesheet (DESIGN.md direction 2A). Server-rendered and inline: no frontend framework.
const CSS = `
:root { --indigo:#1F2F63; --bone:#F4EFE6; --paper:#fff; --ink:#17140F; --muted:#5F5648; --placeholder:#8A8070; --red:#D2432C; --red-hover:#8F2B22; --raffia:#E3C26E; --ring:rgba(31,47,99,.12); }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--bone); color: var(--ink); font: 400 15px/1.5 Archivo, system-ui, sans-serif; overflow-x: hidden; }
h1, h2, h3, p { margin: 0; }
a { color: var(--red); }
a:hover { color: var(--red-hover); }
a:focus-visible, button:focus-visible { outline: 2px solid var(--indigo); outline-offset: 2px; }
.on-indigo a:focus-visible { outline-color: var(--raffia); }
.mono { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.mono.accent { color: var(--raffia); }
.wrap { padding-left: 24px; padding-right: 24px; }
.container { max-width: 1120px; margin: 0 auto; }
.hero { background: var(--indigo); color: var(--bone); padding-bottom: 32px; }
.nav { display: flex; align-items: center; justify-content: space-between; padding-top: 20px; }
.brand { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 17px; color: inherit; text-decoration: none; }
.brand:hover { color: inherit; }
.hero-grid { display: grid; gap: 28px; margin-top: 22px; }
.hero-copy { display: flex; flex-direction: column; gap: 14px; }
.hero h1 { font-weight: 800; font-size: 32px; line-height: 1.05; letter-spacing: -.01em; }
.hero-copy p { font-size: 15px; color: var(--bone); }
.hero-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
.btn { display: block; border-radius: 2px; padding: 15px; text-align: center; font: 700 16px/1.3 Archivo, system-ui, sans-serif; text-decoration: none; cursor: pointer; border: 1.5px solid transparent; min-height: 48px; }
.btn-red { background: var(--red); color: #fff; width: 100%; }
.btn-red:hover { color: #fff; background: var(--red-hover); }
.btn-outline { border-color: var(--ink); color: var(--ink); }
.btn-outline:hover { color: var(--ink); }
.btn-bone { border-color: var(--bone); color: var(--bone); }
.btn-bone:hover { color: var(--bone); }
.card { background: var(--paper); color: var(--ink); border: 1.5px solid var(--ink); border-radius: 2px; overflow: hidden; }
.card-body { padding: 24px 20px; display: flex; flex-direction: column; gap: 22px; }
.card h2 { font-weight: 800; font-size: 26px; line-height: 1.1; }
.hint { font-size: 13px; line-height: 1.45; color: var(--muted); }
.error { border: 1.5px solid var(--red); border-radius: 2px; padding: 12px 14px; font-weight: 600; }
.pills { border: 0; padding: 0; margin: 0; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.pills legend { padding: 0; font-size: 14px; font-weight: 700; margin-bottom: 8px; }
.pills .row { display: flex; gap: 8px; }
.pills label { flex: 1; cursor: pointer; position: relative; display: block; }
.pills input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
.pills span { display: block; text-align: center; min-height: 48px; line-height: 45px; padding: 0 8px; border: 1.5px solid var(--ink); border-radius: 2px; background: var(--paper); font-weight: 700; }
.pills input:checked + span { background: var(--indigo); border-color: var(--indigo); color: #fff; }
.pills input:focus-visible + span { border-color: var(--indigo); box-shadow: 0 0 0 3px var(--ring), 0 0 0 5px var(--indigo); }
#custom-pick { display: none; }
form:has(#pick-custom:checked) #custom-pick { display: flex; }
.field { display: flex; flex-direction: column; gap: 8px; font-size: 14px; font-weight: 700; }
.field input { font: 400 15px Archivo, system-ui, sans-serif; background: var(--paper); border: 1.5px solid var(--ink); border-radius: 2px; padding: 13px 14px; min-height: 52px; width: 100%; color: var(--ink); }
.field input::placeholder { color: var(--placeholder); }
.field input:focus { outline: none; border-color: var(--indigo); box-shadow: 0 0 0 3px var(--ring); }
.zig { height: 16px; background: ${ZIGZAG} repeat-x; margin: 0 -20px 8px; }
.section { padding-top: 40px; padding-bottom: 8px; display: flex; flex-direction: column; gap: 24px; }
.steps { display: flex; flex-direction: column; gap: 24px; }
.step { display: flex; gap: 14px; }
.step .n { font: 400 26px/1 Anton, Impact, sans-serif; color: var(--indigo); width: 22px; flex: none; }
.step h3 { font-weight: 700; font-size: 15px; }
.step p { font-size: 13px; line-height: 1.45; color: var(--muted); margin-top: 3px; }
.who { padding-top: 32px; padding-bottom: 32px; display: flex; flex-direction: column; gap: 14px; }
.who .card { padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.who h3 { font-weight: 800; font-size: 17px; }
.who p { font-size: 13px; line-height: 1.45; color: var(--muted); }
.band { background: var(--raffia); padding-top: 32px; padding-bottom: 32px; }
.band .container { display: flex; flex-direction: column; gap: 14px; }
.band h2 { font-weight: 800; font-size: 24px; line-height: 1.15; }
.band .actions { display: flex; gap: 10px; flex-wrap: wrap; }
.band .btn { padding: 13px 18px; font-size: 15px; width: auto; }
.foot { display: flex; justify-content: space-between; gap: 12px; padding-top: 20px; padding-bottom: 28px; font-size: 12px; color: var(--muted); }
.plain { padding-top: 32px; padding-bottom: 32px; max-width: 720px; margin: 0 auto; }
@media (min-width: 900px) {
  .wrap { padding-left: 80px; padding-right: 80px; }
  .nav { height: 88px; padding-top: 0; }
  .brand { font-size: 20px; gap: 10px; }
  .hero { padding-bottom: 88px; }
  .hero-grid { grid-template-columns: 1.15fr 1fr; gap: 80px; align-items: center; margin-top: 40px; }
  .hero-copy { gap: 22px; }
  .hero h1 { font-size: 68px; line-height: 1.02; letter-spacing: -.02em; }
  .hero-copy p { font-size: 19px; max-width: 520px; }
  .hero-actions { flex-direction: row; gap: 14px; margin-top: 10px; }
  .hero .btn { width: auto; padding: 17px 32px; font-size: 17px; }
  .mono.accent { font-size: 13px; }
  .card-body { padding: 36px 36px 28px; gap: 24px; }
  .card h2 { font-size: 32px; }
  .zig { margin: 0 -36px 8px; }
  .field input { font-size: 16px; }
  .pills .row { gap: 10px; }
  .field input:focus { box-shadow: 0 0 0 4px var(--ring); }
  .pills input:focus-visible + span { box-shadow: 0 0 0 4px var(--ring), 0 0 0 6px var(--indigo); }
  .section { padding: 80px 0; display: grid; grid-template-columns: 1fr 2fr; gap: 64px; }
  .section h2 { font-weight: 800; font-size: 34px; line-height: 1.1; margin-top: 12px; }
  .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
  .step { flex-direction: column; gap: 10px; }
  .step .n { font-size: 44px; width: auto; }
  .step h3 { font-size: 18px; }
  .step p { font-size: 14px; line-height: 1.5; margin-top: 0; }
  .who { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 0 0 80px; }
  .who .mono { grid-column: 1 / -1; }
  .who .card { padding: 32px; gap: 8px; }
  .who h3 { font-size: 24px; }
  .who p { font-size: 15px; line-height: 1.5; }
  .band { padding-top: 56px; padding-bottom: 56px; }
  .band .container { flex-direction: row; align-items: center; justify-content: space-between; }
  .band h2 { font-size: 34px; line-height: 1.1; }
  .band .btn { padding: 16px 28px; font-size: 16px; }
  .foot { padding-top: 28px; font-size: 13px; }
}
`;

const logo = (fill: string, cut: string, w: number, h: number) =>
  html`<svg width="${w}" height="${h}" viewBox="0 0 64 84" aria-hidden="true"><path d="M32 2C14 2 6 16 6 38c0 24 10 44 26 44s26-20 26-44C58 16 50 2 32 2Z" fill="${fill}"/><path d="M12 24L32 12L52 24" fill="none" stroke="${cut}" stroke-width="5"/><path d="M13 40L28 36L22 48Z" fill="${cut}"/><path d="M51 40L36 36L42 48Z" fill="${cut}"/><path d="M32 54L38 64L32 76L26 64Z" fill="${cut}"/></svg>`;

// Other pages get a plain readable column until they are restyled; the landing page is full-bleed (bare).
const page = (title: string, content: unknown, bare = false) => {
  const body = bare ? content : html`<main class="plain wrap">${content}</main>`;
  return shell(title, body);
};

const shell = (title: string, body: unknown) => html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap"
    />
    <style>
      ${raw(CSS)}
    </style>
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
    "MumbahJumbah: Predict the jargon. Win the meeting.",
    html`<header class="hero on-indigo">
        <div class="wrap">
          <div class="container">
            <nav class="nav" aria-label="Main">
              <a class="brand" href="/">${logo("#F4EFE6", "#1F2F63", 18, 24)}<span>MumbahJumbah</span></a>
            </nav>
            <div class="hero-grid">
              <div class="hero-copy">
                <div class="mono accent">Reverse bingo for meetings</div>
                <h1>Predict the jargon. Win the meeting.</h1>
                <p>Guess the buzzwords before the call. Get scored against the transcript after.</p>
                <div class="hero-actions">
                  <a class="btn btn-red" href="#new">Create a session</a>
                  <a class="btn btn-bone" href="#how">See how it works</a>
                </div>
              </div>
              <div class="card" id="new">
                <form method="post" action="/sessions" class="card-body">
                  <h2>New session</h2>
                  ${error ? html`<p class="error" role="alert">${error}</p>` : ""}
                  <fieldset class="pills">
                    <legend>Pick Count</legend>
                    <div class="row">
                      <label><input type="radio" name="pick_preset" id="pick-custom" value="custom" checked /><span>Custom</span></label>
                      ${PICK_PRESETS.map(
                        (n) => html`<label><input type="radio" name="pick_preset" value="${n}" /><span>${n}</span></label>`,
                      )}
                    </div>
                    <p class="hint">Each player submits exactly this many words or phrases.</p>
                  </fieldset>
                  <label class="field" id="custom-pick">Any positive whole number, e.g. 9 or 25
                    <input type="number" name="pick_count" min="1" step="1" value="9" inputmode="numeric" />
                  </label>
                  <div>
                    <div class="zig" aria-hidden="true"></div>
                    <button type="submit" class="btn btn-red">Create Session</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main>
        <section class="wrap" id="how">
          <div class="container section">
            <div>
              <div class="mono">How it works</div>
              <h2>Three steps. One of them is a meeting.</h2>
            </div>
            <div class="steps">
              <div class="step"><span class="n">1</span><div><h3>Create a session</h3><p>Pick how many words each player gets. Share the invite link.</p></div></div>
              <div class="step"><span class="n">2</span><div><h3>Everyone predicts</h3><p>Each player locks in their jargon picks before the call.</p></div></div>
              <div class="step"><span class="n">3</span><div><h3>Meeting, then scores</h3><p>Upload the transcript after. The leaderboard writes itself.</p></div></div>
            </div>
          </div>
        </section>
        <section class="wrap">
          <div class="container who">
            <div class="mono">Who it’s for</div>
            <div class="card"><h3>Teams</h3><p>A two-minute warm-up that makes the all-hands worth listening to.</p></div>
            <div class="card"><h3>Coaches &amp; facilitators</h3><p>Run it in your workshops, under your own brand and link.</p></div>
          </div>
        </section>
        <section class="band wrap">
          <div class="container">
            <h2>Free for a team. Branded for a coach.</h2>
            <div class="actions"><a class="btn btn-red" href="#new">Create a session</a></div>
          </div>
        </section>
      </main>
      <footer class="wrap"><div class="container foot"><span>© MumbahJumbah</span><span><a href="/plans">See plans</a> · Privacy · Terms</span></div></footer>
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
    true,
  );

app.get("/", (c) => c.html(createForm()));

app.get("/plans", (c) => c.html(plansPage()));

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

const errorCss = `
*{box-sizing:border-box}
body{margin:0;background:#F4EFE6;color:#17140F;font-family:'Archivo',system-ui,sans-serif;display:flex;justify-content:center;padding:32px 24px}
.error-card{width:100%;max-width:420px;border:1.5px solid #17140F;border-radius:2px;overflow:hidden;background:#F4EFE6;display:flex;flex-direction:column}
.error-card header{background:#1F2F63;color:#F4EFE6;padding:24px;display:flex;flex-direction:column;gap:6px}
.error-code{font-family:'Anton',sans-serif;font-size:56px;line-height:1;color:#E3C26E}
.error-card h1{margin:0;font-weight:800;font-size:20px;line-height:1.15;overflow-wrap:anywhere}
.error-body{padding:20px 24px 24px;display:flex;flex-direction:column;gap:16px}
.error-body p{margin:0;font-size:14px;line-height:1.5;color:#5F5648}
.error-actions{display:flex;flex-direction:column;gap:8px}
.error-action{display:block;min-height:44px;border:1.5px solid #17140F;border-radius:2px;padding:12px;text-align:center;font-weight:700;font-size:14px;background:#fff;color:#17140F;text-decoration:none}
.error-action:hover{color:#8F2B22}
`;

const errorPage = (
  title: string,
  code: string,
  headline: string,
  message: string,
  actions: { href: string; label: string }[],
) => html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;700;800&display=swap" rel="stylesheet" />
    <style>${raw(errorCss)}</style>
  </head>
  <body>
    <main class="error-card">
      <header><span class="error-code">${code}</span><h1>${headline}</h1></header>
      <div class="error-body">
        <p>${message}</p>
        <div class="error-actions">
          ${actions.map((a) => html`<a class="error-action" href="${a.href}">${a.label}</a>`)}
        </div>
      </div>
    </main>
  </body>
</html>`;

const notFoundPage = () =>
  errorPage(
    "Not found",
    "404",
    "That link doesn’t go anywhere.",
    "Either it was mistyped or the session was cleared. Ask your organizer for a fresh one.",
    [{ href: "/", label: "Back to start" }],
  );

app.get("/i/:token", async (c) => {
  const session = await findByInviteToken(c.env.DB, c.req.param("token"));
  if (!session) return c.html(notFoundPage(), 404);
  if (session.locked_at) return c.html(lockedView(session.id, session.invite_link_token), 403);
  return c.html(entryView(session.id, session.pick_count));
});

app.post("/i/:token", async (c) => {
  const session = await findByInviteToken(c.env.DB, c.req.param("token"));
  if (!session) return c.html(notFoundPage(), 404);
  if (session.locked_at) return c.html(lockedView(session.id, session.invite_link_token), 403);
  const raw = await c.req.parseBody({ all: true });
  const result = validateGrid(raw, session.pick_count);
  if (!result.ok) {
    const picks = [raw["pick"]].flat().filter((p): p is string => typeof p === "string");
    const values = {
      email: typeof raw["email"] === "string" ? raw["email"] : "",
      display_name: typeof raw["display_name"] === "string" ? raw["display_name"] : "",
      picks,
    };
    return c.html(entryView(session.id, session.pick_count, values, result.error), 400);
  }
  // Design decision (#18): mockup 8A's 409 "duplicate email" screen is intentionally NOT implemented.
  // Resubmitting under the same email is a deliberate edit/upsert, not an error.
  await saveGrid(c.env.DB, session.id, result.value);
  return c.html(submittedView(session.id, result.value.email, result.value.displayName, result.value.picks));
});

const organizersOnlyPage = (inviteToken: string) =>
  uiShell(
    "Organizers only",
    errorCard("403", "Organizers only.", raw("This page needs the private organizer link. The invite link won't open it."), {
      href: `/i/${inviteToken}`,
      label: "Use the invite link",
    }),
  );

// Organizer routes: an Invite Link token where the Organizer Link is required is a 403 (wrong link type);
// any other unknown token stays a 404. Distinct from the locked-Session 403 on the invite routes.
const organizerMissing = async (c: Context<{ Bindings: Bindings }>, token: string) => {
  const invited = await findByInviteToken(c.env.DB, token);
  return invited
    ? c.html(organizersOnlyPage(invited.invite_link_token), 403)
    : c.html(notFoundPage(), 404);
};

app.get("/o/:token", async (c) => {
  const token = c.req.param("token");
  const session = await findByOrganizerToken(c.env.DB, token);
  if (!session) return organizerMissing(c, token);
  return c.html(await organizerView(c.env.DB, session, token, new URL(c.req.url).origin));
});

// Only an Organizer Link token can lock; Invite Link tokens never match here.
app.post("/o/:token/lock", async (c) => {
  const token = c.req.param("token");
  const session = await lockSession(c.env.DB, token);
  if (!session) return organizerMissing(c, token);
  return c.html(await organizerView(c.env.DB, session, token, new URL(c.req.url).origin));
});

// Only an Organizer Link token can upload; the Session must be locked first (picks are final).
app.post("/o/:token/transcript", async (c) => {
  const token = c.req.param("token");
  const session = await findByOrganizerToken(c.env.DB, token);
  if (!session) return organizerMissing(c, token);
  if (!session.locked_at) {
    return c.html(
      await organizerView(c.env.DB, session, token, new URL(c.req.url).origin, { error: "Lock the Session before uploading a Transcript." }),
      409,
    );
  }
  let file: unknown;
  try {
    const form = await c.req.parseBody();
    file = form["transcript"];
    // Pasted text is treated exactly like an uploaded .txt; a chosen file wins over pasted text.
    const pasted = form["transcript_text"];
    if (!(file instanceof File && file.size > 0) && typeof pasted === "string" && pasted.trim()) {
      file = new File([pasted], "pasted.txt");
    }
  } catch {
    return c.html(await organizerView(c.env.DB, session, token, new URL(c.req.url).origin, { error: "Could not read the upload." }), 400);
  }
  const res = await processTranscript(c.env.DB, session.id, file);
  if (!res.ok) return c.html(await organizerView(c.env.DB, session, token, new URL(c.req.url).origin, { error: res.error }), 400);
  return c.html(await organizerView(c.env.DB, session, token, new URL(c.req.url).origin, { ok: "Transcript processed and discarded. Jargon Result updated." }));
});

const LEADERBOARD_CSS = `
*{box-sizing:border-box}
body{margin:0;background:#F4EFE6;color:#17140F;font:400 15px/1.5 Archivo,system-ui,sans-serif}
a{color:#1F2F63}a:hover{color:#8F2B22}
a:focus-visible{outline:none;border-radius:2px;box-shadow:0 0 0 1.5px #1F2F63,0 0 0 4.5px rgba(31,47,99,.12)}
.lb-page{display:flex;flex-direction:column;min-height:100vh}
.lb-jargon,.lb-board{padding:32px 24px;min-width:0}
.lb-board{background:#1F2F63;color:#F4EFE6}
.mono{font:400 11px/1.4 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#5F5648}
.lb-board .mono{color:#E3C26E}
h1,h2{font-weight:800;line-height:1.1;margin:6px 0 16px;overflow-wrap:anywhere}
h1{font-size:26px}h2{font-size:22px}
.lb-board a{color:#F4EFE6}
.lb-board a:focus-visible{box-shadow:0 0 0 1.5px #F4EFE6,0 0 0 4.5px rgba(244,239,230,.35)}
.note{font-size:13px;color:#5F5648;margin:0 0 16px}
.words{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.words li{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:46px;padding:0 14px;background:#fff;border:1.5px solid #17140F;border-radius:2px;overflow:hidden}
.words li>*{position:relative}
.words li::before{content:"";position:absolute;inset:0 auto 0 0;width:var(--w);background:#ECE4D2}
.words li.top::before{background:#E3C26E}
.words b{font-weight:600;overflow-wrap:anywhere}
.words .x{font:400 20px/1 Anton,Impact,sans-serif}
.words .n{font:400 11px "JetBrains Mono",monospace;color:#5F5648;margin-right:10px}
.rows{width:100%;border:0;border-collapse:collapse}
.rows tbody{display:flex;flex-direction:column;gap:8px}
.rows .row{position:relative;display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:8px;min-height:38px;padding:0 14px;background:#172352;border:1.5px solid #3C4E8A;border-radius:2px;overflow:hidden}
.rows .row>td{position:relative;min-width:0;padding:0}
.rows .row::before{content:"";position:absolute;inset:0 auto 0 0;width:var(--w);background:#2B3F7A}
.rows .row.podium{border-color:#E3C26E}
.rows .row.podium::before{background:#7A6A3A}
.rows .row.winner{background:#E3C26E;border-color:#E3C26E;color:#17140F;min-height:84px;padding:14px 16px;grid-template-columns:56px 1fr auto;gap:16px}
.rows .row.winner::before{display:none}
.rk-n{font:400 12px "JetBrains Mono",monospace;opacity:.7}
.podium .rk-n{font:400 22px Anton,Impact,sans-serif;color:#E3C26E;opacity:1}
.winner .rk-n{font:400 56px/1 Anton,Impact,sans-serif;color:#17140F;opacity:1}
.nm-c{font-weight:600;font-size:14px;overflow-wrap:anywhere}
.winner .nm-c{font-weight:800;font-size:20px}
.winner .nm-c::before{content:"Top predictor";display:block;font:400 10px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase}
.sc-c{font:400 18px Anton,Impact,sans-serif}
.winner .sc-c{font-size:44px;line-height:1}
.recap{display:inline-flex;align-items:center;min-height:44px;margin-top:20px;padding:0 18px;border:1.5px solid #F4EFE6;border-radius:2px;font-weight:700;text-decoration:none}
.sr{position:absolute;left:-9999px}
@media(min-width:900px){
.lb-page{flex-direction:row}
.lb-jargon{flex:1;padding:64px}
.lb-board{flex:0 0 520px;padding:64px}
h1{font-size:34px}
a:focus-visible{box-shadow:0 0 0 1.5px #1F2F63,0 0 0 5.5px rgba(31,47,99,.12)}
.lb-board a:focus-visible{box-shadow:0 0 0 1.5px #F4EFE6,0 0 0 5.5px rgba(244,239,230,.35)}
.rows .row{min-height:46px}
.rows .row.winner{min-height:84px}
.sc-c{font-size:22px}
.winner .sc-c{font-size:44px}
}
`;

const leaderboardPage = async (db: D1Database, session: Session, recapUrl: string) => {
  const [board, jargon] = await Promise.all([getLeaderboard(db, session.id), getJargonResult(db, session.id)]);
  const maxWord = Math.max(1, ...jargon.map((j) => j.occurrences));
  const topScore = Math.max(1, ...board.map((e) => e.score));
  return html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Leaderboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;600;700;800&family=JetBrains+Mono&display=swap" rel="stylesheet" />
    <style>${raw(LEADERBOARD_CSS)}</style>
  </head>
  <body>
    <main class="lb-page">
      <section class="lb-jargon" aria-labelledby="jargon-h">
        <div class="mono">Results · Jargon</div>
        <h2 id="jargon-h">What was actually said</h2>
        ${jargon.length === 0
          ? html`<p class="note">No Jargon Result yet (or no picked term was said), so everyone is at 0 for now.</p>`
          : html`<ul class="words">
              ${jargon.map(
                (j, i) =>
                  html`<li class="${i === 0 ? "top" : ""}" style="--w:${Math.round((j.occurrences / maxWord) * 100)}%"><b>${j.term}</b><span><span class="n">${j.occurrences} picked</span><span class="x">×${j.occurrences}</span></span></li>`,
              )}
            </ul>`}
      </section>
      <section class="lb-board" aria-labelledby="lb-h">
        <div class="mono">Session ${session.id}</div>
        <h1 id="lb-h">Leaderboard: Session ${session.id}</h1>
        ${board.length === 0
          ? html`<p>No Grids were submitted.</p>`
          : html`<table class="rows" role="table">
              <thead class="sr"><tr><th>Rank</th><th>Participant</th><th>Score</th></tr></thead>
              <tbody role="rowgroup">
                ${board.map(
                  (e) =>
                    html`<tr class="row${e.rank === 1 ? " winner" : e.rank <= 3 ? " podium" : ""}" role="row" style="--w:${Math.round((e.score / topScore) * 100)}%"><td class="rk-n">${e.rank}</td><td class="nm-c">${e.displayName}</td><td class="sc-c">${e.score}</td></tr>`,
                )}
              </tbody>
            </table>`}
        <a id="recap-link" class="recap" href="${recapUrl}">Recap Card (shareable PNG)</a>
      </section>
    </main>
  </body>
</html>`;
};

const notLocked = () =>
  page("Leaderboard not ready", html`<h1>Leaderboard not ready</h1><p>The leaderboard appears once the Organizer has locked the Session and uploaded a Transcript.</p>`);

// Each route resolves only its own token type, so neither link grants the other's capabilities.
app.get("/i/:token/leaderboard", async (c) => {
  const session = await findByInviteToken(c.env.DB, c.req.param("token"));
  if (!session) return c.html(notFoundPage(), 404);
  if (!session.locked_at) return c.html(notLocked(), 409);
  return c.html(await leaderboardPage(c.env.DB, session, `/i/${session.invite_link_token}/recap.png`));
});

app.get("/o/:token/leaderboard", async (c) => {
  const token = c.req.param("token");
  const session = await findByOrganizerToken(c.env.DB, token);
  if (!session) return organizerMissing(c, token);
  if (!session.locked_at) return c.html(notLocked(), 409);
  return c.html(await leaderboardPage(c.env.DB, session, `/o/${session.organizer_link_token}/recap.png`));
});

const recap = async (db: D1Database, session: Session) => {
  const [board, jargon] = await Promise.all([getLeaderboard(db, session.id), getJargonResult(db, session.id)]);
  const png = await renderRecapPng(board, jargon);
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "no-store" } });
};

// Token-scoped (not /sessions/:id) so the image is as unguessable as the leaderboard pages.
app.get("/i/:token/recap.png", async (c) => {
  const session = await findByInviteToken(c.env.DB, c.req.param("token"));
  if (!session) return c.html(notFoundPage(), 404);
  if (!session.locked_at) return c.html(notLocked(), 409);
  return recap(c.env.DB, session);
});

app.get("/o/:token/recap.png", async (c) => {
  const token = c.req.param("token");
  const session = await findByOrganizerToken(c.env.DB, token);
  if (!session) return organizerMissing(c, token);
  if (!session.locked_at) return c.html(notLocked(), 409);
  return recap(c.env.DB, session);
});

export default app;
