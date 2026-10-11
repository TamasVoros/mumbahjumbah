import { html, raw } from "hono/html";

// Kept free of D1/session imports so the browser-side (jsdom) test can load it without the Workers types.
export const POLL_MS = 4000;

export type DashboardRow = { name: string; submitTime: string; picks: number };
export type DashboardStatus = {
  state: "setup" | "open" | "picking" | "locked";
  now: number;
  timerEndsAt: number | null;
  participants: DashboardRow[];
  stats: { participants: number; medianPicks: number; uniquePicks: number };
};

// Updates in place via textContent only (names are user input). Polls until the Session locks, then reloads once
// so the page shows the locked layout.
const DASH_JS = `(function(){var d=document.querySelector('[data-dash]');if(!d)return;
var body=d.querySelector('[data-rows]'),empty=d.querySelector('[data-empty]'),tbl=d.querySelector('table'),stat={};
[].forEach.call(d.querySelectorAll('[data-stat]'),function(n){stat[n.dataset.stat]=n});
function cell(tr,t,cls){var td=document.createElement('td');if(cls)td.className=cls;td.textContent=t;tr.append(td)}
function draw(s){for(var k in stat)stat[k].textContent=s.stats[k];
body.textContent='';s.participants.forEach(function(p){var tr=document.createElement('tr');cell(tr,p.name,'nm');cell(tr,p.submitTime,'mono');cell(tr,p.picks,'mono');body.append(tr)});
empty.hidden=s.participants.length>0;tbl.hidden=!s.participants.length}
function poll(){fetch(d.dataset.url,{headers:{accept:'application/json'},cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(s){
if(s){draw(s);if(s.state==='locked'){location.reload();return}}setTimeout(poll,${POLL_MS})}).catch(function(){setTimeout(poll,${POLL_MS})})}
if(d.dataset.live==='1')setTimeout(poll,${POLL_MS})})();`;

/** Metric cards + participants table. Server-rendered, then kept fresh by polling `statusUrl` while `live`. */
export const dashboardPanel = (status: DashboardStatus, statusUrl: string, live: boolean, emptyText: string) => {
  const { stats, participants } = status;
  return html`<section class="stack" data-dash data-url="${statusUrl}" data-live="${live ? "1" : "0"}" aria-label="Live dashboard">
    <div class="stats stats--3">
      <div class="stat"><span class="num" data-stat="participants">${stats.participants}</span><span class="cap">participants</span></div>
      <div class="stat"><span class="num" data-stat="medianPicks">${stats.medianPicks}</span><span class="cap">median picks</span></div>
      <div class="stat"><span class="num" data-stat="uniquePicks">${stats.uniquePicks}</span><span class="cap">unique picks</span></div>
    </div>
    <p class="small muted" data-empty ${participants.length ? "hidden" : ""}>${emptyText}</p>
    <div class="tablewrap scroll">
      <table class="t dash-table" aria-live="polite" aria-label="Participants" ${participants.length ? "" : "hidden"}>
        <thead><tr><th scope="col">Name</th><th scope="col">Submit time (s)</th><th scope="col">Picks</th></tr></thead>
        <tbody data-rows>${participants.map(
          (p) => html`<tr><td class="nm">${p.name}</td><td class="mono">${p.submitTime}</td><td class="mono">${p.picks}</td></tr>`,
        )}</tbody>
      </table>
    </div>
  </section>
  <script>${raw(DASH_JS)}</script>`;
};
