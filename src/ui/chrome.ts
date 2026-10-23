import { html, raw } from "hono/html";
import { logoMarkSvg } from "./logo";
import { COLOR as C } from "./tokens";

/**
 * Shared site header + footer (#34). Every page renderer calls siteHeader() right after <body> and
 * siteFooter() right before </body>, and includes CHROME_CSS in its <style>. Colours are literals so
 * the block renders identically regardless of which page stylesheet surrounds it.
 * Mark width is set in CSS (22px mobile, 28px desktop); the attribute is the no-CSS fallback.
 */
const MARK = logoMarkSvg(C.bone, C.indigo, 22);

/** Favicon, apple-touch icon, manifest and theme-color (served from public/). Every page head includes this. */
export const brandHead = () => html`<link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta name="theme-color" content="${C.indigo}" />`;

/** Menu items, in order. A future "Sign in" item slots in here (phase 2); the nav carries no status pills. */
const MENU: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/plans", label: "See plans" },
  { href: "/#privacy", label: "Privacy" },
];

/** <details> works without JS; this mirrors aria-expanded and adds Escape / outside-click close. */
const MENU_JS = `(function(){var d=document.querySelector('.site-menu');if(!d)return;var s=d.querySelector('summary');
function sync(){s.setAttribute('aria-expanded',d.open?'true':'false')}
d.addEventListener('toggle',sync);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&d.open){d.open=false;s.focus()}});
document.addEventListener('click',function(e){if(d.open&&!d.contains(e.target))d.open=false});
sync()})();`;

export const siteHeader = () => html`<header class="site-header">
  <div class="site-inner">
    <a class="site-brand" href="/">${raw(MARK)}<span>MumbahJumbah</span></a>
    <details class="site-menu">
      <summary aria-label="Menu" aria-controls="site-menu-panel" aria-expanded="false">
        <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true"><path d="M0 1h22M0 8h22M0 15h22" stroke="currentColor" stroke-width="2" fill="none"/></svg>
      </summary>
      <nav id="site-menu-panel" class="site-menu__panel" aria-label="Site">
        ${MENU.map((m) => html`<a href="${m.href}">${m.label}</a>`)}
      </nav>
    </details>
  </div>
  <script type="module">${raw(MENU_JS)}</script>
</header>`;

export const siteFooter = () => html`<footer class="site-footer">
  <div class="site-inner">
    <span>© ${new Date().getUTCFullYear()} MumbahJumbah</span>
    <nav aria-label="Footer"><a href="/plans">See plans</a> · <a href="/#privacy">Privacy</a></nav>
  </div>
</footer>`;

/*
 * One container rule (.site-inner) for header and footer on every page shell. html{scrollbar-gutter}
 * keeps the viewport width identical whether or not a page scrolls; the body flex column pins the
 * footer to the bottom of short pages without any per-page min-height hacks.
 */
export const CHROME_CSS = `
html{scrollbar-gutter:stable}
body{min-height:100vh;display:flex;flex-direction:column}
body>*{width:100%}
body>main,body>.wrap{flex:1 0 auto}
.site-header,.site-footer{box-sizing:border-box;width:100%;font-family:'Archivo',system-ui,sans-serif}
.site-header *,.site-footer *{box-sizing:border-box}
.site-header{position:relative;z-index:20;background:#1F2F63;color:#F4EFE6}
.site-inner{width:100%;max-width:80rem;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.site-header .site-inner{height:64px}
.site-brand{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-weight:800;font-size:20px;line-height:1.2;color:#F4EFE6;text-decoration:none}
.site-brand:hover{color:#F4EFE6}
.site-brand svg{width:22px;height:auto;flex:none}
.site-menu{position:relative;margin-right:-10px}
.site-menu summary{list-style:none;display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:2px;color:#F4EFE6;cursor:pointer}
.site-menu summary::-webkit-details-marker{display:none}
.site-menu[open] summary,.site-menu summary:hover{background:#172352}
.site-menu__panel{position:absolute;right:0;top:100%;min-width:200px;display:flex;flex-direction:column;background:#1F2F63;border:1.5px solid #F4EFE6;border-radius:2px;padding:6px}
.site-menu__panel a{display:flex;align-items:center;min-height:44px;padding:0 12px;border-radius:2px;color:#F4EFE6;font-weight:600;font-size:15px;text-decoration:none}
.site-menu__panel a:hover{background:#172352;color:#F4EFE6}
.step-strip{box-sizing:border-box;width:100%;background:#F4EFE6;color:#17140F}
.step-strip *{box-sizing:border-box}
.step-strip__in{max-width:80rem;margin:0 auto;padding:10px 24px;display:flex;flex-direction:column;gap:8px}
.step-strip__label{margin:0;font:400 11px/1.3 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#5F5648;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.step-strip__label b{font-weight:700;color:#17140F}
.step-strip__steps{display:flex;gap:4px;margin:0;padding:0;list-style:none}
.step-strip__steps li{position:relative;flex:1;min-width:0;height:8px;border:1.5px solid #17140F;border-radius:2px;background:transparent}
.step-strip__steps li.is-done{background:#1F2F63}
.step-strip__steps li.is-current{background:#E3C26E}
.step-strip--player .step-strip__steps{align-items:center;gap:6px}
.step-strip--player .step-strip__steps li{flex:0 1 auto;height:auto;border:1.5px solid transparent;border-radius:99px;padding:3px 9px;font:400 11px/1.3 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;color:#5F5648}
.step-strip--player .step-strip__steps li.is-done{background:transparent;color:#1F2F63}
.step-strip--player .step-strip__steps li.is-current{background:#E3C26E;border-color:#17140F;color:#17140F;font-weight:700}
.step-strip--player .step-strip__steps li+li{margin-left:14px}
.step-strip--player .step-strip__steps li+li::before{content:"→";position:absolute;left:-14px;top:50%;transform:translateY(-50%);width:14px;text-align:center;color:#5F5648;font-weight:400}
.step-strip__sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.site-footer{margin-top:auto;background:#F4EFE6;border-top:1.5px solid #17140F;color:#5F5648;font-size:12px;line-height:1.4}
.site-footer .site-inner{padding-top:20px;padding-bottom:28px;flex-wrap:wrap}
.site-footer a{color:#5F5648;font-weight:600;text-decoration:none;display:inline-block;padding:10px 4px;margin:-10px -4px}
.site-footer a:hover{color:#8F2B22}
.site-header a:focus-visible,.site-header summary:focus-visible{outline:2px solid #E3C26E;outline-offset:2px;border-radius:2px}
.site-footer a:focus-visible{outline:2px solid #1F2F63;outline-offset:2px;border-radius:2px}
@media(min-width:900px){
.site-inner{padding:0 80px}
.step-strip__in{padding-left:80px;padding-right:80px}
.site-header .site-inner{height:72px}
.site-brand{font-size:24px;gap:10px}
.site-brand svg{width:28px}
.site-footer{font-size:13px}
.site-footer .site-inner{padding-top:20px;padding-bottom:20px}
}
`;
