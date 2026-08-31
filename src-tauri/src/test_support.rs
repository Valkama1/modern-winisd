//! Fixtures shared between the modules' own test suites.

use crate::model::Driver;

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
