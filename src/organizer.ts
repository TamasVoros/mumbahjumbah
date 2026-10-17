import { html, raw } from "hono/html";
import { getDashboardStatus } from "./dashboard";
import { dashboardPanel } from "./dashboard-ui";
import { getJargonResult, getPickerCounts } from "./jargon";
import {
  DEFAULT_TIMER_SECONDS,
  MAX_TIMER_SECONDS,
  MIN_TIMER_SECONDS,
  sessionState,
  type Session,
} from "./sessions";
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

// Organizer countdown (server-time offset); reloads at zero so the page shows the locked state the server now holds.
const TIMER_JS = `(function(){var t=document.getElementById('org-timer');if(!t)return;
var ends=+t.dataset.ends,total=+t.dataset.total*1000,off=+t.dataset.now-Date.now(),s=t.querySelector('[data-secs]'),f=t.querySelector('[data-fill]');
function tick(){var l=ends-(Date.now()+off);if(l<=0){s.textContent='0';f.style.width='0';location.reload();return}
s.textContent=Math.ceil(l/1000);f.style.width=Math.min(100,l/total*100)+'%';setTimeout(tick,250)}
tick()})();`;

export const organizerView = async (
  db: D1Database,
  session: Session,
  token: string,
  origin: string,
  message?: OrganizerMessage,
) => {
  const locked = !!session.locked_at;
  const [dash, pickerCounts, jargon] = await Promise.all([
    getDashboardStatus(db, session),
    getPickerCounts(db, session.id),
    locked ? getJargonResult(db, session.id) : Promise.resolve([]),
  ]);
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

  const named = session.name !== null;

  const now = Date.now();
  const state = sessionState(session, now);
  const strip = organizerStrip(organizerStage(state, jargon.length > 0));
  // Editable while neither picking nor locked: the title is the name field (Enter, or blur with JS, saves).
  const editable = state === "setup" || state === "open";
  const header = editable
    ? html`<div class="titlebar"><form class="titlebar__form" method="post" action="/o/${token}/name" data-name-form>
        <h1 class="title-wrap"><input class="title-input" name="name" type="text" maxlength="80" required autocomplete="off"
          aria-label="Session name" placeholder="Name your session" value="${session.name ?? ""}" />${PENCIL_ICON}</h1>
      </form></div>`
    : html`<div class="titlebar"><h1>${session.name ?? ""}</h1></div>`;

  // Name is fixed once the timer starts; the timer length is fixed once started and there is no pause or extend.
  const timerCard =
    state === "picking"
      ? html`<div class="stack" id="org-timer" data-ends="${Date.parse(session.timer_ends_at ?? "")}" data-now="${now}" data-total="${session.timer_seconds}">
          <p class="label">Timer running</p>
          <p style="font:400 36px/1 Anton,Impact,sans-serif"><span data-secs>${Math.max(0, Math.ceil((Date.parse(session.timer_ends_at ?? "") - now) / 1000))}</span> s</p>
          <div class="progress"><i data-fill style="width:100%"></i></div>
          <p class="small muted">Participants are picking. When it hits zero the Session locks by itself, or lock it sooner below.</p>
        </div>`
      : html`<form class="stack" method="post" action="/o/${token}/timer">
          <label class="label" for="timer-seconds">Pick timer (seconds)</label>
          <input class="field" id="timer-seconds" name="seconds" type="number" min="${MIN_TIMER_SECONDS}" max="${MAX_TIMER_SECONDS}" step="1"
            value="${DEFAULT_TIMER_SECONDS}" required inputmode="numeric" />
          <p class="small muted">${MIN_TIMER_SECONDS} to ${MAX_TIMER_SECONDS} seconds. Participants wait until you start it, then see a countdown. Fixed once started: no pause, no extending.</p>
          <button class="btn btn--secondary" type="submit">Start timer</button>
        </form>`;

  // Stage 1/5: naming is its own screen. Explicit submit (no blur-save); nothing else is rendered.
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

  if (!locked) {
    return shell(
      "Organizer",
      html`${header}${messages}
        <div class="cols">
          <div class="stack">${panel}</div>
          <div class="stack">
            ${named
              ? html`${timerCard}
                  <div class="cta-card">
                    <form method="post" action="/o/${token}/lock">
                      <div class="pad pad--top"><h2>Ready to start?</h2>
                        <p class="small muted">Stops the timer if it is running and locks the Session. This can’t be undone. Late joiners are locked out. Lock the Session to upload a Transcript.</p></div>
                      ${zigzag(true)}
                      <div class="pad"><button class="btn btn--primary" type="submit">Lock &amp; Start Session!</button></div>
                    </form>
                  </div>
                  ${inviteCard}`
              : ""}
          </div>
        </div>
        <script>${raw(PAGE_JS)}</script>
        ${state === "picking" ? html`<script>${raw(TIMER_JS)}</script>` : ""}`,
      { wide: true, strip },
    );
  }

  const max = Math.max(1, ...jargon.map((j) => j.occurrences));
  const said = new Set(jargon.map((j) => j.term));
  const unseen = [...pickerCounts.keys()].filter((t) => !said.has(t)).sort();
  const rows = [
    ...jargon.map((j) => ({ term: j.term, n: j.occurrences })),
    ...(jargon.length ? unseen.map((term) => ({ term, n: 0 })) : []),
  ];

  const results =
    jargon.length === 0
      ? html`<p class="small muted">No Jargon Result yet (or no picked term was said).</p>`
      : html`<div class="stack">
          <div><p class="label">What the room said</p>
            <p style="font-size:26px;font-weight:800;line-height:1.1;margin:6px 0 0">${said.size} of your ${pickerCounts.size} picks showed up.</p>
            <p class="small muted" style="margin-top:6px">Only words someone picked are counted.</p></div>
          <ul class="words ${rows.length > 8 ? "words--scroll scroll" : ""}" aria-label="Jargon Result">
            ${rows.map(
              (r) => html`<li class="word ${r.n === 0 ? "word--zero" : ""}"><i style="width:${Math.round((r.n / max) * 100)}%"></i><span class="t">${r.term}</span><span class="by">${pickerCounts.get(r.term) ?? 0} picked</span><span class="n">×${r.n}</span></li>`,
            )}
          </ul>
          <div class="scrollhint"><span>Most said first</span>${rows.length > 8 ? html`<span>↓ ${rows.length - 8} more</span>` : ""}</div>
        </div>`;

  return shell(
    "Organizer",
    html`${header}${messages}
      <p class="muted">This Session is locked (since ${session.locked_at} UTC). No further Grids are accepted. The meeting’s over. Hand us the transcript.</p>
      ${panel}
      <div class="cols">
        <div class="stack"><h2>Jargon Result</h2>${results}
          <a class="btn btn--primary" href="/o/${token}/leaderboard">See the leaderboard</a>
          <p class="small"><a class="lnk" href="/o/${token}/recap.png">Recap Card (PNG)</a></p></div>
        <div class="stack">
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
          ${inviteCard}
        </div>
      </div>
      <script>${raw(PAGE_JS)}</script>`,
    { wide: true, strip },
  );
};

export const ORGANIZER_STAGES = ["Name", "Invite & timer", "Participants", "Transcript", "Leaderboard"];

/** 1-based organizer stage. A locked Session is at Transcript until a Jargon Result exists, then Leaderboard. */
export const organizerStage = (state: "setup" | "open" | "picking" | "locked", hasJargonResult: boolean) =>
  ({ setup: 1, open: 2, picking: 3, locked: hasJargonResult ? 5 : 4 })[state];

export const organizerStrip = (step: number) =>
  stepStrip({ role: "organizer", step, total: ORGANIZER_STAGES.length, labels: ORGANIZER_STAGES });
