import { html, raw } from "hono/html";
import { CSS } from "./styles";

/** Styled page shell (DESIGN.md direction 2A). Pages not yet restyled still use the bare `page()` in src/index.ts. */
export const shell = (title: string, body: unknown) => html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>${raw(CSS)}</style>
  </head>
  <body>
    <main class="screen">${body}</main>
  </body>
</html>`;

/** Mockup 8A error card: indigo header with the status code, explanation, one ghost button. */
export const errorCard = (code: string, heading: string, text: unknown, action: { href: string; label: string }) => html`
<div class="err-card">
  <div class="err"><span class="code">${code}</span><h1>${heading}</h1></div>
  <div class="err-body">
    <p>${text}</p>
    <a class="btn btn--ghost" href="${action.href}">${action.label}</a>
  </div>
</div>`;
