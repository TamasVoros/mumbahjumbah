import { Hono } from "hono";
import { html, raw } from "hono/html";
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
