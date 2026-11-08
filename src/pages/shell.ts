import { html, raw } from "hono/html";
import { CHROME_CSS, brandHead, siteFooter, siteHeader } from "../ui/chrome";

const ZIGZAG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M0 12L8 4L16 12' fill='none' stroke='%23D2432C' stroke-width='2.5'/%3E%3C/svg%3E\")";

// Shared stylesheet (DESIGN.md direction 2A). Server-rendered and inline: no frontend framework.
const CSS = `
:root { --indigo:#1F2F63; --bone:#F4EFE6; --paper:#fff; --ink:#17140F; --muted:#5F5648; --placeholder:#8A8070; --red:#D2432C; --red-hover:#8F2B22; --raffia:#E3C26E; --ring:rgba(31,47,99,.12); }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--bone); color: var(--ink); font: 400 15px/1.5 Archivo, system-ui, sans-serif; overflow-x: hidden; }
h1, h2, h3, p { margin: 0; }
a { color: var(--red); }
a:hover { color: var(--red-hover); }
a:focus-visible, button:focus-visible { outline: 2px solid var(--indigo); outline-offset: 2px; }
.on-indigo a:focus-visible { outline-color: var(--raffia); }
.mono { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.mono.accent { color: var(--raffia); }
.wrap { padding-left: 24px; padding-right: 24px; }
.container { max-width: 1120px; margin: 0 auto; }
.hero { display: flow-root; background: var(--indigo); color: var(--bone); padding-bottom: 32px; }
.hero-grid { display: grid; gap: 28px; margin-top: 22px; }
.hero-copy { display: flex; flex-direction: column; gap: 14px; }
.hero h1 { font-weight: 800; font-size: 32px; line-height: 1.05; letter-spacing: -.01em; }
.hero-copy p { font-size: 15px; color: var(--bone); }
.hero-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
.btn { display: block; border-radius: 2px; padding: 15px; text-align: center; font: 700 16px/1.3 Archivo, system-ui, sans-serif; text-decoration: none; cursor: pointer; border: 1.5px solid transparent; min-height: 48px; }
.btn-red { background: var(--red); color: #fff; width: 100%; }
.btn-red:hover { color: #fff; background: var(--red-hover); }
.btn-outline { border-color: var(--ink); color: var(--ink); }
.btn-outline:hover { color: var(--ink); }
.btn-bone { border-color: var(--bone); color: var(--bone); }
.btn-bone:hover { color: var(--bone); }
.card { background: var(--paper); color: var(--ink); border: 1.5px solid var(--ink); border-radius: 2px; overflow: hidden; }
.card-body { padding: 24px 20px; display: flex; flex-direction: column; gap: 22px; }
.card h2 { font-weight: 800; font-size: 26px; line-height: 1.1; }
.hint { font-size: 13px; line-height: 1.45; color: var(--muted); }
.error { border: 1.5px solid var(--red); border-radius: 2px; padding: 12px 14px; font-weight: 600; }
.pills { border: 0; padding: 0; margin: 0; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.pills legend { padding: 0; font-size: 14px; font-weight: 700; margin-bottom: 8px; }
.pills .row { display: flex; gap: 8px; }
.pills label { flex: 1; cursor: pointer; position: relative; display: block; }
.pills input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
.pills span { display: block; text-align: center; min-height: 48px; line-height: 45px; padding: 0 8px; border: 1.5px solid var(--ink); border-radius: 2px; background: var(--paper); font-weight: 700; }
.pills input:checked + span { background: var(--indigo); border-color: var(--indigo); color: #fff; }
.pills input:focus-visible + span { border-color: var(--indigo); box-shadow: 0 0 0 3px var(--ring), 0 0 0 5px var(--indigo); }
.field { display: flex; flex-direction: column; gap: 8px; font-size: 14px; font-weight: 700; }
.field input { font: 400 15px Archivo, system-ui, sans-serif; background: var(--paper); border: 1.5px solid var(--ink); border-radius: 2px; padding: 13px 14px; min-height: 52px; width: 100%; color: var(--ink); }
.field .hint { font-weight: 400; }
#custom-pick input { width: calc((100% - 16px) / 3); min-height: 48px; padding: 0 14px; }
.field input::placeholder { color: var(--placeholder); }
.field input:focus { outline: none; border-color: var(--indigo); box-shadow: 0 0 0 3px var(--ring); }
.zig { height: 16px; background: ${ZIGZAG} repeat-x; margin: 0 -20px 8px; }
.section { padding-top: 40px; padding-bottom: 8px; display: flex; flex-direction: column; gap: 24px; }
.steps { display: flex; flex-direction: column; gap: 24px; }
.step { display: flex; gap: 14px; }
.step .n { font: 400 26px/1 Anton, Impact, sans-serif; color: var(--indigo); width: 22px; flex: none; }
.step h3 { font-weight: 700; font-size: 15px; }
.step p { font-size: 13px; line-height: 1.45; color: var(--muted); margin-top: 3px; }
.who { padding-top: 32px; padding-bottom: 32px; display: flex; flex-direction: column; gap: 14px; }
.who .card { padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.who h3 { font-weight: 800; font-size: 17px; }
.who p { font-size: 13px; line-height: 1.45; color: var(--muted); }
.band { background: var(--raffia); padding-top: 32px; padding-bottom: 32px; }
.band .container { display: flex; flex-direction: column; gap: 14px; }
.band h2 { font-weight: 800; font-size: 24px; line-height: 1.15; }
.band .actions { display: flex; gap: 10px; flex-wrap: wrap; }
.band .btn { padding: 13px 18px; font-size: 15px; width: auto; }
.plain { padding-top: 32px; padding-bottom: 32px; max-width: 720px; margin: 0 auto; }
@media (min-width: 900px) {
  .wrap { padding-left: 80px; padding-right: 80px; }
  .hero { padding-bottom: 88px; }
  .hero-grid { grid-template-columns: 1.15fr 1fr; gap: 80px; align-items: center; margin-top: 40px; }
  .hero-copy { gap: 22px; }
  .hero h1 { font-size: 68px; line-height: 1.02; letter-spacing: -.02em; }
  .hero-copy p { font-size: 19px; max-width: 520px; }
  .hero-actions { flex-direction: row; gap: 14px; margin-top: 10px; }
  .hero .btn { width: auto; padding: 17px 32px; font-size: 17px; }
  .mono.accent { font-size: 13px; }
  .card-body { padding: 36px 36px 28px; gap: 24px; }
  .card h2 { font-size: 32px; }
  .zig { margin: 0 -36px 8px; }
  .field input { font-size: 16px; }
  .pills .row { gap: 10px; }
  #custom-pick input { width: calc((100% - 20px) / 3); }
  .field input:focus { box-shadow: 0 0 0 4px var(--ring); }
  .pills input:focus-visible + span { box-shadow: 0 0 0 4px var(--ring), 0 0 0 6px var(--indigo); }
  .section { padding: 80px 0; display: grid; grid-template-columns: 1fr 2fr; gap: 64px; }
  .section h2 { font-weight: 800; font-size: 34px; line-height: 1.1; margin-top: 12px; }
  .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
  .step { flex-direction: column; gap: 10px; }
  .step .n { font-size: 44px; width: auto; }
  .step h3 { font-size: 18px; }
  .step p { font-size: 14px; line-height: 1.5; margin-top: 0; }
  .who { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; padding: 0 0 80px; }
  .who .mono { grid-column: 1 / -1; }
  .who .card { padding: 32px; gap: 8px; }
  .who h3 { font-size: 24px; }
  .who p { font-size: 15px; line-height: 1.5; }
  .band { padding-top: 56px; padding-bottom: 56px; }
  .band .container { flex-direction: row; align-items: center; justify-content: space-between; }
  .band h2 { font-size: 34px; line-height: 1.1; }
  .band .btn { padding: 16px 28px; font-size: 16px; }
}
`;

export const shell = (title: string, body: unknown, head?: unknown) => html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    ${brandHead()}
    ${head ?? ""}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap"
    />
    <style>
      ${raw(CSS)}${raw(CHROME_CSS)}
    </style>
  </head>
  <body>
    ${siteHeader()}
    ${body}
    ${siteFooter()}
  </body>
</html>`;

// Other pages get a plain readable column until they are restyled; the landing page is full-bleed (bare).
export const page = (title: string, content: unknown, bare = false, head?: unknown) => {
  const body = bare ? content : html`<main class="plain wrap">${content}</main>`;
  return shell(title, body, head);
};

export const LANDING_TITLE = "MumbahJumbah: Predict the jargon. Win the meeting.";
const LANDING_DESCRIPTION = "Reverse bingo for meetings. Pick the buzzwords you think will be said, then see who called it.";
export const SOCIAL_HEAD = html`<meta name="description" content="${LANDING_DESCRIPTION}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="MumbahJumbah" />
    <meta property="og:title" content="${LANDING_TITLE}" />
    <meta property="og:description" content="${LANDING_DESCRIPTION}" />
    <meta property="og:url" content="https://mumbahjumbah.com/" />
    <meta property="og:image" content="https://mumbahjumbah.com/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />`;
