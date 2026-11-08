import { Hono, type Context } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { saveGrid, validateGrid } from "./grids";
import { getLeaderboard } from "./leaderboard";
import { renderRecapPng } from "./recap";
import { qrSvg } from "./qr";
import { getDashboardStatus } from "./dashboard";
import { getJargonResult, processTranscript } from "./jargon";
import {
  createForm,
  entryView,
  leaderboardPage,
  lockedView,
  notFoundPage,
  notLocked,
  notOpenYetPage,
  organizersOnlyPage,
  organizerView,
  pickedWords,
  PICK_PRESETS,
  plansPage,
  statusUrl,
  submittedView,
  timerInfo,
  timesUpView,
  waitingView,
} from "./pages";
import {
  createSession,
  findByInviteToken,
  findByOrganizerToken,
  lockSession,
  parsePickCount,
  parseSessionName,
  parseTimerSeconds,
  renameSession,
  sessionState,
  startTimer,
  DEFAULT_TIMER_SECONDS,
  MAX_TIMER_SECONDS,
  MIN_TIMER_SECONDS,
  type Session,
} from "./sessions";

// Routing only: each handler resolves the token, enforces the access guard, and hands rendering to ./pages.

export type Bindings = { DB: D1Database };

export const app = new Hono<{ Bindings: Bindings }>();

// Security headers on every response. Pages use inline <style>/<script> and Google Fonts, so script/style
// keep 'unsafe-inline' for now (moving to nonces is a follow-up); everything else is locked down.
app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
    referrerPolicy: "no-referrer",
    xFrameOptions: "DENY",
    xContentTypeOptions: "nosniff",
  }),
);

// Capability URLs (organizer/invite tokens) and freshly minted links must never be cached.
app.use("*", async (c, next) => {
  await next();
  const path = c.req.path;
  if (path.startsWith("/o/") || path.startsWith("/i/") || (path === "/sessions" && c.req.method === "POST")) {
    c.res.headers.set("Cache-Control", "no-store");
  }
});

app.get("/health", async (c) => {
  await c.env.DB.prepare("SELECT 1").first();
  return c.json({ status: "ok" });
});

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
    return c.html(createForm("Pick Count must be a whole number from 1 to 100."), 400);
  }
  const session = await createSession(c.env.DB, pickCount);
  // Straight to the Organizer page, where the Session Name is set and the Invite Link then appears.
  return c.redirect(`/o/${session.organizer_link_token}`, 303);
});

// Small JSON status for the participant pages (waiting screen and countdown). Never cached (see the /i/ rule above).
app.get("/i/:token/status", async (c) => {
  const now = Date.now();
  const session = await findByInviteToken(c.env.DB, c.req.param("token"), now);
  if (!session) return c.json({ state: "unknown" }, 404);
  const state = sessionState(session, now);
  if (state === "setup") return c.json({ state }, 403);
  return c.json({
    state,
    now,
    endsAt: state === "picking" ? Date.parse(session.timer_ends_at ?? "") : null,
    seconds: session.timer_seconds,
  });
});

app.get("/i/:token", async (c) => {
  const now = Date.now();
  const session = await findByInviteToken(c.env.DB, c.req.param("token"), now);
  if (!session) return c.html(notFoundPage(), 404);
  const state = sessionState(session, now);
  if (state === "setup") return c.html(notOpenYetPage(), 403);
  if (state === "locked") return c.html(lockedView(session.id, session.invite_link_token, session.name), 403);
  if (state === "open") return c.html(waitingView(session.id, statusUrl(session), session.name));
  return c.html(entryView(session.id, session.pick_count, {}, undefined, session.name, timerInfo(session, now)));
});

app.post("/i/:token", async (c) => {
  const now = Date.now();
  const session = await findByInviteToken(c.env.DB, c.req.param("token"), now);
  if (!session) return c.html(notFoundPage(), 404);
  const state = sessionState(session, now);
  if (state === "setup") return c.html(notOpenYetPage(), 403);
  if (state === "open") {
    return c.html(waitingView(session.id, statusUrl(session), session.name, "The organizer hasn’t started the timer yet, so nothing was saved."), 409);
  }
  const raw = await c.req.parseBody({ all: true });
  // Strict cutoff: after lock or timer end the submission is rejected before validation, and what was typed is shown back read-only.
  if (state === "locked") {
    return c.html(timesUpView(session.id, session.invite_link_token, pickedWords(raw), session.name), 409);
  }
  const result = validateGrid(raw, session.pick_count);
  if (!result.ok) {
    const picks = pickedWords(raw);
    const values = {
      email: typeof raw["email"] === "string" ? raw["email"] : "",
      display_name: typeof raw["display_name"] === "string" ? raw["display_name"] : "",
      picks,
    };
    return c.html(entryView(session.id, session.pick_count, values, result.error, session.name, timerInfo(session, now)), 400);
  }
  // Design decision (#18): mockup 8A's 409 "duplicate email" screen is intentionally NOT implemented.
  // Resubmitting under the same email is a deliberate edit/upsert, not an error.
  if (!(await saveGrid(c.env.DB, session.id, result.value, now))) {
    return c.html(timesUpView(session.id, session.invite_link_token, result.value.picks, session.name), 409);
  }
  return c.html(submittedView(session.id, result.value.email, result.value.displayName, result.value.picks, session.name));
});

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

// Live dashboard data, polled by the Organizer page. Organizer token only (invite token 403, unknown 404); names, never emails.
app.get("/o/:token/status", async (c) => {
  const token = c.req.param("token");
  const now = Date.now();
  const session = await findByOrganizerToken(c.env.DB, token, now);
  if (!session) return organizerMissing(c, token);
  return c.json(await getDashboardStatus(c.env.DB, session, now), 200, { "cache-control": "no-store" });
});

// Only an Organizer Link token can name the Session; editable until lock. Reveals the Invite Link once saved.
app.post("/o/:token/name", async (c) => {
  const token = c.req.param("token");
  const existing = await findByOrganizerToken(c.env.DB, token);
  if (!existing) return organizerMissing(c, token);
  const origin = new URL(c.req.url).origin;
  if (existing.locked_at || existing.timer_started_at) {
    const why = existing.locked_at ? "The Session is locked" : "The timer has started";
    return c.html(await organizerView(c.env.DB, existing, token, origin, { error: `${why}, so its name can’t change.` }), 409);
  }
  const form = await c.req.parseBody();
  const name = parseSessionName(form["name"]);
  if (name === null) {
    return c.html(
      await organizerView(c.env.DB, existing, token, origin, { error: "Session name must be 1 to 80 characters." }),
      400,
    );
  }
  const session = await renameSession(c.env.DB, token, name);
  if (!session) return c.html(await organizerView(c.env.DB, existing, token, origin), 409);
  return c.html(await organizerView(c.env.DB, session, token, origin, { ok: "Name saved. Invite link ready." }));
});

// Only an Organizer Link token can start the pick timer: needs a name, 30-60 s (default 30), and it is fixed once started.
app.post("/o/:token/timer", async (c) => {
  const token = c.req.param("token");
  const now = Date.now();
  const existing = await findByOrganizerToken(c.env.DB, token, now);
  if (!existing) return organizerMissing(c, token);
  const origin = new URL(c.req.url).origin;
  const fail = async (error: string, status: 400 | 409) =>
    c.html(await organizerView(c.env.DB, existing, token, origin, { error }), status);
  if (existing.locked_at) return fail("The Session is locked, so the timer can’t start.", 409);
  if (existing.timer_started_at) return fail("The timer has already started and can’t be changed.", 409);
  if (existing.name === null) return fail("Name the Session before starting the timer.", 409);
  const form = await c.req.parseBody();
  const seconds = form["seconds"] === undefined ? DEFAULT_TIMER_SECONDS : parseTimerSeconds(form["seconds"]);
  if (seconds === null) return fail(`Timer length must be a whole number from ${MIN_TIMER_SECONDS} to ${MAX_TIMER_SECONDS} seconds.`, 400);
  const session = await startTimer(c.env.DB, token, seconds, now);
  if (!session) return fail("The timer could not be started.", 409);
  return c.html(await organizerView(c.env.DB, session, token, origin, { ok: `Timer started: ${seconds} seconds.` }));
});

// Only an Organizer Link token can lock; Invite Link tokens never match here. A nameless Session can't lock.
app.post("/o/:token/lock", async (c) => {
  const token = c.req.param("token");
  const unnamed = await findByOrganizerToken(c.env.DB, token);
  if (unnamed && unnamed.name === null) {
    return c.html(
      await organizerView(c.env.DB, unnamed, token, new URL(c.req.url).origin, { error: "Name the Session before locking it." }),
      409,
    );
  }
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
  return c.html(await leaderboardPage(c.env.DB, session, `/o/${session.organizer_link_token}/recap.png`, true));
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

// Downloadable invite QR for slides. Organizer token only; 404 until the Session is named (same gate as the link).
app.get("/o/:token/invite-qr.svg", async (c) => {
  const token = c.req.param("token");
  const session = await findByOrganizerToken(c.env.DB, token);
  if (!session) return organizerMissing(c, token);
  if (session.name === null) return c.html(notFoundPage(), 404);
  const invite = `${new URL(c.req.url).origin}/i/${session.invite_link_token}`;
  return new Response(qrSvg(invite), {
    headers: { "content-type": "image/svg+xml", "content-disposition": 'attachment; filename="invite-qr.svg"', "cache-control": "no-store" },
  });
});

app.get("/o/:token/recap.png", async (c) => {
  const token = c.req.param("token");
  const session = await findByOrganizerToken(c.env.DB, token);
  if (!session) return organizerMissing(c, token);
  if (!session.locked_at) return c.html(notLocked(), 409);
  return recap(c.env.DB, session);
});

export default app;
