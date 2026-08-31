import { describe, it, expect } from "vitest";
import { CURVE_TYPES, CurveType } from "../types";
import { CURVE_LABELS, SELECTABLE_CURVES, selectableCurvesFor } from "./curveCatalogue";

describe("curve catalogue", () => {
  it("names every curve the dashboard knows about", () => {
    // Two hand-maintained copies of this list had already drifted: the Toolbar offered
    // nine curves and the Settings picker seven, so Max SPL and Transfer Function could
    // be displayed but never have their axes configured.
    for (const curve of CURVE_TYPES) {
      expect(CURVE_LABELS[curve], curve).toBeTruthy();
    }
    expect(Object.keys(CURVE_LABELS).sort()).toEqual([...CURVE_TYPES].sort());
  });

  it("offers everything except the one curve that is not chosen on its own", () => {
    // pr_excursion is drawn onto the excursion graph when the enclosure has a radiator.
    expect(SELECTABLE_CURVES).not.toContain("pr_excursion" as CurveType);
    expect(SELECTABLE_CURVES.length).toBe(CURVE_TYPES.length - 1);
  });

  it("hides port velocity for an enclosure with no port", () => {
    expect(selectableCurvesFor("sealed")).not.toContain("velocity" as CurveType);
    expect(selectableCurvesFor("ported")).toContain("velocity" as CurveType);
    expect(selectableCurvesFor("bandpass4")).toContain("velocity" as CurveType);
  });

  it("gives distinct labels, so a picker cannot show the same name twice", () => {
    const labels = Object.values(CURVE_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
