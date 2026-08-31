import { RHO_AIR, SPEED_OF_SOUND, vasLitresFromCmsSd } from "./calculations";

/**
 * Cross-checks on a set of Thiele/Small parameters.
 *
 * These verify that the numbers agree with each other. That is worth doing — a
 * transposed digit shows up immediately — but it is not the same as verifying the
 * driver: if Mms and BL were produced by Auto-Estimate from Fs, Vas, Sd and Qes, then
 * checking them against those same values agrees by construction. The report says so.
 */
export type DriverCheckInput = {
  fs: number;
  qes: number;
  qms: number;
  qts: number;
  vas: number;
  sd: number;
  re: number;
  mms: number;
  bl: number;
  le: number;
  xmax: number;
  pe: number;
  sens: number;
};

export type DriverCheckResult = {
  /** One entry per parameter that disagrees with the others. */
  anomalies: string[];
  /** Parameters present but not corroborated by anything else here. */
  unverifiable: string[];
};

export function checkDriverParameters(p: DriverCheckInput): DriverCheckResult {
  const { fs, qes, qms, vas, sd, re } = p;
  const rho = RHO_AIR;
  const c_air = SPEED_OF_SOUND;
  const sdM2 = sd * 1e-4;
  const vasM3 = vas * 1e-3;
  const cms = vasM3 / (rho * c_air * c_air * sdM2 * sdM2);
  const ws = 2.0 * Math.PI * fs;
  const derivedMmsKg = 1.0 / (ws * ws * cms);
  const derivedMmsG = derivedMmsKg * 1000.0;
  const derivedBl = Math.sqrt((ws * derivedMmsKg * re) / qes);

  const enteredMms = p.mms;
  const enteredBl = p.bl;
  const newSens = String(p.sens);
  const newLe = String(p.le);
  const newRe = String(p.re);
  const newXmax = String(p.xmax);
  const newPe = String(p.pe);
  const newQts = String(p.qts);

  const anomalies: string[] = [];

  if (enteredMms > 0) {
    const cmsFromMms = 1.0 / (ws * ws * (enteredMms / 1000.0));
    const derivedVasL = vasLitresFromCmsSd(cmsFromMms, sd);
    const vasDiscrepancy = Math.abs(derivedVasL - vas) / vas;
    if (vasDiscrepancy > 0.15) {
      anomalies.push(
        `• Vas Discrepancy: Entered Vas is ${vas} L, but based on your entered Sd (${sd.toFixed(1)} cm²) and moving mass, it should mathematically be ${derivedVasL.toFixed(1)} L. This is a ${Math.round(vasDiscrepancy * 100)}% discrepancy. Please check if your Sd or Vas has a manufacturer copy-paste error.`
      );
    }

    const mmsDiscrepancy = Math.abs(enteredMms - derivedMmsG) / derivedMmsG;
    if (mmsDiscrepancy > 0.15) {
      anomalies.push(
        `• Mms Discrepancy: Entered Mms is ${enteredMms} g, but calculated moving mass from your Vas/Sd is ${derivedMmsG.toFixed(1)} g. (Difference: ${Math.round(mmsDiscrepancy * 100)}%).`
      );
    }
  }

  if (enteredBl > 0) {
    const blDiscrepancy = Math.abs(enteredBl - derivedBl) / derivedBl;
    if (blDiscrepancy > 0.15) {
      anomalies.push(
        `• BL Motor Strength Discrepancy: Entered BL is ${enteredBl} T·m, but calculated BL from Qes and moving mass is ${derivedBl.toFixed(2)} T·m. (Difference: ${Math.round(blDiscrepancy * 100)}%).`
      );
    }
  }

  // Sensitivity has to agree with the efficiency the other parameters imply. This
  // catches a datasheet figure that is simply optimistic, which none of the checks
  // above can see because none of them involve it.
  const enteredSens = parseFloat(newSens);
  if (enteredSens > 0) {
    // eta0 = (4*pi^2 / c^3) * Fs^3 * Vas / Qes, then 112.2 dB at 100% into half space.
    const eta0 = ((4 * Math.PI ** 2) / c_air ** 3) * fs ** 3 * (vasM3 / qes);
    const impliedSens = 112.2 + 10 * Math.log10(eta0);
    if (Math.abs(enteredSens - impliedSens) > 1.5) {
      anomalies.push(
        `• Sensitivity Discrepancy: Entered sensitivity is ${enteredSens} dB, but Fs, Vas and Qes imply ${impliedSens.toFixed(1)} dB at 1 W / 1 m. ` +
        `(Difference: ${(enteredSens - impliedSens).toFixed(1)} dB.) Absolute SPL graphs follow the derived figure, not the entered one.`
      );
    }
  }

  // Le is not on many datasheets, and it alone sets where the response starts
  // falling. Without it the solver substitutes Re x 0.15 mH, which puts the corner
  // around 1 kHz and leaves the response looking flat far higher than it should.
  const enteredLe = parseFloat(newLe);
  if (!(enteredLe > 0)) {
    anomalies.push(
      "• Voice Coil Inductance (Le) is missing. It governs how quickly output falls above the passband, " +
      "so without it the simulation stays flat much higher than a real driver does. The solver will assume " +
      `${(re * 0.15).toFixed(2)} mH. If your datasheet omits Le, 1–3 mH is typical for a subwoofer.`
    );
  }

  // Qts follows from Qes and Qms. The form derives it, but a driver imported from a
  // file or the database can carry a value that disagrees.
  const enteredQts = parseFloat(newQts);
  const derivedQts = (qes * qms) / (qes + qms);
  if (enteredQts > 0 && Math.abs(enteredQts - derivedQts) / derivedQts > 0.02) {
    anomalies.push(
      `• Qts Discrepancy: Stored Qts is ${enteredQts}, but Qes and Qms give ${derivedQts.toFixed(4)}. ` +
      "Qts is defined as Qes·Qms/(Qes+Qms), so one of the three is wrong."
    );
  }

  // Values nothing else here can corroborate, so the report should not imply they
  // were checked.
  const unverifiable = ([
    ["Le", enteredLe],
    ["Re", parseFloat(newRe)],
    ["Xmax", parseFloat(newXmax)],
    ["Pe", parseFloat(newPe)],
  ] as const)
    .filter(([, value]) => value > 0)
    .map(([name]) => name);

  return { anomalies, unverifiable };
}
