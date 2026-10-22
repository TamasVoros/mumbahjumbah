import { html, raw } from "hono/html";
import { CHROME_CSS, brandHead, siteFooter, siteHeader } from "./ui/chrome";
import { stepStrip } from "./ui/components";

// Player-facing invite-link screens, styled per DESIGN.md (direction 2A).
// Mockups: Desktop D3 (entry), Screens 3B (submitted), 3C (locked).

const css = `
:root{--indigo:#1F2F63;--night:#172352;--bone:#F4EFE6;--paper:#fff;--sand-bar:#ECE4D2;--ink:#17140F;--muted:#5F5648;--placeholder:#8A8070;--red:#D2432C;--red-hover:#8F2B22;--raffia:#E3C26E;--ring:0 0 0 3px rgba(31,47,99,.12)}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bone);color:var(--ink);font:400 15px/1.5 Archivo,system-ui,-apple-system,"Segoe UI",sans-serif}
.mono{font-family:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace}
.head{display:none}
.wrap{max-width:1280px;margin:0 auto;padding:32px 24px 24px;display:flex;flex-direction:column;gap:24px}
.main{display:flex;flex-direction:column;gap:24px;flex:1;min-width:0}
.title-row{display:flex;justify-content:space-between;align-items:center;gap:12px}
h1{margin:0;font-weight:800;font-size:22px;line-height:1.1}
.sub{margin:0;font-size:14px;line-height:1.5;color:var(--muted)}
.sub b{color:var(--ink);overflow-wrap:anywhere}
.label{font-family:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
form{display:flex;flex-direction:column;gap:24px;margin:0}
.fields{display:flex;flex-direction:column;gap:12px}
input[type=text],input[type=email]{width:100%;height:52px;background:var(--paper);border:1.5px solid var(--ink);border-radius:2px;padding:0 14px;font:400 15px Archivo,system-ui,sans-serif;color:var(--ink)}
input::placeholder{color:var(--placeholder);opacity:1}
input:focus,input:focus-visible{outline:none;border-color:var(--indigo);box-shadow:var(--ring)}
button:focus-visible,a:focus-visible{outline:none;box-shadow:var(--ring);border-color:var(--indigo)}
.alert{margin:0;border:1.5px solid var(--red);background:var(--paper);border-radius:2px;padding:12px 14px;font-size:14px}
.entry{display:flex;gap:8px}
.entry input{flex:1;min-width:0}
.entry kbd{display:none}
.btn{display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:2px;border:1.5px solid var(--ink);padding:14px;font:700 16px Archivo,system-ui,sans-serif;text-align:center;text-decoration:none;cursor:pointer;color:var(--ink);background:var(--paper);width:100%}
.btn.add{width:auto;padding:0 18px;height:52px;background:var(--indigo);border-color:var(--indigo);color:#fff}
.btn.cta{background:var(--red);border-color:var(--red);color:#fff}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn:hover:not(:disabled){opacity:.92}
.zig{height:16px;margin:0 -24px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M0 12L8 4L16 12' fill='none' stroke='%23D2432C' stroke-width='2.5'/%3E%3C/svg%3E") repeat-x}
.picks{display:flex;flex-direction:column;gap:12px}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
.pill{display:flex;align-items:center;gap:8px;background:var(--indigo);color:var(--bone);border-radius:99px;padding:8px 10px 8px 14px;font-size:14px;font-weight:600;overflow-wrap:anywhere;max-width:100%}
.pill button{position:relative;width:18px;height:18px;border:0;border-radius:99px;background:rgba(244,239,230,.2);color:var(--bone);font:inherit;font-size:12px;line-height:1;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center}
.pill button::after{content:"";position:absolute;inset:-13px}
.pill button:focus-visible{box-shadow:0 0 0 2px var(--indigo),0 0 0 4px var(--raffia)}
.pill.plain{background:var(--paper);color:var(--ink);border:1.5px solid var(--ink);padding:6px 12px;font-size:13px;font-weight:400}
.bar{height:8px;border:1.5px solid var(--ink);border-radius:99px;background:var(--paper);overflow:hidden}
.bar i{display:block;height:100%;background:var(--indigo);width:0}
.full{background:var(--sand-bar);border:1.5px solid var(--ink);border-radius:2px;min-height:52px;padding:12px 14px;display:flex;align-items:center;font-size:14px;color:var(--muted)}
.msg{margin:0;font-size:12px;line-height:1.4;color:var(--muted)}
.msg.err{color:var(--red-hover)}
.foot{margin-top:auto;display:flex;flex-direction:column;gap:12px}
.foot .msg{text-align:center}
.panel{background:var(--indigo);color:var(--bone);border-radius:2px;padding:24px 20px;display:flex;flex-direction:column;gap:8px}
.panel .label{color:var(--raffia)}
.panel h2{margin:0;font-weight:800;font-size:24px;line-height:1.15}
.panel p{margin:0;font-size:13px;line-height:1.45;opacity:.85}
a{color:var(--indigo);font-weight:700}
a:hover{color:var(--red-hover)}
.links{margin:0;font-size:14px}
.side{display:none}
@media (min-width:900px){
 .head{display:flex;height:72px;align-items:center;justify-content:space-between;padding:0 64px;border-bottom:1.5px solid var(--ink)}
 .head b{font-weight:800;font-size:18px}
 .wrap{padding:48px 64px;min-height:calc(100vh - 72px);display:grid;grid-template-columns:1fr 340px;column-gap:56px;row-gap:28px;align-content:start}
 .wrap.single{grid-template-columns:minmax(0,640px)}
 .wrap>.main{display:flex;flex-direction:column;gap:28px;min-width:0}
 h1{font-size:36px}
 .sub{font-size:16px}
 form{gap:28px}
 .entry input{height:76px;padding:0 24px;font-size:22px}
 .entry input:focus{box-shadow:0 0 0 4px rgba(31,47,99,.12)}
 .entry kbd{display:flex;align-items:center;align-self:center;font:400 11px "JetBrains Mono",ui-monospace,Menlo,monospace;letter-spacing:.06em;border:1.5px solid var(--ink);border-radius:4px;padding:4px 10px;color:var(--muted)}
 .btn.add{display:none}
 .btn{width:auto;min-width:260px;align-self:flex-start;font-size:17px;padding:16px 28px}
 .pills{gap:12px}
 .pill{gap:12px;padding:12px 14px 12px 22px;font-size:18px}
 .pill button{width:22px;height:22px;font-size:14px}
 .pill.plain{font-size:15px;padding:8px 16px}
 .label{font-size:12px}
 .side{display:flex;flex-direction:column;gap:16px;border:1.5px solid var(--ink);background:var(--paper);border-radius:2px;padding:20px 22px;align-self:start}
 .side .stat{font:400 36px/1 Anton,Impact,sans-serif}
 .zig{margin:0 -22px}
 .foot{margin-top:0}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

const fontLink = raw(
  `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap">`,
);

export const PLAYER_STEPS = ["Join", "Pick", "Done"];
/** 1-based player step: Join (no identity yet), Pick (identity entered), Done (submitted or locked). */
export type PlayerStep = 1 | 2 | 3;

const shell = (title: string, step: PlayerStep, main: unknown, side?: unknown, script?: string) => html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    ${brandHead()}
    ${fontLink}
    <style>${raw(css)}${raw(CHROME_CSS)}</style>
  </head>
  <body>
    ${siteHeader()}
    ${playerStrip(step)}
    <div class="wrap${side ? "" : " single"}">
      <div class="main">${main}</div>
      ${side ?? ""}
    </div>
    ${siteFooter()}
    ${script ? html`<script>${raw(script)}</script>` : ""}
  </body>
</html>`;

export const playerStrip = (step: PlayerStep) => stepStrip({ role: "player", step, total: PLAYER_STEPS.length, labels: PLAYER_STEPS });

const sessionLabel = (sessionId: number, name?: string | null) => name ?? `Session ${sessionId}`;

const titleRow = (sessionId: number, name?: string | null) =>
  html`<div class="title-row"><h1>${sessionLabel(sessionId, name)}</h1></div>`;

// Progressive enhancement: with JS, a single field turns typed picks into pills and emits one hidden
// `pick` input per pill; without JS the <noscript> block offers plain numbered inputs. The server
// (validateGrid) stays the only authority on validity.
const entryScript = `(function(){
var root=document.getElementById('pickapp');if(!root)return;
var n=+root.dataset.count,picks=JSON.parse(root.dataset.picks||'[]');
var field=document.getElementById('pickfield'),add=document.getElementById('pickadd'),
list=document.getElementById('pills'),hid=document.getElementById('hidden'),
count=document.getElementById('count'),fill=document.getElementById('fill'),
submit=document.getElementById('submit'),entry=document.getElementById('entry'),
full=document.getElementById('full'),msg=document.getElementById('msg'),
side=document.getElementById('sidecount');
var norm=function(s){return s.trim().replace(/\\s+/g,' ').toLowerCase()};
picks=picks.map(norm).filter(Boolean);
root.hidden=false;
function render(){
 list.textContent='';hid.textContent='';
 picks.forEach(function(p,i){
  var li=document.createElement('li');li.className='pill';
  li.appendChild(document.createTextNode(p));
  var b=document.createElement('button');b.type='button';b.textContent='\\u00d7';
  b.setAttribute('aria-label','Remove '+p);
  b.onclick=function(){picks.splice(i,1);render();field.focus()};
  li.appendChild(b);list.appendChild(li);
  var h=document.createElement('input');h.type='hidden';h.name='pick';h.value=p;hid.appendChild(h);
 });
 var left=n-picks.length;
 count.textContent='YOUR PICKS \\u00b7 '+picks.length+' / '+n;
 if(side)side.textContent=picks.length+' of '+n+' picked';
 fill.style.width=(picks.length/n*100)+'%';
 fill.parentNode.setAttribute('aria-valuenow',picks.length);
 submit.disabled=picks.length<1;
 submit.textContent=picks.length<1?'Add at least 1 pick':'Submit grid';
 entry.hidden=left<=0;full.hidden=left>0;
}
function addPick(){
 var v=norm(field.value);if(!v)return;
 msg.className='msg';
 if(picks.length>=n)return;
 if(picks.indexOf(v)>-1){msg.className='msg err';msg.textContent='\\u201c'+v+'\\u201d is already in your picks. Every pick must be different.';return}
 msg.textContent='';picks.push(v);field.value='';render();field.focus();
}
field.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();addPick()}});
add.addEventListener('click',addPick);
render();
})();`;

// Identity remembered across visits, in localStorage keyed by invite token.
// Pure enhancement: every storage access is guarded, and the server never reads it.
const identityScript = `(function(){
var key='mj:id:'+location.pathname.split('/')[2];
function get(){try{return JSON.parse(localStorage.getItem(key)||'null')}catch(e){return null}}
function put(e,n){try{localStorage.setItem(key,JSON.stringify({email:e,display_name:n}))}catch(x){}}
[].forEach.call(document.querySelectorAll('form'),function(f){
 var e=f.querySelector('input[name=email]'),n=f.querySelector('input[name=display_name]');
 if(!e||!n)return;
 var s=get();
 if(s&&!e.value&&!n.value){e.value=s.email||'';n.value=s.display_name||''}
 f.addEventListener('submit',function(){if(e.value&&n.value)put(e.value.trim(),n.value.trim())});
});
})();`;

type FormValues = { email?: string; display_name?: string; picks?: string[] };

export const entryView = (
  sessionId: number,
  pickCount: number,
  v: FormValues = {},
  error?: string,
  name?: string | null,
) => {
  const picks = (v.picks ?? []).filter((p) => p.trim() !== "");
  const words = pickCount === 1 ? "word or phrase" : "words or phrases";
  return shell(
    sessionLabel(sessionId, name),
    v.email && v.display_name ? 2 : 1,
    html`${titleRow(sessionId, name)}
      <p class="sub">Predict up to ${pickCount} ${words} you expect to hear in the meeting. Type one, press Enter, repeat. Each must be different.</p>
      ${error ? html`<p class="alert" role="alert">${error}</p>` : ""}
      <form method="post">
        <div class="fields">
          <input type="email" name="email" maxlength="128" value="${v.email ?? ""}" placeholder="Email (e.g. sam@acme.co)" aria-label="Email" autocomplete="email" required />
          <input type="text" name="display_name" maxlength="50" value="${v.display_name ?? ""}" placeholder="Display name (e.g. Sam)" aria-label="Display name" autocomplete="nickname" required />
        </div>
        <noscript>
          <ol>
            ${Array.from(
              { length: pickCount },
              (_, i) => html`<li><input type="text" name="pick" maxlength="100" value="${picks[i] ?? ""}" aria-label="Pick ${i + 1}"${i === 0 ? " required" : ""} /></li>`,
            )}
          </ol>
          <button class="btn cta" type="submit">Submit grid</button>
        </noscript>
        <div id="pickapp" hidden data-count="${pickCount}" data-picks="${JSON.stringify(picks)}">
          <div class="picks" style="gap:24px">
            <div id="entry" class="entry">
              <input id="pickfield" type="text" placeholder="Type a word or phrase…" aria-label="Add a pick" autocomplete="off" enterkeyhint="done" />
              <kbd aria-hidden="true">ENTER ↵</kbd>
              <button id="pickadd" class="btn add" type="button">Add</button>
            </div>
            <div id="full" class="full" hidden>Maximum of ${pickCount} reached. Remove one to swap it.</div>
            <p id="msg" class="msg" role="status" aria-live="polite"></p>
            <div class="picks">
              <div id="count" class="label">YOUR PICKS · ${picks.length} / ${pickCount}</div>
              <div class="bar" role="progressbar" aria-label="Picks" aria-valuemin="0" aria-valuemax="${pickCount}" aria-valuenow="${picks.length}"><i id="fill"></i></div>
              <ul id="pills" class="pills"></ul>
            </div>
          </div>
          <div id="hidden"></div>
          <div class="foot" style="margin-top:24px">
            <div class="zig" aria-hidden="true"></div>
            <button id="submit" class="btn cta" type="submit" disabled>Submit grid</button>
          </div>
        </div>
      </form>`,
    html`<aside class="side"><div class="label">Your grid</div><div id="sidecount" class="stat">${picks.length} of ${pickCount} picked</div><p class="msg">Editable until the organizer locks the grid.</p></aside>`,
    entryScript + identityScript,
  );
};

/**
 * A submission that arrived after lock (served as 409): says so plainly and shows what the
 * participant typed, read-only.
 */
export const lockedSubmissionView = (sessionId: number, inviteToken: string, picks: string[], name?: string | null) =>
  shell(
    "Session locked",
    3,
    html`${titleRow(sessionId, name)}
      <p class="alert" role="alert">The Session is locked. Your grid was not saved: it arrived after the lock, and the cutoff is strict.</p>
      ${picks.length
        ? html`<div class="picks">
            <div class="label">WHAT YOU TYPED · ${picks.length}</div>
            <ul class="pills">${picks.map((p) => html`<li class="pill plain">${p}</li>`)}</ul>
          </div>`
        : ""}
      <div class="panel">
        <div class="label">TRANSCRIPT PENDING</div>
        <h2>Results appear when the organizer scores it.</h2>
        <p>Check back once the transcript is in.</p>
      </div>
      <p class="links"><a href="/i/${inviteToken}">Back to the Session</a></p>`,
  );

export const submittedView = (sessionId: number, email: string, displayName: string, picks: string[], name?: string | null) =>
  shell(
    "Grid submitted",
    3,
    html`${titleRow(sessionId, name)}
      <p class="sub">Thanks, ${displayName}. You’re in as <b>${email}</b>. ${picks.length} ${picks.length === 1 ? "pick" : "picks"}, on record.</p>
      <div class="full">All ${picks.length} picked.</div>
      <div class="picks">
        <div class="label">YOUR PICKS · ${picks.length} / ${picks.length}</div>
        <ul class="pills">${picks.map((p) => html`<li class="pill">${p}</li>`)}</ul>
      </div>
      <div class="foot">
        <a class="btn" href="">Edit your Grid</a>
        <p class="msg">Editable until the organizer locks the grid. Resubmit with the same email to change your picks.</p>
      </div>`,
  );

export const lockedView = (sessionId: number, inviteToken: string, name?: string | null) =>
  shell(
    "Session locked",
    3,
    html`${titleRow(sessionId, name)}
      <p class="sub">${sessionLabel(sessionId, name)} is locked. The Organizer has locked this Session, so Grids can no longer be submitted or changed. Go sit through the meeting; we’ll score it afterwards.</p>
      <div class="panel">
        <div class="label">TRANSCRIPT PENDING</div>
        <h2>Results appear when the organizer scores it.</h2>
        <p>Check back once the transcript is in.</p>
      </div>
      <p class="links"><a href="/i/${inviteToken}/leaderboard">View the leaderboard</a> · <a href="/i/${inviteToken}/recap.png">Recap Card (PNG)</a></p>`,
  );
