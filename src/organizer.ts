import { html, raw } from "hono/html";
import { getDashboardStatus } from "./dashboard";
import { dashboardPanel } from "./dashboard-ui";
import { sessionState, type Session } from "./sessions";
import { qrSvg } from "./qr";
import { shell, stepStrip, zigzag } from "./ui/components";

export type OrganizerMessage = { error?: string; ok?: string };

const UPLOAD_ICON = raw(
  `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><path d="M14 22V6M7 13l7-7 7 7" fill="none" stroke="#1F2F63" stroke-width="3"/></svg>`,
);

const PENCIL_ICON = raw(
  `<svg class="pencil" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3 17l1-4L14 3l3 3L7 16l-4 1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
);

// Progressive enhancement only: without JS the file input, textarea and buttons still post normally.
const PAGE_JS = `(function(){var f=document.querySelector('[data-upload]');if(f){
var dz=f.querySelector('.dropzone'),file=f.querySelector('input[type=file]'),name=f.querySelector('[data-file-name]'),text=f.querySelector('textarea'),go=f.querySelector('[data-score]'),def=name.textContent;
var sync=function(){var n=file.files&&file.files.length?file.files[0].name:'';name.textContent=n||def;go.disabled=!(n||text.value.trim())};
['dragenter','dragover'].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.add('is-over')})});
['dragleave','drop'].forEach(function(t){dz.addEventListener(t,function(){dz.classList.remove('is-over')})});
dz.addEventListener('drop',function(e){e.preventDefault();if(e.dataTransfer&&e.dataTransfer.files.length){file.files=e.dataTransfer.files;sync()}});
file.addEventListener('change',sync);text.addEventListener('input',sync);sync()}
var nf=document.querySelector('[data-name-form]');if(nf){var ni=nf.elements.name,nv=ni.value;
ni.addEventListener('blur',function(){var v=ni.value.trim();if(v&&v!==nv.trim()){nv=ni.value;nf.requestSubmit?nf.requestSubmit():nf.submit()}})}
[].forEach.call(document.querySelectorAll('[data-copy]'),function(b){if(!navigator.clipboard)return;b.hidden=false;b.addEventListener('click',function(){navigator.clipboard.writeText(b.dataset.copy).then(function(){b.textContent='Copied'})})})})();`;

export const organizerView = async (
  db: D1Database,
  session: Session,
  token: string,
  origin: string,
  message?: OrganizerMessage,
) => {
  const locked = !!session.locked_at;
  const dash = await getDashboardStatus(db, session);
  const invite = `${origin}/i/${session.invite_link_token}`;

  // Toast: CSS-only fade (no JS), non-blocking, sits directly below the navbar.
  const messages = message?.error
    ? html`<p class="toast" role="alert">${message.error}</p>`
    : message?.ok
      ? html`<p class="toast" role="status">${message.ok}</p>`
      : "";

  const panel = dashboardPanel(
    dash,
    `/o/${token}/status`,
    !locked,
    session.name === null
      ? "Nobody yet. Name the Session to get an invite link to share."
      : "Nobody has joined yet. Share the invite link and this table fills itself.",
  );

  const inviteCard =
    session.name === null
      ? ""
      : html`<section class="invite" aria-labelledby="invite-title">
          <h2 id="invite-title">Invite link</h2>
          <div class="invite__qr">${raw(qrSvg(invite))}</div>
          <a class="mono invite__url" id="invite-link" href="${invite}">${invite}</a>
          <div class="invite__actions">
            <button type="button" class="btn btn--secondary" hidden data-copy="${invite}">Copy link</button>
            <a class="btn btn--ghost" href="/o/${token}/invite-qr.svg" download="invite-qr.svg">Download QR (SVG)</a>
          </div>
          <p class="small muted">Show it on screen or paste the QR into your deck. Anyone with this link can join.</p>
        </section>`;

  const state = sessionState(session);
  const strip = organizerStrip(organizerStage(state, false));
  // Editable until locked: the title is the name field (Enter, or blur with JS, saves).
  const editable = state !== "locked";
  const header = editable
    ? html`<div class="titlebar"><form class="titlebar__form" method="post" action="/o/${token}/name" data-name-form>
        <h1 class="title-wrap"><input class="title-input" name="name" type="text" maxlength="80" required autocomplete="off"
          aria-label="Session name" placeholder="Name your session" value="${session.name ?? ""}" />${PENCIL_ICON}</h1>
      </form></div>`
    : html`<div class="titlebar"><h1>${session.name ?? ""}</h1></div>`;

  // Stage 1/4: naming is its own screen. Explicit submit (no blur-save); nothing else is rendered.
  if (state === "setup") {
    return shell(
      "Organizer",
      html`${messages}
        <form class="name-stage stack" method="post" action="/o/${token}/name">
          <h1>Name your session</h1>
          <p class="muted">Name your session. Participants see this on their pages.</p>
          <div class="stack">
            <label class="label" for="session-name">Session name</label>
            <div class="name-field">${PENCIL_ICON}<input id="session-name" class="name-input" name="name" type="text" maxlength="80" required
              autocomplete="off" autofocus placeholder="e.g. Q3 All-Hands" /></div>
          </div>
          <div class="cta-card">${zigzag(true)}<div class="pad"><button class="btn btn--primary" type="submit">Save and continue</button></div></div>
        </form>`,
      { strip },
    );
  }

  // Stage 2/4 (open): invite, live participants table and Lock & Start. Lock is available as soon as the Session is named.
  if (!locked) {
    const lockCard = html`<div class="cta-card">
      <form method="post" action="/o/${token}/lock">
        <div class="pad pad--top"><h2>Ready to start?</h2>
          <p class="small muted">Locks the Session and ends picking. This can’t be undone. Late joiners are locked out. Lock the Session to upload a Transcript.</p></div>
        ${zigzag(true)}
        <div class="pad"><button class="btn btn--primary" type="submit">Lock &amp; Start Session!</button></div>
      </form>
    </div>`;
    return shell(
      "Organizer",
      html`${header}${messages}
        <div class="stack">
          ${inviteCard}
          ${panel}${lockCard}
        </div>
        <script>${raw(PAGE_JS)}</script>`,
      { wide: true, strip },
    );
  }

  // Stage 3/4: locked summary + upload only. Also served when a Jargon Result exists (?step=transcript) to re-score.
  const n = dash.stats.participants;
  return shell(
    "Organizer",
    html`${header}${messages}
      <p class="muted">Locked at ${session.locked_at} UTC · ${n} ${n === 1 ? "participant" : "participants"}. The meeting’s over. Hand us the transcript.</p>
      <form class="stack" data-upload method="post" action="/o/${token}/transcript" enctype="multipart/form-data">
        <h2>Upload Transcript</h2>
        <label class="dropzone">${UPLOAD_ICON}<b data-file-name>Drop a transcript here</b><span class="mono">.TXT · .VTT</span>
          <input type="file" name="transcript" accept=".txt,.vtt" aria-label="Transcript file (.txt or .vtt)" /></label>
        <div class="or" aria-hidden="true">OR</div>
        <textarea class="field" name="transcript_text" placeholder="Paste transcript text…" aria-label="Paste transcript text"></textarea>
        <p class="stamp">Transcripts are read in memory, then deleted.</p>
        <p class="small muted">Only counts for words and phrases Participants picked are kept. Uploading again replaces the previous Jargon Result.</p>
        <div class="cta-card">${zigzag(true)}<div class="pad"><button class="btn btn--secondary" type="submit" data-score>Score the session</button></div></div>
      </form>
      <script>${raw(PAGE_JS)}</script>`,
    { strip },
  );
};

export const ORGANIZER_STAGES = ["Name", "Invite", "Transcript", "Leaderboard"];

/** 1-based organizer stage. A locked Session is at Transcript until a Jargon Result exists, then Leaderboard. */
export const organizerStage = (state: "setup" | "open" | "locked", hasJargonResult: boolean) =>
  ({ setup: 1, open: 2, locked: hasJargonResult ? 4 : 3 })[state];

export const organizerStrip = (step: number) =>
  stepStrip({ role: "organizer", step, total: ORGANIZER_STAGES.length, labels: ORGANIZER_STAGES });
