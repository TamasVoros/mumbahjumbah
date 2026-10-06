// Design tokens (direction 2A). Single source for HTML CSS vars and Satori (recap card).
export const COLOR = {
  indigo: "#1F2F63",
  night: "#172352",
  indigoLine: "#3C4E8A",
  indigoBar: "#2B3F7A",
  bone: "#F4EFE6",
  paper: "#FFFFFF",
  sand: "#E9E4DA",
  sandBar: "#ECE4D2",
  ink: "#17140F",
  muted: "#5F5648",
  placeholder: "#8A8070",
  red: "#D2432C",
  redHover: "#8F2B22",
  raffia: "#E3C26E",
  raffiaDark: "#7A6A3A",
} as const;

export const FONT = {
  ui: "Archivo",
  num: "Anton",
  mono: "JetBrains Mono",
} as const;

export const RADIUS = { box: 2, pill: 9999 } as const;
export const BORDER = 1.5;

/** Zigzag as one SVG path (for Satori, which has no CSS background-repeat of data-URI SVGs). 16px tile: up 8, down 8. */
export function zigzagPath(width: number, y = 12, amp = 8): string {
  let d = `M0 ${y}`;
  for (let x = 0; x < width; x += 16) d += ` L${x + 8} ${y - amp} L${x + 16} ${y}`;
  return d;
}
