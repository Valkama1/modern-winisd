//! Fixtures shared between the modules' own test suites.

use crate::circuit::{self, DriverParams};
use crate::model::{Driver, driver_to_params};

/// B&C 21SW152, used as the reference driver throughout. Its published parameters are
/// self-consistent, so a discrepancy in a test is the code's, not the fixture's.
pub fn bc21() -> Driver {
    Driver {
        id: "bc-21sw152-4".to_string(),
        manufacturer: "B&C Speakers".to_string(),
        model: "21".to_string(),
        fs: 33.0,
        qts: 0.36,
        qes: 0.37,
        qms: 7.7,
        vas: 278.0,
        re: 3.6,
        sd: 1680.0,
        xmax: 14.0,
        mms: 335.0,
        le: 1.7,
        bl: 24.8,
        pe: 1700.0,
        sens: 97.0,
    }
}

/// Sundown Audio SS12-22, a 12" dual 2 Ω subwoofer, from its published sheet with the
/// voice coils in series — the configuration every figure on that sheet is measured in.
///
/// Kept as a fixture because its sheet is unusually complete: Re, Le, Fs, Qms, Qes,
/// Qts, Mms, Cms, Sd, Vd, Bl, Vas, Xmax and sensitivity are all quoted. That makes the
/// parameter set *over-determined* — the Thiele/Small identities relate them, so the
/// sheet can be checked against itself and our derivations checked against the sheet.
/// `the_published_spec_sheet_agrees_with_our_derivations` does exactly that.
///
/// Note `sens`: the sheet quotes 88.1 dB at 2.83 V / 1 m, the car-audio convention,
/// while this field is a 1 W / 1 m figure. Into the series Re of 4.9 Ω, 2.83 V is
/// 1.634 W, so the sheet's number is 2.13 dB hot for our purposes. Entering 88.1 here
/// would overstate the driver by that much everywhere sensitivity is used.
pub fn ss12_22() -> Driver {
    Driver {
        id: "sundown-ss12-22".to_string(),
        manufacturer: "Sundown Audio".to_string(),
        model: "SS12-22 (2Ω+2Ω, series)".to_string(),
        fs: 27.0,
        qts: 0.35,
        qes: 0.39,
        qms: 3.47,
        vas: 49.4,
        re: 4.9,
        sd: 528.0,
        // 23 mm at 70% Bl, Klippel verified.
        xmax: 23.0,
        mms: 275.0,
        le: 1.8,
        bl: 24.3,
        pe: 900.0,
        // 88.1 dB @ 2.83 V / 1 m, converted to 1 W / 1 m — see above.
        sens: 85.97,
    }
}

/// One driver in the reference set, by name rather than by position.
///
/// This was an eight-field tuple destructured at ten call sites — the same shape the
/// commands were fixed out of, and for the same reason: transpose `vas` and `sd` in a
/// row and it still compiles, still runs, and quietly tests a different loudspeaker.
pub struct RefDriver {
    pub name: &'static str,
    /// Free-air resonance, Hz.
    pub fs: f64,
    pub qts: f64,
    /// Equivalent compliance volume, litres.
    pub vas: f64,
    /// Cone area, cm².
    pub sd: f64,
    pub re: f64,
    /// One-way linear travel, mm.
    pub xmax: f64,
    /// Thermal rating, W.
    pub pe: f64,
}

impl RefDriver {
    /// A `Driver` whose Mms and Bl actually reproduce the quoted Fs, Qts and Vas under
    /// the circuit model.
    ///
    /// `solve_circuit` derives compliance from Fs and Mms and ignores the nameplate
    /// Vas, so a fixture carrying an arbitrary Mms would silently be testing a
    /// different loudspeaker from the one its own labels name.
    pub fn driver(&self) -> Driver {
        let qms = 6.0;
        let qes = self.qts * qms / (qms - self.qts);
        let sd_m2 = self.sd * 1e-4;
        let w_s = 2.0 * std::f64::consts::PI * self.fs;
        let mms_kg = (circuit::RHO0 * circuit::C_AIR * circuit::C_AIR * sd_m2 * sd_m2)
            / (w_s * w_s * self.vas * 1e-3);
        let bl = (w_s * mms_kg * self.re / qes).sqrt();
        Driver {
            id: self.name.to_string(),
            manufacturer: String::new(),
            model: self.name.to_string(),
            fs: self.fs,
            qts: self.qts,
            qes,
            qms,
            vas: self.vas,
            re: self.re,
            sd: self.sd,
            xmax: self.xmax,
            mms: mms_kg * 1000.0,
            le: 1.5,
            bl,
            pe: self.pe,
            sens: 88.0,
        }
    }

    /// The same driver as the solver's own parameter struct.
    pub fn params(&self) -> DriverParams {
        driver_to_params(&self.driver())
    }
}

/// Drivers spanning the range the solver has to cope with: Qts from 0.28 to 0.66, Fs
/// from 17.7 to 33 Hz, and — the axis that matters most for the radiation model — cone
/// areas from 330 cm² to 1210 cm², a factor of nearly four in ka at any frequency.
///
/// Originally the set that broke the old curve-fit alignment formulas. It is shared
/// rather than alignment-local because a suite that exercises every code path against
/// one loudspeaker is broad in paths and narrow in inputs, and this codebase has been
/// bitten by that three times: a nameplate-versus-derived Vas gap of 2.1% on the
/// reference driver hid a bug that a mismatched driver made obvious; a radiation model
/// 35× out at 2 kHz only surfaced because that driver happens to be large; and a gain
/// curve that slid with listening distance went unnoticed because the one test that
/// touched that arm passed a distance of exactly 1 m.
pub const REFERENCE_DRIVERS: [RefDriver; 5] = [
    RefDriver { name: "Peerless XLS-10",    fs: 19.5, qts: 0.66, vas:  40.0, sd:  330.0, re: 3.6, xmax: 12.5, pe:  200.0 },
    RefDriver { name: "Dayton UM18-22",     fs: 17.7, qts: 0.51, vas: 453.0, sd: 1210.0, re: 3.4, xmax: 19.0, pe:  800.0 },
    RefDriver { name: "JL 12W7",            fs: 26.4, qts: 0.52, vas:  53.0, sd:  500.0, re: 2.4, xmax: 25.0, pe:  750.0 },
    RefDriver { name: "B&C 18SW115",        fs: 32.0, qts: 0.30, vas: 130.0, sd: 1210.0, re: 5.3, xmax:  9.0, pe: 1000.0 },
    RefDriver { name: "18Sound 18NLW9601",  fs: 33.0, qts: 0.28, vas: 145.0, sd: 1190.0, re: 5.2, xmax: 10.0, pe: 1200.0 },
];

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;

    /// The SS12-22 sheet quotes more than the Thiele/Small identities need, so the
    /// parameters constrain each other. That makes it the one fixture here that can
    /// check *our* arithmetic against an outside source rather than against itself:
    /// every figure below is derived from other published figures and compared to the
    /// one the manufacturer printed.
    ///
    /// Residuals are real measurement and rounding, not slack — they run 0.2% to 2.1%,
    /// and the bounds are set just above what was measured rather than at a comfortable
    /// round number, so a drift in our constants would show up here.
    #[test]
    fn the_published_spec_sheet_agrees_with_our_derivations() {
        let d = ss12_22();
        let mms_kg = d.mms / 1000.0;
        let sd_m2 = d.sd * 1e-4;
        let w_s = 2.0 * PI * d.fs;
        // Published Cms, 0.125 mm/N, in SI.
        let cms = 0.125e-3;

        let within = |name: &str, derived: f64, published: f64, tol_pct: f64| {
            let err = (derived - published).abs() / published * 100.0;
            assert!(
                err < tol_pct,
                "{name}: derived {derived:.4}, sheet says {published:.4} — {err:.2}% out (bound {tol_pct}%)"
            );
        };

        // Qts is the parallel combination of the two Q factors, by definition.
        within("Qts from Qes and Qms", d.qes * d.qms / (d.qes + d.qms), d.qts, 0.5);

        // Resonance follows from the mass and the compliance holding it.
        within("Fs from Mms and Cms", 1.0 / (2.0 * PI * (mms_kg * cms).sqrt()), d.fs, 1.0);

        // Vas is that compliance expressed as a volume of air.
        within(
            "Vas from Cms and Sd",
            circuit::RHO0 * circuit::C_AIR * circuit::C_AIR * sd_m2 * sd_m2 * cms * 1000.0,
            d.vas,
            2.5,
        );

        // The electrical Q, from the motor working against the moving mass.
        within("Qes from Bl, Mms and Re", w_s * mms_kg * d.re / (d.bl * d.bl), d.qes, 1.0);
        within("Bl from Qes, Mms and Re", (w_s * mms_kg * d.re / d.qes).sqrt(), d.bl, 1.0);

        // Displacement volume: cone area swept over the linear travel. The sheet's
        // 1194 cm³ implies 22.6 mm rather than the quoted 23, which is the largest
        // internal disagreement on the sheet.
        within("Vd from Sd and Xmax", d.sd * (d.xmax / 10.0), 1194.0, 2.0);

        // And what the solver itself will use: compliance from Fs and Mms, never the
        // printed Vas. A real driver's two figures differ; this one by 1%.
        within(
            "Vas as the solver derives it",
            (circuit::RHO0 * circuit::C_AIR * circuit::C_AIR * sd_m2 * sd_m2) / (w_s * w_s * mms_kg)
                * 1000.0,
            d.vas,
            1.5,
        );
    }

    /// Reference efficiency ties Fs, Vas and Qes to an absolute sound pressure, and the
    /// SS12-22 sheet prints that pressure — so this checks the whole chain against a
    /// figure nobody in this repo chose.
    ///
    /// The sheet quotes 2.83 V rather than 1 W, which for a 4.9 Ω series load is
    /// 1.634 W. Reversing that conversion lands within 0.02 dB of the printed 88.1.
    #[test]
    fn reference_efficiency_reproduces_the_published_sensitivity() {
        let d = ss12_22();
        let eta0 = (4.0 * PI * PI / circuit::C_AIR.powi(3)) * (d.fs.powi(3) * d.vas * 1e-3) / d.qes;

        // 10·log₁₀(1 / (2π · 10⁻¹²)) — one acoustic watt spread over a hemisphere at
        // 1 m, against the 10⁻¹² W/m² reference intensity.
        const HALF_SPACE_REF_DB: f64 = 112.02;
        let spl_1w = HALF_SPACE_REF_DB + 10.0 * eta0.log10();

        // The fixture stores the 1 W / 1 m figure; the sheet prints the 2.83 V one.
        let watts_at_2v83 = 2.83_f64.powi(2) / d.re;
        let spl_2v83 = spl_1w + 10.0 * watts_at_2v83.log10();

        assert!(
            (spl_2v83 - 88.1).abs() < 0.15,
            "efficiency implies {spl_2v83:.2} dB at 2.83 V / 1 m, the sheet prints 88.1"
        );
        assert!(
            (spl_1w - d.sens).abs() < 0.15,
            "the fixture stores {:.2} dB at 1 W / 1 m, efficiency implies {spl_1w:.2}",
            d.sens
        );
    }
}
