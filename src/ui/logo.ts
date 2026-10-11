import { COLOR as C } from "./tokens";

/**
 * The one definition of the logo mark path data (DESIGN.md §5, 64x84 viewBox). fill = body colour,
 * cut = ground colour (crown chevron + eyes + diamond mouth are cut-outs). Pass `standalone` when the
 * SVG is used as an image (data URI) rather than inline HTML, so it carries the xmlns.
 */
export const logoMarkSvg = (fill: string = C.indigo, cut: string = C.bone, width = 18, standalone = false): string =>
  `<svg ${standalone ? 'xmlns="http://www.w3.org/2000/svg" ' : ""}width="${width}" height="${Math.round((width * 84) / 64)}" viewBox="0 0 64 84"${standalone ? "" : ' aria-hidden="true"'}><path d="M32 2C14 2 6 16 6 38c0 24 10 44 26 44s26-20 26-44C58 16 50 2 32 2Z" fill="${fill}"/><path d="M12 24L32 12L52 24" fill="none" stroke="${cut}" stroke-width="5"/><path d="M13 40L28 36L22 48Z" fill="${cut}"/><path d="M51 40L36 36L42 48Z" fill="${cut}"/><path d="M32 54L38 64L32 76L26 64Z" fill="${cut}"/></svg>`;
