// Regenerates favicon.svg, favicon.ico, favicon-*.png, the PNG icons and the OG image in public/ from
// the full logo mark (DESIGN.md §5). Run: node scripts/build-brand-assets.mjs (needs sharp, not a project dependency).
import sharp from "sharp";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";

const INDIGO = "#1F2F63", BONE = "#F4EFE6";
const MARK = (fill, cut) =>
  `<path d="M32 2C14 2 6 16 6 38c0 24 10 44 26 44s26-20 26-44C58 16 50 2 32 2Z" fill="${fill}"/><path d="M12 24L32 12L52 24" fill="none" stroke="${cut}" stroke-width="5"/><path d="M13 40L28 36L22 48Z" fill="${cut}"/><path d="M51 40L36 36L42 48Z" fill="${cut}"/><path d="M32 54L38 64L32 76L26 64Z" fill="${cut}"/>`;

// Square tile: indigo ground, bone mark scaled to `frac` of the height, centred.
const tile = (size, frac, radius = 0) => {
  const h = size * frac, s = h / 84, w = 64 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${INDIGO}"/><g transform="translate(${(size - w) / 2} ${(size - h) / 2}) scale(${s})">${MARK(BONE, INDIGO)}</g></svg>`;
};

mkdirSync("public", { recursive: true });
const png = (svg, file, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toFile(file);

const faviconSvg = tile(64, 0.84, 8);
writeFileSync("public/favicon.svg", faviconSvg);
for (const n of [16, 32, 48]) await png(tile(64, 0.84, 8), `public/favicon-${n}.png`, n); // intermediate; ICO source
await png(tile(192, 0.78), "public/icon-192.png", 192);
await png(tile(512, 0.78), "public/icon-512.png", 512);
await png(tile(512, 0.56), "public/icon-maskable-512.png", 512); // mark inside the 80% safe zone
await png(tile(180, 0.78), "public/apple-touch-icon.png", 180);

// favicon.ico: PNG-compressed 16/32/48 frames.
const frames = await Promise.all([16, 32, 48].map((n) => sharp(`public/favicon-${n}.png`).png().toBuffer()));
const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(frames.length, 4);
let offset = 6 + 16 * frames.length;
const dir = frames.map((buf, i) => {
  const e = Buffer.alloc(16), n = [16, 32, 48][i];
  e[0] = n; e[1] = n; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
  offset += buf.length; return e;
});
writeFileSync("public/favicon.ico", Buffer.concat([head, ...dir, ...frames]));

// OG image 1200x630, recap-card style: indigo ground, mark + wordmark + tagline. Satori outlines the
// Archivo text to paths, so no font is needed at render time. No zigzag: it only sits above a committing action.
const { default: satori } = await import("satori");
const { readFileSync } = await import("node:fs");
const font = (w) => ({ name: "Archivo", weight: w, style: "normal", data: readFileSync(`src/fonts/archivo-latin-${w}-normal.woff`) });
const markUri = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 84" width="132" height="173">${MARK(BONE, INDIGO)}</svg>`).toString("base64")}`;
const box = (style, children) => ({ type: "div", props: { style: { display: "flex", ...style }, children } });
const tree = box({ width: 1200, height: 630, background: INDIGO, flexDirection: "column", justifyContent: "center", padding: "0 96px", color: BONE, fontFamily: "Archivo" }, [
  { type: "img", props: { src: markUri, width: 132, height: 173 } },
  box({ fontSize: 104, fontWeight: 800, marginTop: 36, lineHeight: 1 }, "MumbahJumbah"),
  box({ fontSize: 44, fontWeight: 800, marginTop: 20 }, "Predict the jargon. Win the meeting."),
]);
const ogSvg = await satori(tree, { width: 1200, height: 630, fonts: [font(800)] });
await sharp(Buffer.from(ogSvg)).png().toFile("public/og-image.png");

// Static brand files: svgs and manifest are copied as-is.
copyFileSync("docs/design/brand/site.webmanifest", "public/site.webmanifest");
copyFileSync("public/favicon.svg", "docs/design/brand/favicon.svg");
for (const n of [16, 32, 48]) copyFileSync(`public/favicon-${n}.png`, `docs/design/brand/favicon-${n}.png`);
for (const f of ["favicon.ico", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"])
  copyFileSync(`public/${f}`, `docs/design/brand/${f}`);
