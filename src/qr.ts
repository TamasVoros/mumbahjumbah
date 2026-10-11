import qrcode from "qrcode-generator";

const QUIET = 4; // quiet-zone modules required by the QR spec

/** Builds the QR matrix for `text` (true = dark module). Error correction M, version auto-sized. */
export const qrMatrix = (text: string): boolean[][] => {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
};

/** Standalone SVG (white ground, ink modules, quiet zone included). No external references. */
export const qrSvg = (text: string, title = "QR code for the invite link"): string => {
  const m = qrMatrix(text);
  const size = m.length + QUIET * 2;
  let d = "";
  m.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="512" height="512" shape-rendering="crispEdges" role="img" aria-label="${title}"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#17140F"/></svg>`;
};
