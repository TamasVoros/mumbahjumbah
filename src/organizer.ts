import { html, raw } from "hono/html";
import { getJargonResult, getPickerCounts } from "./jargon";
import { listParticipants, type Session } from "./sessions";
import { chip, shell, wordmark, zigzag } from "./ui/components";

export type OrganizerMessage = { error?: string; ok?: string };

const VISIBLE_ROWS = 7;

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

export const organizerView = async (
  db: D1Database,
  session: Session,
  token: string,
  origin: string,
  message?: OrganizerMessage,
) => {
  const locked = !!session.locked_at;
  const [people, pickerCounts, jargon] = await Promise.all([
    listParticipants(db, session.id),
    getPickerCounts(db, session.id),
    locked ? getJargonResult(db, session.id) : Promise.resolve([]),
  ]);
  const count = people.length;
  const invite = `${origin}/i/${session.invite_link_token}`;

  const messages = html`${message?.error ? html`<p class="msg" role="alert">${message.error}</p>` : ""}${message?.ok
    ? html`<p class="msg" role="status">${message.ok}</p>`
    : ""}`;

  const stats = html`<div class="stats stats--3">
    <div class="stat"><span class="num">${count}</span><span class="cap">grids in</span></div>
    <div class="stat"><span class="num">${session.pick_count}</span><span class="cap">picks each</span></div>
    <div class="stat"><span class="num">${pickerCounts.size}</span><span class="cap">unique words</span></div>
  </div>`;

  const peopleList =
    count === 0
      ? html`<p class="small muted">No grids yet. Share the invite link and the list fills itself.</p>`
      : html`<ul class="people ${count > VISIBLE_ROWS ? "people--scroll scroll" : ""}" aria-label="Participants">
            ${people.map((p) => html`<li class="person"><span class="nm">${p.display_name}</span>${chip("submitted")}</li>`)}
          </ul>
          ${count > VISIBLE_ROWS
            ? html`<div class="scrollhint"><span>Scroll for all ${count}</span><span>↓ ${count - VISIBLE_ROWS} more</span></div>`
            : ""}`;

  const inviteCard = html`<div class="linkcard">
    <div class="hd"><b>Invite link</b><button type="button" hidden data-copy="${invite}">Copy</button></div>
    <a class="mono" id="invite-link" href="${invite}">${invite}</a>
  </div>`;

  const header = html`<div class="topbar">${wordmark()}<span class="label">Organizer view</span></div>
    <div class="titlebar"><h1>Organizer: Session ${session.id}</h1>${locked ? chip("locked") : chip("open")}</div>`;

  if (!locked) {
    return shell(
      "Organizer",
      html`${header}${messages}
        <div class="cols">
          <div class="stack">${stats}
            <p class="label">Participants · ${count}</p>
            ${peopleList}
          </div>
          <div class="stack">
            <div class="cta-card">
              <form method="post" action="/o/${token}/lock">
                <div class="pad pad--top"><h2>Ready to start?</h2>
                  <p class="small muted">Locking can’t be undone. Late joiners are locked out. Lock the Session to upload a Transcript.</p></div>
                ${zigzag(true)}
                <div class="pad"><button class="btn btn--primary" type="submit">Lock the grids</button></div>
              </form>
            </div>
            ${inviteCard}
          </div>
        </div>
        <script>${raw(PAGE_JS)}</script>`,
      { wide: true },
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
    { wide: true },
  );
};
