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
    expect(
      caveatFooterLine([
        { project: "x", caveats: [{ id: "mms-derived", tier: "derived", title: "x", detail: "" }] },
      ]),
    ).toBe("");
  });

  it("names the warnings for a single project, unprefixed", () => {
    const line = caveatFooterLine([
      {
        project: "Ported build",
        caveats: [
          warn("le-assumed", "Voice coil inductance assumed"),
          warn("radiation-model", "Radiation model beyond its range", 1400),
        ],
      },
    ]);
    expect(line).toContain("Voice coil inductance assumed");
    expect(line).toContain("Radiation model beyond its range (above 1.4 kHz)");
    expect(line).not.toContain("Ported build");
    expect(line).toContain("·");
  });

  it("dedupes repeated ids within one project's caveats", () => {
    const line = caveatFooterLine([
      {
        project: "x",
        caveats: [
          warn("radiation-model", "Radiation model beyond its range", 1400),
          warn("radiation-model", "Radiation model beyond its range", 1400),
        ],
      },
    ]);
    // One title, not two joined by " · ".
    expect(line).toBe("⚠ Radiation model beyond its range (above 1.4 kHz)");
  });

  it("prefixes each project's caveats with its name once there is more than one project", () => {
    const line = caveatFooterLine([
      { project: "Ported build", caveats: [warn("le-assumed", "Voice coil inductance assumed")] },
      {
        project: "Sealed build",
        caveats: [warn("radiation-model", "Radiation model beyond its range", 1400)],
      },
    ]);
    expect(line).toBe(
      "⚠ Ported build: Voice coil inductance assumed · " +
        "Sealed build: Radiation model beyond its range (above 1.4 kHz)",
    );
  });

  it("names both projects instead of repeating the same title, for a caveat every project shares", () => {
    // radiation-model fires for every project, and comparison overlay — more than one
    // project on the graph — is this app's primary use, so this is the common case,
    // not an edge case. The old flat join printed the title twice with nothing
    // telling them apart.
    const line = caveatFooterLine([
      { project: "Ported build", caveats: [warn("radiation-model", "Radiation model beyond its range", 1400)] },
      { project: "Sealed build", caveats: [warn("radiation-model", "Radiation model beyond its range", 380)] },
    ]);
    expect(line).toContain("Ported build");
    expect(line).toContain("Sealed build");
    expect(line).toBe(
      "⚠ Ported build: Radiation model beyond its range (above 1.4 kHz) · " +
        "Sealed build: Radiation model beyond its range (above 380 Hz)",
    );
  });

  it("drops a project entirely once it has no warnings left", () => {
    const line = caveatFooterLine([
      { project: "Complete build", caveats: [] },
      { project: "Sealed build", caveats: [warn("re-assumed", "Voice coil resistance assumed")] },
    ]);
    expect(line).not.toContain("Complete build");
    expect(line).toBe("⚠ Voice coil resistance assumed");
  });

  it("formats the frequency in kHz above 1000 Hz and in whole Hz at or below it", () => {
    const above = caveatFooterLine([
      { project: "x", caveats: [warn("radiation-model", "Radiation model beyond its range", 1400)] },
    ]);
    expect(above).toContain("1.4 kHz");

    const below = caveatFooterLine([
      { project: "x", caveats: [warn("radiation-model", "Radiation model beyond its range", 380)] },
    ]);
    expect(below).toContain("380 Hz");
    expect(below).not.toContain("kHz");
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
