import { html, raw } from "hono/html";
import { brandHead, CHROME_CSS, siteFooter, siteHeader } from "../ui/chrome";
import { getLeaderboard } from "../leaderboard";
import { getJargonResult } from "../jargon";
import type { Session } from "../sessions";

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

export const leaderboardPage = async (db: D1Database, session: Session, recapUrl: string, organizer = false) => {
  const [board, jargon] = await Promise.all([getLeaderboard(db, session.id), getJargonResult(db, session.id)]);
  const maxWord = Math.max(1, ...jargon.map((j) => j.occurrences));
  const topScore = Math.max(1, ...board.map((e) => e.score));
  return html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Leaderboard</title>
    ${brandHead()}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;600;700;800&family=JetBrains+Mono&display=swap" rel="stylesheet" />
    <style>${raw(LEADERBOARD_CSS)}${raw(CHROME_CSS)}</style>
  </head>
  <body>
    ${siteHeader({ organizer })}
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
        <div class="mono">${session.name ?? `Session ${session.id}`}</div>
        <h1 id="lb-h">Leaderboard: ${session.name ?? `Session ${session.id}`}</h1>
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
    ${siteFooter()}
  </body>
</html>`;
};
