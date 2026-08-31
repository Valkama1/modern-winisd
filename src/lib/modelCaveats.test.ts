import { describe, it, expect } from "vitest";
import { caveatsFor, modelCaveats, worstTier } from "./modelCaveats";
import { makeProject } from "../test/fixtures";
import { DEFAULT_DRIVER } from "../types";

/** bc21 is complete, so it is the "nothing to say" baseline. */
const complete = () => makeProject();
const ids = (cs: { id: string }[]) => cs.map((c) => c.id).sort();
/**
 * Every driver has a ka limit, so `modelCaveats` always emits `radiation-model` and
 * `caveatsFor` decides whether the plotted band actually reaches it. These assertions
 * are about the parameter-driven caveats, so they set it aside.
 */
const otherIds = (cs: { id: string }[]) =>
  ids(cs.filter((c) => c.id !== "radiation-model"));

describe("modelCaveats", () => {
  it("has nothing to say about a complete driver but the radiation limit", () => {
    // The property the whole feature rests on: a driver with every parameter present
    // contributes nothing of its own. Whether the radiation note is shown at all is
    // decided by caveatsFor against the frequency span.
    expect(otherIds(modelCaveats(complete(), 9999))).toEqual([]);
  });

  it("warns when Le is missing, because the substitute changes the top end", () => {
    const p = makeProject({ driver: { ...DEFAULT_DRIVER, le: 0 } });
    const cs = modelCaveats(p, 9999);
    expect(otherIds(cs)).toEqual(["le-assumed"]);
    const le = cs.find((c) => c.id === "le-assumed")!;
    expect(le.tier).toBe("warning");
    expect(le.detail).toContain("0.54 mH");
  });

  it("warns when Re is missing", () => {
    const p = makeProject({ driver: { ...DEFAULT_DRIVER, re: 0 } });
    expect(otherIds(modelCaveats(p, 9999))).toContain("re-assumed");
  });

  it("warns when Qms is missing, since the solver divides by it", () => {
    const p = makeProject({ driver: { ...DEFAULT_DRIVER, qms: 0 } });
    const c = modelCaveats(p, 9999).find((x) => x.id === "qms-missing");
    expect(c?.tier).toBe("warning");
  });

  it("calls a derivable Mms derived, not assumed", () => {
    // Mms from Fs, Sd and Vas is an identity, not a guess — the curve is exact.
    // Flagging it as a warning would train people to ignore the glyph.
    const p = makeProject({ driver: { ...DEFAULT_DRIVER, mms: 0 } });
    const c = modelCaveats(p, 9999).find((x) => x.id === "mms-derived");
    expect(c?.tier).toBe("derived");
    expect(otherIds(modelCaveats(p, 9999))).not.toContain("mms-placeholder");
  });

  it("warns when Mms cannot be derived either", () => {
    const p = makeProject({ driver: { ...DEFAULT_DRIVER, mms: 0, vas: 0 } });
    const c = modelCaveats(p, 9999).find((x) => x.id === "mms-placeholder");
    expect(c?.tier).toBe("warning");
    expect(c?.detail).toContain("100 g");
  });

  it("calls a derivable Bl derived, and an underivable one a placeholder", () => {
    const derivable = makeProject({ driver: { ...DEFAULT_DRIVER, bl: 0 } });
    expect(modelCaveats(derivable, 9999).find((c) => c.id === "bl-derived")?.tier)
      .toBe("derived");

    const not = makeProject({ driver: { ...DEFAULT_DRIVER, bl: 0, qes: 0 } });
    expect(modelCaveats(not, 9999).find((c) => c.id === "bl-placeholder")?.tier)
      .toBe("warning");
  });

  it("notes when the stored Vas is not the one being simulated", () => {
    // Only past 10%. Both real drivers in the Rust fixture set disagree with their
    // own derived Vas by 1-2% simply because Vas and Mms are separate measurements,
    // and a note on every honest datasheet is a note nobody reads.
    expect(otherIds(modelCaveats(complete(), 9999))).not.toContain("vas-not-used");

    const p = makeProject({ driver: { ...DEFAULT_DRIVER, vas: 999 } });
    expect(modelCaveats(p, 9999).find((c) => c.id === "vas-not-used")?.tier)
      .toBe("derived");
  });

  it("reports the radiation limit with the frequency it starts at", () => {
    const c = modelCaveats(complete(), 380).find((x) => x.id === "radiation-model");
    expect(c?.tier).toBe("warning");
    expect(c?.aboveHz).toBe(380);
    expect(c?.detail).toContain("380");
  });

  it("only mentions the passive radiator when there is one", () => {
    const sealed = makeProject({ enclosureType: "sealed", prMms: 0 });
    expect(otherIds(modelCaveats(sealed, 9999))).not.toContain("pr-mms-assumed");

    const pr = makeProject({ enclosureType: "passive_radiator", prMms: 0, prQms: 0 });
    expect(otherIds(modelCaveats(pr, 9999))).toEqual(["pr-mms-assumed", "pr-qms-assumed"]);
  });

  it("does not call Bl derived when the mass it derives from was itself assumed", () => {
    // Bl comes out of Qes, Re and Mms — so a Bl computed from a 100 g stand-in
    // inherits that guess, and saying "the curve is unaffected" about it would be
    // false. This is the exact miscalibration the two tiers exist to prevent.
    const p = makeProject({ driver: { ...DEFAULT_DRIVER, bl: 0, mms: 0, vas: 0 } });
    const cs = modelCaveats(p, 9999);
    expect(cs.find((c) => c.id === "bl-derived")).toBeUndefined();
    expect(cs.find((c) => c.id === "bl-from-assumed-mms")?.tier).toBe("warning");
  });

  it("quotes the Re the solver actually used, not the missing one", () => {
    // With Re absent too, the solver substitutes 4 Ohm before taking Re x 0.15 mH,
    // so the honest figure is 0.60 mH — not the 0.00 mH a raw read would print.
    const p = makeProject({ driver: { ...DEFAULT_DRIVER, le: 0, re: 0 } });
    const le = modelCaveats(p, 9999).find((c) => c.id === "le-assumed")!;
    expect(le.detail).toContain("0.60 mH");
    expect(le.detail).not.toContain("0.00 mH");
  });
});

describe("caveatsFor", () => {
  const radiation = modelCaveats(complete(), 380);

  it("keeps the radiation limit off curves that never used it", () => {
    // Excursion, port velocity and impedance are electro-mechanical; the transfer
    // function divides the radiation model out on both sides.
    for (const mode of ["excursion", "velocity", "impedance", "transfer_function"] as const) {
      expect(ids(caveatsFor(radiation, mode, 2000))).toEqual([]);
    }
  });

  it("keeps it on the curves that do", () => {
    expect(ids(caveatsFor(radiation, "spl", 2000))).toEqual(["radiation-model"]);
  });

  it("drops it when the plotted band stops below the limit", () => {
    // Nothing to warn about if the untrustworthy region is off screen.
    expect(ids(caveatsFor(radiation, "spl", 200))).toEqual([]);
  });

  it("keeps a caveat with no curve list on every curve", () => {
    const all = modelCaveats(makeProject({ driver: { ...DEFAULT_DRIVER, le: 0 } }), 9999);
    for (const mode of ["spl", "impedance", "excursion"] as const) {
      expect(ids(caveatsFor(all, mode, 2000))).toEqual(["le-assumed"]);
    }
  });
});

describe("worstTier", () => {
  it("is null for nothing, derived for derived only, warning if any warns", () => {
    expect(worstTier([])).toBeNull();
    expect(worstTier([{ id: "a", tier: "derived", title: "", detail: "" }])).toBe("derived");
    expect(
      worstTier([
        { id: "a", tier: "derived", title: "", detail: "" },
        { id: "b", tier: "warning", title: "", detail: "" },
      ]),
    ).toBe("warning");
  });
});
