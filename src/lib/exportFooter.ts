import { Caveat } from "./modelCaveats";

/** One project's caveats, for grouping the footer when more than one is on the graph. */
export type CaveatFooterGroup = {
  project: string;
  caveats: Caveat[];
};

/**
 * A caveat's title, with the frequency it starts at when it has one.
 *
 * Someone reading an exported PNG has no hover — the title alone tells them the model
 * gave out, but not where, and that's the one number they'd actually need.
 */
function formatCaveatTitle(c: Caveat): string {
  if (c.aboveHz === undefined) return c.title;
  const freq =
    c.aboveHz > 1000 ? `${(c.aboveHz / 1000).toFixed(1)} kHz` : `${Math.round(c.aboveHz)} Hz`;
  return `${c.title} (above ${freq})`;
}

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
 *
 * Grouped by project because comparison overlay — more than one project visible at
 * once — is this app's primary use, and a caveat like `radiation-model` fires for
 * every project on the graph. A flat join of titles reads as the same warning
 * repeated; naming which project it belongs to is the only way to tell them apart.
 */
export function caveatFooterLine(groups: CaveatFooterGroup[]): string {
  const segments = groups
    .map((g) => {
      const seen = new Set<string>();
      const titles = g.caveats
        .filter((c) => c.tier === "warning")
        .filter((c) => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        })
        .map(formatCaveatTitle);
      return { project: g.project, titles };
    })
    .filter((g) => g.titles.length > 0);

  if (segments.length === 0) return "";

  const multi = segments.length > 1;
  const line = segments
    .map((g) => (multi ? `${g.project}: ${g.titles.join(" · ")}` : g.titles.join(" · ")))
    .join(" · ");
  return `⚠ ${line}`;
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
