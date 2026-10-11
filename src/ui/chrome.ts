import { html, raw } from "hono/html";
import { logoMarkSvg } from "./logo";
import { COLOR as C } from "./tokens";

/**
 * Shared site header + footer (#34). Every page renderer calls siteHeader() right after <body> and
 * siteFooter() right before </body>, and includes CHROME_CSS in its <style>. Colours are literals so
 * the block renders identically regardless of which page stylesheet surrounds it.
 */
const MARK = logoMarkSvg(C.bone, C.indigo, 18);

/** Favicon, apple-touch icon, manifest and theme-color (served from public/). Every page head includes this. */
export const brandHead = () => html`<link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta name="theme-color" content="${C.indigo}" />`;

export const siteHeader = (opts: { organizer?: boolean } = {}) => html`<header class="site-header">
  <div class="site-inner">
    <a class="site-brand" href="/">${raw(MARK)}<span>MumbahJumbah</span></a>
    ${opts.organizer ? html`<span class="site-chip">Organizer</span>` : ""}
  </div>
</header>`;

export const siteFooter = () => html`<footer class="site-footer">
  <div class="site-inner">
    <span>© ${new Date().getUTCFullYear()} MumbahJumbah</span>
    <nav aria-label="Footer"><a href="/plans">See plans</a> · <a href="/#privacy">Privacy</a></nav>
  </div>
</footer>`;

export const CHROME_CSS = `
.site-header,.site-footer{box-sizing:border-box;width:100%;font-family:'Archivo',system-ui,sans-serif}
.site-header *,.site-footer *{box-sizing:border-box}
.site-header{background:#1F2F63;color:#F4EFE6}
.site-inner{max-width:80rem;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.site-header .site-inner{height:56px;justify-content:flex-start}
.site-brand{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-weight:800;font-size:17px;line-height:1.2;color:#F4EFE6;text-decoration:none}
.site-brand:hover{color:#F4EFE6}
.site-chip{margin-left:auto;font:400 10px/1.2 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;padding:3px 9px;border-radius:99px;background:#E3C26E;color:#17140F}
.site-footer{background:#F4EFE6;border-top:1.5px solid #17140F;color:#5F5648;font-size:12px;line-height:1.4}
.site-footer .site-inner{padding-top:20px;padding-bottom:28px;flex-wrap:wrap}
.site-footer a{color:#5F5648;font-weight:600;text-decoration:none;display:inline-block;padding:10px 4px;margin:-10px -4px}
.site-footer a:hover{color:#8F2B22}
.site-header a:focus-visible{outline:2px solid #E3C26E;outline-offset:2px;border-radius:2px}
.site-footer a:focus-visible{outline:2px solid #1F2F63;outline-offset:2px;border-radius:2px}
@media(min-width:900px){
.site-inner{padding:0 80px}
.site-header .site-inner{height:72px}
.site-brand{font-size:20px;gap:10px}
.site-footer{font-size:13px}
.site-footer .site-inner{padding-top:28px}
}
`;
