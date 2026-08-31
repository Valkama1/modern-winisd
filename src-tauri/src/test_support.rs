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
