import { Caveat } from "./modelCaveats";

/**
 * The line stamped along the bottom of an exported graph.
 *
 * Exporting is the moment a curve leaves the app and becomes a claim somebody else
 * reads, with none of the hover affordances that explain it — so the warnings have to
 * travel with the image or they are silently dropped at exactly the point they matter
 * most.
 *
 * Warning tier only. A derived value does not affect the curve, and an export footer
 * is the wrong place for detail nobody can hover.
 */
export function caveatFooterLine(caveats: Caveat[]): string {
  const titles = caveats.filter((c) => c.tier === "warning").map((c) => c.title);
  return titles.length === 0 ? "" : `⚠ ${titles.join(" · ")}`;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Append the footer to already-resolved SVG text.
 *
 * Done on the text rather than by rendering a hidden element, so the on-screen graph is
 * untouched and both export paths get it — the PNG rasterises this same string.
 */
export function withCaveatFooter(svgText: string, line: string): string {
  if (!line) return svgText;

  const viewBox = /viewBox="([\d.\s-]+)"/.exec(svgText);
  if (!viewBox) return svgText;
  const [, , , heightStr] = viewBox[1].trim().split(/\s+/);
  const height = Number(heightStr);
  if (!Number.isFinite(height)) return svgText;

  const text =
    `<text x="8" y="${height - 6}" font-size="9" fill="#94a3b8" ` +
    `font-family="system-ui, sans-serif">${escapeXml(line)}</text>`;
  return svgText.replace(/<\/svg>\s*$/, `${text}</svg>`);
}
