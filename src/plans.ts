import { html, raw } from "hono/html";

// Placeholder pricing copied from mockups 6A / D6. Not real pricing (DESIGN.md open items).
type Plan = {
  key: "team" | "coach" | "organization";
  name: string;
  price: string;
  line: string;
  feats: string[];
  btn: string;
  href?: string;
};

export const PLANS: Plan[] = [
  {
    key: "team",
    name: "Team",
    price: "FREE",
    line: "For a one-off with your own team.",
    feats: ["Unlimited players", "3 sessions a month", "Leaderboard and recap card"],
    btn: "Start free",
    href: "/",
  },
  {
    key: "coach",
    name: "Coach",
    price: "PRICE TBC",
    line: "Your logo, your colours, your link.",
    feats: ["Unlimited sessions", "White-label branding", "Session history"],
    btn: "Choose Coach",
  },
  {
    key: "organization",
    name: "Organization",
    price: "ON REQUEST",
    line: "For HR and engagement programmes.",
    feats: ["Multiple organizers", "Custom domain", "Priority support"],
    btn: "Get in touch",
  },
];

const css = `
*{box-sizing:border-box}
body{margin:0;background:#F4EFE6;color:#17140F;font-family:'Archivo',system-ui,sans-serif;font-size:15px;line-height:1.5}
main{max-width:1280px;margin:0 auto;padding:32px 24px 56px}
h1{font-weight:800;font-size:30px;line-height:1.1;margin:0 0 8px}
.sub{font-size:14px;color:#5F5648;margin:0 0 28px}
.plans{display:flex;flex-direction:column;gap:16px}
.plan{display:flex;flex-direction:column;gap:14px;padding:22px 20px;border:1.5px solid #17140F;border-radius:2px;background:#fff;color:#17140F}
.plan-coach{background:#1F2F63;color:#F4EFE6}
.plan-organization{background:#F4EFE6;border-style:dashed}
.head{display:flex;justify-content:space-between;align-items:center;gap:12px}
.name{font-weight:800;font-size:20px}
.price{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;background:#E3C26E;color:#17140F;border-radius:99px;padding:3px 10px;white-space:nowrap}
.plan-organization .price{background:transparent;color:#5F5648;padding:3px 0}
.line{margin:0;font-size:13px;line-height:1.45}
.plan-team .line,.plan-organization .line{color:#5F5648}
.plan-coach .line{opacity:.85}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px;flex:1}
li{display:flex;align-items:center;gap:9px}
li::before{content:"";width:10px;height:10px;flex:none;background:#1F2F63;transform:rotate(45deg) scale(.8)}
.plan-coach li::before{background:#E3C26E}
.plan-organization li::before{background:#D2432C}
.cta{display:block;width:100%;min-height:44px;padding:15px;border:1.5px solid #17140F;border-radius:2px;font:700 15px 'Archivo',system-ui,sans-serif;text-align:center;text-decoration:none;cursor:pointer;background:#17140F;color:#F4EFE6}
.plan-coach .cta{background:#D2432C;border-color:#D2432C;color:#fff}
.plan-organization .cta{background:#F4EFE6;color:#17140F}
.cta:focus-visible{outline:none;border-color:#1F2F63;box-shadow:0 0 0 3px rgba(31,47,99,.12)}
@media(min-width:900px){
main{padding:56px 80px 80px}
h1{font-size:44px}
.sub{font-size:18px;margin-bottom:40px}
.plans{flex-direction:row;gap:24px;align-items:stretch}
.plan{flex:1;min-width:0;padding:32px 28px;gap:18px}
.name{font-size:24px}
.line{font-size:15px}
.cta{padding:16px;font-size:16px}
}
`;

export const plansPage = () => html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Plans</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800&family=JetBrains+Mono&display=swap" rel="stylesheet" />
    <style>${raw(css)}</style>
  </head>
  <body>
    <main>
      <h1>Plans</h1>
      <p class="sub">Start free. Pay when it’s your brand on the screen.</p>
      <div class="plans">
        ${PLANS.map(
          (p) => html`<section class="plan plan-${p.key}">
            <div class="head"><span class="name">${p.name}</span><span class="price">${p.price}</span></div>
            <p class="line">${p.line}</p>
            <ul>${p.feats.map((f) => html`<li>${f}</li>`)}</ul>
            ${p.href
              ? html`<a class="cta" href="${p.href}">${p.btn}</a>`
              : html`<button type="button" class="cta">${p.btn}</button>`}
          </section>`,
        )}
      </div>
    </main>
  </body>
</html>`;
