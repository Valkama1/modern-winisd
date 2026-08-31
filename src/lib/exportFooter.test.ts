import { describe, it, expect } from "vitest";
import { caveatFooterLine, withCaveatFooter } from "./exportFooter";
import { Caveat } from "./modelCaveats";

const warn = (id: string, title: string, aboveHz?: number): Caveat => ({
  id, tier: "warning", title, detail: "", aboveHz,
});

describe("caveatFooterLine", () => {
  it("is empty when nothing was assumed", () => {
    expect(caveatFooterLine([])).toBe("");
  });

  it("ignores derived entries, which do not affect the curve", () => {
    expect(caveatFooterLine([{ id: "mms-derived", tier: "derived", title: "x", detail: "" }]))
      .toBe("");
  });

  it("names the warnings", () => {
    const line = caveatFooterLine([
      warn("le-assumed", "Voice coil inductance assumed"),
      warn("radiation-model", "Radiation model beyond its range", 1400),
    ]);
    expect(line).toContain("Voice coil inductance assumed");
    expect(line).toContain("Radiation model beyond its range");
    expect(line).toContain("·");
  });
});

describe("withCaveatFooter", () => {
  const svg = '<svg viewBox="0 0 800 400"><rect/></svg>';

  it("leaves the image byte-for-byte alone when there is nothing to say", () => {
    expect(withCaveatFooter(svg, "")).toBe(svg);
  });

  it("adds one text line inside the viewBox, before the closing tag", () => {
    const out = withCaveatFooter(svg, "Assumed: Le");
    expect(out.endsWith("</svg>")).toBe(true);
    expect(out).toContain("Assumed: Le");
    expect(out).toContain("<text");
    // Inside the viewBox, or the rasteriser crops it away.
    const y = Number(/y="([\d.]+)"/.exec(out)![1]);
    expect(y).toBeLessThan(400);
    expect(y).toBeGreaterThan(380);
  });

  it("escapes markup so a driver name cannot break the document", () => {
    expect(withCaveatFooter(svg, 'Assumed: <Le> & "Re"')).toContain("&lt;Le&gt; &amp;");
  });
});
