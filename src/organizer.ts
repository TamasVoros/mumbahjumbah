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
import { chip, shell, zigzag } from "./ui/components";

export type OrganizerMessage = { error?: string; ok?: string };

const UPLOAD_ICON = raw(
  `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><path d="M14 22V6M7 13l7-7 7 7" fill="none" stroke="#1F2F63" stroke-width="3"/></svg>`,
);

// Progressive enhancement only: without JS the file input, textarea and buttons still post normally.
const PAGE_JS = `(function(){var f=document.querySelector('[data-upload]');if(f){
var dz=f.querySelector('.dropzone'),file=f.querySelector('input[type=file]'),name=f.querySelector('[data-file-name]'),text=f.querySelector('textarea'),go=f.querySelector('[data-score]'),def=name.textContent;
var sync=function(){var n=file.files&&file.files.length?file.files[0].name:'';name.textContent=n||def;go.disabled=!(n||text.value.trim())};
['dragenter','dragover'].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.add('is-over')})});
['dragleave','drop'].forEach(function(t){dz.addEventListener(t,function(){dz.classList.remove('is-over')})});
dz.addEventListener('drop',function(e){e.preventDefault();if(e.dataTransfer&&e.dataTransfer.files.length){file.files=e.dataTransfer.files;sync()}});
file.addEventListener('change',sync);text.addEventListener('input',sync);sync()}
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

  const messages = html`${message?.error ? html`<p class="msg" role="alert">${message.error}</p>` : ""}${message?.ok
    ? html`<p class="msg" role="status">${message.ok}</p>`
    : ""}`;

  const panel = dashboardPanel(
    dash,
    `/o/${token}/status`,
    !locked,
    session.name === null
      ? "Nobody yet. Name the Session to get an invite link to share."
      : "Nobody has joined yet. Share the invite link and this table fills itself.",
  );

  const inviteCard = html`<div class="linkcard">
    <div class="hd"><b>Invite link</b><button type="button" hidden data-copy="${invite}">Copy</button></div>
    <a class="mono" id="invite-link" href="${invite}">${invite}</a>
  </div>`;

  const named = session.name !== null;
  const nameForm = html`<form class="stack" method="post" action="/o/${token}/name">
    <label class="label" for="session-name">Session name</label>
    <input class="field" id="session-name" name="name" type="text" maxlength="80" required
      value="${session.name ?? ""}" placeholder="e.g. Q3 all-hands" autocomplete="off" />
    <p class="small muted">${named
      ? "Participants see this name. You can change it until you lock the Session."
      : "Name the Session to get your invite link. Participants see this name."}</p>
    <button class="btn btn--secondary" type="submit">${named ? "Save name" : "Save name and get invite link"}</button>
  </form>`;

  const now = Date.now();
  const state = sessionState(session, now);
  const stateChip = { setup: chip("pending", "SETUP"), open: chip("open"), picking: chip("pending", "PICKING"), locked: chip("locked") }[state];
  const header = html`<div class="titlebar"><h1>${session.name ?? `Session ${session.id}`}</h1>${stateChip}</div>`;

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

  if (!locked) {
    return shell(
      "Organizer",
      html`${header}${messages}
        <div class="cols">
          <div class="stack">${panel}</div>
          <div class="stack">
            ${state === "picking" ? "" : nameForm}
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
      { wide: true, organizer: true },
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
    { wide: true, organizer: true },
  );
};
