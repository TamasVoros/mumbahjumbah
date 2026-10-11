import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { qrSvg } from "../../src/qr";

// Rasterises the generated SVG (viewBox grid, one unit per module) and decodes it with an independent decoder.
const decode = (svg: string, scale = 6) => {
  const size = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)![1]);
  const dark = new Set([...svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => `${m[1]},${m[2]}`));
  const w = size * scale;
  const px = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++)
      if (dark.has(`${Math.floor(x / scale)},${Math.floor(y / scale)}`)) {
        const i = (y * w + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = 0;
      }
  return jsQR(px, w, w)?.data;
};

describe("qrSvg", () => {
  it("decodes to the full invite URL", () => {
    const url = "https://mumbahjumbah.example/i/AbCdEf0123456789_-AbCdEf0123456789_-xyz";
    expect(decode(qrSvg(url))).toBe(url);
  });

  it("is self-contained: no external references or scripts", () => {
    const svg = qrSvg("https://example.com/i/abc");
    expect(svg.match(/https?:\/\/[^"]*/g)).toEqual(["http://www.w3.org/2000/svg"]);
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("href");
  });
});
