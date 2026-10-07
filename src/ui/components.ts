import { html, raw } from "hono/html";
import { CSS } from "./styles";
import { COLOR as C } from "./tokens";

/** Replaces the bare `page()` in src/index.ts. */
export const shell = (title: string, body: unknown, opts: { board?: boolean; wide?: boolean } = {}) => html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>${raw(CSS)}</style>
  </head>
  <body class="${opts.board ? "board" : ""}">
    <main class="screen ${opts.wide ? "screen--wide" : ""}">${body}</main>
  </body>
</html>`;

/** 64x84 mask mark. fill = body colour, cut = ground colour (crown chevron + eyes + diamond mouth are cut-outs). */
export const logoMark = (fill: string = C.indigo, cut: string = C.bone, width = 18) =>
  raw(`<svg width="${width}" height="${Math.round((width * 84) / 64)}" viewBox="0 0 64 84" aria-hidden="true"><path d="M32 2C14 2 6 16 6 38c0 24 10 44 26 44s26-20 26-44C58 16 50 2 32 2Z" fill="${fill}"/><path d="M12 24L32 12L52 24" fill="none" stroke="${cut}" stroke-width="5"/><path d="M13 40L28 36L22 48Z" fill="${cut}"/><path d="M51 40L36 36L42 48Z" fill="${cut}"/><path d="M32 54L38 64L32 76L26 64Z" fill="${cut}"/></svg>`);

export const wordmark = (onIndigo = false) =>
  html`<span style="display:inline-flex;align-items:center;gap:8px;font-weight:800;font-size:17px">${logoMark(onIndigo ? C.bone : C.indigo, onIndigo ? C.indigo : C.bone)}MumbahJumbah</span>`;

/** Only directly above a committing action. Use card=true inside a bordered card. */
export const zigzag = (card = false) => html`<div class="zigzag ${card ? "zigzag--card" : ""}" role="presentation"></div>`;

export type ChipKind = "open" | "submitted" | "pending" | "locked" | "scored" | "private";
export const chip = (kind: ChipKind, text = kind.toUpperCase()) => html`<span class="chip chip--${kind}">${text}</span>`;

/**
 * Field + pills pick entry. Backend contract is unchanged: the form posts repeated `pick` fields
 * (validateGrid in src/grids.ts). Without JS the numbered fallback inputs are used; with JS they are
 * disabled and replaced by hidden inputs generated from the pills.
 */
export const pickEntry = (pickCount: number, picks: string[] = []) => html`
<div class="pick-entry" data-pick-entry data-max="${pickCount}">
  <div class="pick-ui" hidden>
    <div class="pick-field">
      <input class="pick-input" type="text" placeholder="Type a word or phrase…" autocomplete="off" enterkeyhint="done" aria-label="Add a pick" />
      <button type="button" class="pick-add">Add</button>
    </div>
    <p class="label" style="margin:22px 0 12px">Your picks · <span data-count>0</span> / ${pickCount}</p>
    <div class="pills" aria-live="polite"></div>
    <div class="progress" style="margin-top:22px"><i></i></div>
  </div>
  <ol class="pick-fallback">
    ${Array.from({ length: pickCount }, (_, i) => html`<li><input class="field" type="text" name="pick" value="${picks[i] ?? ""}" required /></li>`)}
  </ol>
</div>
<script>${raw(PICK_JS)}</script>`;

const PICK_JS = `(function(){var r=document.querySelector('[data-pick-entry]');if(!r)return;
var max=+r.dataset.max,ui=r.querySelector('.pick-ui'),fb=r.querySelector('.pick-fallback'),inp=r.querySelector('.pick-input'),box=r.querySelector('.pills'),cnt=r.querySelector('[data-count]'),bar=r.querySelector('.progress>i'),form=r.closest('form'),sub=form.querySelector('[data-submit]');
var picks=[].map.call(fb.querySelectorAll('input'),function(i){return i.value.trim()}).filter(Boolean);
[].forEach.call(fb.querySelectorAll('input'),function(i){i.disabled=true;i.required=false});fb.hidden=true;ui.hidden=false;
function has(v){return picks.some(function(p){return p.toLowerCase()===v.toLowerCase()})}
function draw(){box.textContent='';form.querySelectorAll('input[data-gen]').forEach(function(n){n.remove()});
picks.forEach(function(p,i){var s=document.createElement('span');s.className='pill';s.append(p);var b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Remove '+p);b.textContent='×';b.onclick=function(){picks.splice(i,1);draw()};s.append(b);box.append(s);
var h=document.createElement('input');h.type='hidden';h.name='pick';h.value=p;h.dataset.gen='1';form.append(h)});
cnt.textContent=picks.length;bar.style.width=(picks.length/max*100)+'%';var full=picks.length>=max;inp.disabled=full;r.querySelector('.pick-add').disabled=full;
inp.placeholder=full?'All '+max+' picked. Remove one to swap it.':'Type a word or phrase…';
if(sub){sub.disabled=picks.length!==max;sub.textContent=picks.length===max?'Submit grid':'Submit grid · '+(max-picks.length)+' to go'}}
function add(){var v=inp.value.trim();if(!v||has(v)||picks.length>=max)return;picks.push(v);inp.value='';draw();inp.focus()}
inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();add()}});r.querySelector('.pick-add').onclick=add;draw()})();`;
