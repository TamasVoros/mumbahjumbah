import { COLOR as C } from "./tokens";

const ZIG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M0 12L8 4L16 12' fill='none' stroke='%23D2432C' stroke-width='2.5'/%3E%3C/svg%3E")`;

/** Inline into <style> in the page shell. Mobile first; desktop rules at min-width 960px. */
export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&family=Anton&family=JetBrains+Mono:wght@400;700&display=swap');
:root{--indigo:${C.indigo};--night:${C.night};--indigo-line:${C.indigoLine};--indigo-bar:${C.indigoBar};--bone:${C.bone};--paper:${C.paper};--sand:${C.sand};--sand-bar:${C.sandBar};--ink:${C.ink};--muted:${C.muted};--ph:${C.placeholder};--red:${C.red};--raffia:${C.raffia};--raffia-dark:${C.raffiaDark};
--ui:'Archivo',system-ui,sans-serif;--num:'Anton',Impact,sans-serif;--mono:'JetBrains Mono',ui-monospace,monospace;--b:1.5px solid var(--ink)}
*{box-sizing:border-box}
body{margin:0;background:var(--bone);color:var(--ink);font:400 15px/1.5 var(--ui)}
a{color:var(--red)}a:hover{color:#8F2B22}
:focus-visible{outline:2px solid var(--indigo);outline-offset:2px}
.screen{max-width:640px;margin:0 auto;padding:32px 24px 24px;display:flex;flex-direction:column;gap:24px}
.screen--wide{max-width:1120px}
h1,h2{margin:0;font-weight:800;line-height:1.1}
h1{font-size:28px}h2{font-size:22px}
.hero{font-size:32px;line-height:1.05;letter-spacing:-.01em;font-weight:800}
.muted{color:var(--muted)}.small{font-size:13px;line-height:1.45}.cap{font-size:12px;line-height:1.4;color:var(--muted)}
.label{font:400 11px/1.4 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.num{font-family:var(--num);font-weight:400;line-height:1}
.mono{font-family:var(--mono)}
/* buttons */
.btn{display:block;width:100%;border:1.5px solid transparent;border-radius:2px;padding:15px;text-align:center;font:700 16px/1.2 var(--ui);cursor:pointer;text-decoration:none}
.btn--primary{background:var(--red);color:#fff;border-color:var(--red)}
.btn--secondary{background:var(--indigo);color:#fff;border-color:var(--indigo)}
.btn--ghost{background:var(--paper);color:var(--ink);border-color:var(--ink)}
.btn[disabled],.btn[aria-disabled=true]{opacity:.5;cursor:not-allowed}
.btn--inline{display:inline-block;width:auto}
.pillbtn{display:inline-block;border:var(--b);border-radius:99px;padding:6px 16px;font:600 13px/1.2 var(--ui);color:inherit;text-decoration:none}
/* fields */
.field{width:100%;background:var(--paper);border:var(--b);border-radius:2px;padding:13px;font:400 15px/1.3 var(--ui);color:var(--ink)}
.field::placeholder{color:var(--ph)}
.field:focus{border-color:var(--indigo);box-shadow:0 0 0 3px rgba(31,47,99,.12);outline:none}
.seg{display:flex;gap:8px}.seg>*{flex:1;text-align:center;padding:12px 0;border:var(--b);border-radius:2px;background:var(--paper);font-weight:700}
.seg>[aria-pressed=true],.seg>input:checked+span{background:var(--indigo);color:#fff;border-color:var(--indigo)}
/* chips */
.chip{display:inline-block;font:400 10px/1.2 var(--mono);letter-spacing:.06em;text-transform:uppercase;padding:3px 9px;border-radius:99px;border:1.5px solid transparent}
.chip--open,.chip--private{background:var(--raffia);color:var(--ink)}
.chip--submitted{background:var(--indigo);color:var(--bone)}
.chip--pending{background:var(--paper);color:var(--muted);border-color:var(--ink)}
.chip--locked,.chip--scored{background:transparent;color:inherit;border-color:currentColor}
/* cards, rows */
.card{background:var(--paper);border:var(--b);border-radius:2px;padding:12px 14px}
.card--private{border-style:dashed}
.stamp{font:400 10.5px/1.4 var(--mono);letter-spacing:.04em;text-transform:uppercase;border:var(--b);border-radius:2px;padding:9px 12px;background:var(--paper)}
.progress{height:8px;border:var(--b);border-radius:99px;background:var(--paper);overflow:hidden}
.progress>i{display:block;height:100%;background:var(--indigo);width:0}
/* zigzag: full-bleed to its container; place directly above one committing action */
.zigzag{height:16px;background:${ZIG} repeat-x;margin-inline:-24px}
.zigzag--card{margin-inline:0}
/* pick entry */
.pick-entry .pick-ui[hidden],.pick-entry .pick-fallback[hidden]{display:none}
.pick-field{display:flex;align-items:center;gap:10px;background:var(--paper);border:1.5px solid var(--indigo);border-radius:2px;padding:0 8px 0 14px;height:52px;box-shadow:0 0 0 3px rgba(31,47,99,.12)}
.pick-field input{flex:1;border:0;outline:0;background:transparent;font:400 15px var(--ui);min-width:0}
.pick-field button{background:var(--indigo);color:#fff;border:0;border-radius:2px;padding:10px 14px;font:700 13px var(--ui);cursor:pointer}
.pills{display:flex;flex-wrap:wrap;gap:8px}
.pill{display:inline-flex;align-items:center;gap:8px;background:var(--indigo);color:var(--bone);border-radius:99px;padding:8px 10px 8px 14px;font:600 14px/1.2 var(--ui)}
.pill button{all:unset;cursor:pointer;width:18px;height:18px;border-radius:99px;background:rgba(244,239,230,.2);display:inline-flex;align-items:center;justify-content:center;font-size:12px;position:relative}
.pill button::after{content:"";position:absolute;inset:-13px} /* 44px hit area */
/* leaderboard (indigo ground) */
.board{background:var(--indigo);color:var(--bone);min-height:100vh}
.winner{background:var(--raffia);color:var(--ink);border-radius:2px;padding:14px 16px;display:flex;align-items:center;gap:14px}
.winner .num:first-child{font-size:56px}.winner .num:last-child{font-size:44px}
.row{position:relative;overflow:hidden;display:flex;align-items:center;gap:12px;border:1.5px solid var(--indigo-line);background:var(--night);border-radius:2px;padding:0 14px;height:38px}
.row>i{position:absolute;inset:0 auto 0 0;background:var(--indigo-bar)}
.row>*{position:relative}.row .rank{font:400 12px var(--mono);width:20px;opacity:.7}.row .name{flex:1;font-weight:600;font-size:14px}.row .score{font:400 18px var(--num)}
.row--podium{border-color:var(--raffia)}.row--podium>i{background:var(--raffia-dark)}.row--podium .rank{font:400 22px var(--num);color:var(--raffia);opacity:1}
/* word result (paper ground) */
.word{position:relative;overflow:hidden;display:flex;align-items:center;gap:12px;background:var(--paper);border:var(--b);border-radius:2px;padding:0 14px;height:46px}
.word>i{position:absolute;inset:0 auto 0 0;background:var(--sand-bar)}.word:first-child>i{background:var(--raffia)}
.word>*{position:relative}.word .t{flex:1;font-weight:600}.word .by{font:400 10px var(--mono);color:var(--muted)}.word .n{font:400 22px var(--num);min-width:34px;text-align:right}
.word--zero{border-color:#C9C0AE}
/* tables (desktop) */
table.t{width:100%;border-collapse:collapse;background:var(--paper);border:var(--b)}
.t th{font:400 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:left;padding:12px 20px;border-bottom:var(--b)}
.t td{padding:0 20px;height:48px;border-bottom:1px solid rgba(23,20,15,.15)}
/* scroll lists: 7 rows + half-row peek */
.scroll{overflow-y:auto;scrollbar-width:none;padding-right:8px}
.scroll::-webkit-scrollbar{width:2px}.scroll::-webkit-scrollbar-thumb{background:rgba(23,20,15,.18);border-radius:99px}
.scroll:hover::-webkit-scrollbar-thumb{background:rgba(23,20,15,.4)}
.scrollhint{display:flex;justify-content:space-between;font:400 10px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
/* error pages */
.err{background:var(--indigo);color:var(--bone);padding:24px;display:flex;flex-direction:column;gap:6px}
.err .code{font:400 56px/1 var(--num);color:var(--raffia)}.err h1{font-size:20px}
.err-card{border:var(--b);border-radius:2px;overflow:hidden;background:var(--bone)}
.err-body{padding:20px 24px;display:flex;flex-direction:column;gap:16px}.err-body p{margin:0;font-size:14px;line-height:1.5;color:var(--muted)}
/* desktop */
@media(min-width:960px){
 .screen{padding:48px 64px}.hero{font-size:68px;line-height:1.02;letter-spacing:-.02em}h1{font-size:36px}
 .cols{display:grid;grid-template-columns:1fr 340px;gap:56px;align-items:start}
 .zigzag{margin-inline:0}
 .pill{font-size:18px;padding:12px 14px 12px 22px;gap:12px}.pills{gap:12px}
 .pick-field{height:76px;padding:0 24px}.pick-field input{font-size:22px}
}
`;
