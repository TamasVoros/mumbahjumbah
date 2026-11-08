import { html, raw } from "hono/html";
import { errorCard, shell as uiShell } from "../ui/components";
import { CHROME_CSS, brandHead, siteFooter, siteHeader } from "../ui/chrome";
import { page } from "./shell";

const errorCss = `
*{box-sizing:border-box}
body{margin:0;background:#F4EFE6;color:#17140F;font-family:'Archivo',system-ui,sans-serif;}
.error-card{margin:32px auto}
.error-card{width:100%;max-width:420px;border:1.5px solid #17140F;border-radius:2px;overflow:hidden;background:#F4EFE6;display:flex;flex-direction:column}
.error-card header{background:#1F2F63;color:#F4EFE6;padding:24px;display:flex;flex-direction:column;gap:6px}
.error-code{font-family:'Anton',sans-serif;font-size:56px;line-height:1;color:#E3C26E}
.error-card h1{margin:0;font-weight:800;font-size:20px;line-height:1.15;overflow-wrap:anywhere}
.error-body{padding:20px 24px 24px;display:flex;flex-direction:column;gap:16px}
.error-body p{margin:0;font-size:14px;line-height:1.5;color:#5F5648}
.error-actions{display:flex;flex-direction:column;gap:8px}
.error-action{display:block;min-height:44px;border:1.5px solid #17140F;border-radius:2px;padding:12px;text-align:center;font-weight:700;font-size:14px;background:#fff;color:#17140F;text-decoration:none}
.error-action:hover{color:#8F2B22}
`;

export const errorPage = (
  title: string,
  code: string,
  headline: string,
  message: string,
  actions: { href: string; label: string }[],
) => html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    ${brandHead()}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;700;800&display=swap" rel="stylesheet" />
    <style>${raw(errorCss)}${raw(CHROME_CSS)}</style>
  </head>
  <body>
    ${siteHeader()}
    <main class="error-card">
      <header><span class="error-code">${code}</span><h1>${headline}</h1></header>
      <div class="error-body">
        <p>${message}</p>
        <div class="error-actions">
          ${actions.map((a) => html`<a class="error-action" href="${a.href}">${a.label}</a>`)}
        </div>
      </div>
    </main>
    ${siteFooter()}
  </body>
</html>`;

export const notFoundPage = () =>
  errorPage(
    "Not found",
    "404",
    "That link doesn’t go anywhere.",
    "Either it was mistyped or the session was cleared. Ask your organizer for a fresh one.",
    [{ href: "/", label: "Back to start" }],
  );

// An Invite Link opened before the Organizer has saved a Session Name: a friendly 403, never a 404 or a pick form.
export const notOpenYetPage = () =>
  uiShell(
    "Not open yet",
    errorCard("SOON", "This session isn’t open yet.", "The organizer hasn’t finished setting it up. Check back in a minute.", {
      href: "",
      label: "Try again",
    }),
  );

export const organizersOnlyPage = (inviteToken: string) =>
  uiShell(
    "Organizers only",
    errorCard("403", "Organizers only.", raw("This page needs the private organizer link. The invite link won't open it."), {
      href: `/i/${inviteToken}`,
      label: "Use the invite link",
    }),
  );

export const notLocked = () =>
  page("Leaderboard not ready", html`<h1>Leaderboard not ready</h1><p>The leaderboard appears once the Organizer has locked the Session and uploaded a Transcript.</p>`);

export const tooManyRequestsPage = () =>
  errorPage(
    "Slow down",
    "429",
    "Easy there. Too many requests.",
    "You’ve hit the limit for now. Wait a minute, then try again.",
    [{ href: "/", label: "Back to start" }],
  );
