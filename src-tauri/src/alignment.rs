//! Numerical enclosure alignment solver.
//!
//! Instead of extrapolating closed-form Thiele/Small curve fits (which are only valid
//! for a narrow Qts window and diverge badly outside it), this module searches the
//! enclosure parameter space directly against the same lumped-element circuit model
//! that draws the app's graphs. A recommendation is therefore always self-consistent
//! with the curve the user sees, for any Qts, any enclosure type, and any driver count.
//!
//! Search is coarse-to-fine: a log/linear grid over the free parameters, then two
//! refinement passes that shrink the window around the running best.

use crate::circuit::{
    self, AcousticCircuit, DriverParams, PassiveCrossoverSpec, compute_spl, solve_circuit,
};
use crate::topologies::*;
use rayon::prelude::*;

/// Port air velocity above which a vent audibly chuffs (m/s, RMS).
const MAX_PORT_VELOCITY: f64 = 17.0;

/// Number of log-spaced frequency points used to score a candidate.
const N_POINTS: usize = 96;

/// Narrowest passband (upper corner / lower corner) accepted from a bandpass
/// alignment — roughly half an octave.
const MIN_BANDWIDTH_RATIO: f64 = 1.3;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum AlignTarget {
    /// Flattest achievable passband; lowest F3 among monotonic responses.
    /// Lands on QB3 / BB4 / SBB4 / C4 naturally depending on Qts.
    MaximallyFlat,
    /// Lowest F3 that still holds passband deviation within 1 dB (EBS-style).
    ExtendedBass,
    /// Deliberate ~3 dB hump near tuning, biased toward a smaller box.
    Boomy,
}

impl AlignTarget {
    pub fn from_str(s: &str) -> Self {
        match s {
            "extended_bass" => AlignTarget::ExtendedBass,
            "boomy" => AlignTarget::Boomy,
            _ => AlignTarget::MaximallyFlat,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlignConstraints {
    /// Reject alignments that exceed Xmax at rated power.
    pub respect_xmax: bool,
    /// Reject alignments whose port would chuff or not physically fit in the box.
    pub buildable_port: bool,
    /// Hard cap on total box volume, in liters.
    pub max_volume: Option<f64>,
    /// Reject alignments that cannot reach this F3, in Hz.
    pub target_f3: Option<f64>,
}

/// Desired −3 dB corners for a bandpass enclosure.
///
/// This is a target that shapes the cost function, not a constraint: exact corners are
/// rarely reachable, so a hard rejection would leave nothing to choose from.
#[derive(Clone, Copy, Debug, serde::Deserialize)]
pub struct PassbandTarget {
    pub low: f64,
    pub high: f64,
}

#[derive(Clone, Debug, Default, serde::Serialize)]
pub struct AlignmentRecommendation {
    pub v_box: f64,
    pub tuning_freq: f64,
    pub v_rear: f64,
    pub v_front: f64,
    pub rear_tuning_freq: f64,
    pub front_tuning_freq: f64,
    /// Achieved −3 dB point relative to the passband reference, in Hz.
    pub f3: f64,
    /// Achieved upper −3 dB corner, in Hz. Zero for high-pass enclosures.
    pub f_high: f64,
    /// Worst passband deviation in dB (overshoot or sag, whichever is larger).
    pub ripple_db: f64,
    /// Rolloff knee sharpness (f10/f3). 0.76 is a textbook 4th-order Butterworth;
    /// lower means a gentler, droopier rolloff.
    pub knee: f64,
    /// Peak cone excursion as a fraction of Xmax at rated power (1.0 = at the limit).
    pub excursion_ratio: f64,
    /// Air velocity through the port the alignment implies, in m/s.
    pub port_velocity: f64,
    /// Nearest classical alignment family, for display.
    pub alignment_name: String,
    /// Human-readable remarks — which constraints bound the result, what was relaxed.
    pub notes: Vec<String>,
}

/// Everything the solver needs that is not being searched over.
pub struct AlignRequest {
    pub driver: DriverParams,
    pub enclosure_type: String,
    pub num_drivers: f64,
    pub input_power: f64,
    pub q_port: f64,
    /// Enclosure loss Q, carried from the project so an alignment is solved against
    /// the same lossiness the graphs are drawn with.
    pub q_loss: f64,
    pub pr_mms: f64,
    pub pr_sd: f64,
    pub pr_qms: f64,
    /// Radiator travel limit in mm, or zero when it has none to respect.
    pub pr_xmax: f64,
    pub target: AlignTarget,
    pub constraints: AlignConstraints,
    /// Desired passband for a bandpass enclosure. Ignored for high-pass types.
    pub passband: Option<PassbandTarget>,
}

/// One rung of the relaxation ladder: what the note calls the constraint, and the
/// edit that drops it.
type Relaxation = (&'static str, fn(&mut AlignConstraints));

/// Solve for the best enclosure parameters. Never fails: if every candidate violates
/// the constraints, they are relaxed one at a time (least to most fundamental) and a
/// note records what had to give.
pub fn solve_alignment(req: &AlignRequest) -> AlignmentRecommendation {
    solve_with(req, true)
}

/// Memoised `evaluate` results, keyed by the raw bits of the decoded grid parameters.
///
/// The grid positions come from `Axis::at` applied to identical inputs, so a repeated
/// candidate is bit-identical rather than merely close, and hashing the bits is exact.
#[derive(Default)]
struct EvalCache {
    // A fixed-width key rather than a Vec: the search runs at most four dimensions
    // (6th-order bandpass), and this is looked up once per candidate — tens of
    // thousands of times per solve — so a heap allocation each time would cost more
    // than the lookups save on a search with nothing to reuse.
    hits: std::collections::HashMap<[u64; MAX_DIMS], Metrics>,
    /// Disabled by the test that proves the cache changes nothing.
    enabled: bool,
}

/// Widest search there is: vr, vf, fr, ff for a 6th-order bandpass.
const MAX_DIMS: usize = 4;

impl EvalCache {
    fn key(params: &[f64]) -> Option<[u64; MAX_DIMS]> {
        if params.len() > MAX_DIMS {
            return None;
        }
        let mut key = [0u64; MAX_DIMS];
        for (slot, p) in key.iter_mut().zip(params) {
            *slot = p.to_bits();
        }
        Some(key)
    }

    fn get(&self, params: &[f64]) -> Option<Metrics> {
        if !self.enabled {
            return None;
        }
        self.hits.get(&Self::key(params)?).copied()
    }

    fn insert(&mut self, params: &[f64], m: Metrics) {
        if !self.enabled {
            return;
        }
        if let Some(key) = Self::key(params) {
            self.hits.insert(key, m);
        }
    }
}

fn solve_with(req: &AlignRequest, cache_enabled: bool) -> AlignmentRecommendation {
    let mut notes: Vec<String> = Vec::new();

    // Relaxation ladder — drop the most negotiable constraint first.
    let mut c = req.constraints;
    let ladder: [Relaxation; 4] = [
        ("target F3", |c: &mut AlignConstraints| c.target_f3 = None),
        ("buildable port", |c: &mut AlignConstraints| {
            c.buildable_port = false
        }),
        ("Xmax limit", |c: &mut AlignConstraints| c.respect_xmax = false),
        ("box volume cap", |c: &mut AlignConstraints| c.max_volume = None),
    ];

    let reference = passband_reference(req);
    let mut cache = EvalCache { enabled: cache_enabled, ..Default::default() };
    let mut best = run_search(req, &c, reference, &mut cache);
    let mut relaxed: Vec<&str> = Vec::new();
    let mut step = 0;
    while best.is_none() && step < ladder.len() {
        let (name, relax) = ladder[step];
        // Only report constraints that were actually active.
        let was_active = match step {
            0 => c.target_f3.is_some(),
            1 => c.buildable_port,
            2 => c.respect_xmax,
            _ => c.max_volume.is_some(),
        };
        relax(&mut c);
        if was_active {
            relaxed.push(name);
        }
        best = run_search(req, &c, reference, &mut cache);
        step += 1;
    }

    if !relaxed.is_empty() {
        notes.push(format!(
            "No alignment satisfied every constraint — relaxed: {}.",
            relaxed.join(", ")
        ));
    }

    let Some((geom, m)) = best else {
        // Unreachable in practice (the fully-relaxed search always yields something),
        // but return a sane box rather than panicking on degenerate driver data.
        notes.push("Driver parameters are out of range for automatic alignment.".into());
        let vb = (req.driver.vas * req.num_drivers).max(1.0);
        return AlignmentRecommendation {
            v_box: vb,
            tuning_freq: req.driver.fs,
            v_rear: vb * 0.5,
            v_front: vb * 0.5,
            rear_tuning_freq: req.driver.fs,
            front_tuning_freq: req.driver.fs,
            alignment_name: "n/a".into(),
            notes,
            ..Default::default()
        };
    };

    // Report which constraints ended up binding, so a surprising box has a reason
    // attached to it rather than looking arbitrary.
    if let Some(cap) = c.max_volume {
        if geom.total_volume() >= cap * 0.985 {
            notes.push(format!("Box volume cap held the alignment at {:.1} L.", cap));
        }
    }
    if c.respect_xmax && m.excursion_ratio > 0.97 {
        notes.push("Xmax at rated power is the limiting factor.".into());
    }
    if c.buildable_port && m.port_velocity > MAX_PORT_VELOCITY * 0.97 {
        notes.push("Port velocity is at the chuffing limit.".into());
    }

    let num = req.num_drivers;
    let name = classify(req, &geom, &m);

    let mut rec = AlignmentRecommendation {
        f3: round1(m.f3),
        f_high: round1(m.f_high),
        ripple_db: round2(m.ripple),
        knee: round2(m.knee),
        excursion_ratio: round2(m.excursion_ratio),
        port_velocity: round1(m.port_velocity),
        alignment_name: name,
        notes,
        ..Default::default()
    };

    match geom {
        Geom::Sealed { vb } => {
            rec.v_box = round1(vb * num);
            rec.tuning_freq = 0.0;
        }
        Geom::Vented { vb, fb } | Geom::PassiveRadiator { vb, fb } => {
            rec.v_box = round1(vb * num);
            rec.tuning_freq = round1(fb);
        }
        Geom::Bp4 { vr, vf, ff } => {
            rec.v_rear = round1(vr * num);
            rec.v_front = round1(vf * num);
            rec.front_tuning_freq = round1(ff);
            rec.tuning_freq = round1(ff);
        }
        Geom::Bp6 { vr, vf, fr, ff } => {
            rec.v_rear = round1(vr * num);
            rec.v_front = round1(vf * num);
            rec.rear_tuning_freq = round1(fr);
            rec.front_tuning_freq = round1(ff);
            rec.tuning_freq = round1(ff);
        }
    }

    rec
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate geometry
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Copy, Debug)]
enum Geom {
    Sealed { vb: f64 },
    Vented { vb: f64, fb: f64 },
    PassiveRadiator { vb: f64, fb: f64 },
    Bp4 { vr: f64, vf: f64, ff: f64 },
    Bp6 { vr: f64, vf: f64, fr: f64, ff: f64 },
}

impl Geom {
    /// Total enclosure volume for one driver, in liters.
    fn total_volume(&self) -> f64 {
        match *self {
            Geom::Sealed { vb } => vb,
            Geom::Vented { vb, .. } | Geom::PassiveRadiator { vb, .. } => vb,
            Geom::Bp4 { vr, vf, .. } => vr + vf,
            Geom::Bp6 { vr, vf, .. } => vr + vf,
        }
    }

    fn has_port(&self) -> bool {
        !matches!(self, Geom::Sealed { .. } | Geom::PassiveRadiator { .. })
    }
}

/// Vas as the circuit model actually sees it. `solve_circuit` derives compliance from
/// Fs and Mms (`cms = 1/(ωs²·Mms)`) and ignores the nameplate Vas whenever Mms is
/// present, so searching over the nameplate figure would size the grid off a number
/// the simulation never uses — and isobaric configurations, which double Mms, would
/// be searched over double the volume range they should be.
fn effective_vas(dp: &DriverParams) -> f64 {
    let sd_m2 = dp.sd * 1e-4;
    let w_s = 2.0 * std::f64::consts::PI * dp.fs;
    if dp.mms > 0.0 && sd_m2 > 0.0 && w_s > 0.0 {
        let mms_kg = dp.mms / 1000.0;
        let vas_m3 = (circuit::RHO0 * circuit::C_AIR * circuit::C_AIR * sd_m2 * sd_m2)
            / (w_s * w_s * mms_kg);
        (vas_m3 * 1000.0).max(0.1)
    } else {
        dp.vas.max(0.1)
    }
}

/// Nominal vent area used while scoring. Port *volume* velocity is essentially
/// independent of vent area at a fixed tuning (the duct is re-lengthened to hold Fb),
/// so a realistic stand-in is enough here; the reported area is solved for afterwards.
fn nominal_port_area(driver: &DriverParams) -> f64 {
    (driver.sd * 1e-4 * 0.25).max(2e-3)
}

fn build_circuit(req: &AlignRequest, geom: &Geom) -> AcousticCircuit {
    let dp = &req.driver;
    let ap = nominal_port_area(dp);
    let len = |area: f64, f: f64, vol_l: f64| circuit::derive_port_length_m(area, f, vol_l * 1e-3);

    match *geom {
        Geom::Sealed { vb } => build_sealed(dp, vb, req.q_loss),
        Geom::Vented { vb, fb } => {
            build_vented(dp, vb, ap, len(ap, fb, vb), 1, req.q_port, req.q_loss)
        }
        Geom::PassiveRadiator { vb, fb } => {
            build_passive_radiator(dp, vb, req.pr_mms, req.pr_sd, fb, req.pr_qms, req.q_loss)
        }
        Geom::Bp4 { vr, vf, ff } => {
            build_bandpass4(dp, vr, vf, ap, len(ap, ff, vf), req.q_port, req.q_loss)
        }
        Geom::Bp6 { vr, vf, fr, ff } => {
            if req.enclosure_type == "bandpass6_series" {
                build_bandpass6_series(
                    dp, vr, vf,
                    ap, len(ap, fr, vr),
                    ap, len(ap, ff, vf),
                    req.q_port, req.q_loss,
                )
            } else {
                build_bandpass6_parallel(
                    dp, vr, vf,
                    ap, len(ap, fr, vr),
                    ap, len(ap, ff, vf),
                    req.q_port, req.q_loss,
                )
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Copy, Debug, Default)]
struct Metrics {
    /// Lower edge of the *contiguous* passband, in Hz.
    f3: f64,
    /// Upper −3 dB corner, in Hz. Only meaningful for a bandpass, where the passband
    /// is bounded on both sides; zero for a high-pass alignment.
    f_high: f64,
    /// Mean in-band level relative to the driver's asymptote, in dB — the bandpass
    /// gain. A narrow bandpass trades bandwidth for this, which is the whole point of
    /// the maximum-output preset.
    passband_level: f64,
    /// Largest excursion above the passband reference, in dB.
    overshoot: f64,
    /// f10/f3 — how sharp the rolloff knee is. A true 4th-order Butterworth gives
    /// 0.76; a gentle, droopy rolloff gives much less. This is what separates a real
    /// alignment from an oversized box that merely sags its way down to a low F3.
    knee: f64,
    /// Headline in-band deviation, in dB.
    ripple: f64,
    excursion_ratio: f64,
    port_velocity: f64,
    /// Vent area required to stay under the chuffing limit, m².
    port_area_req: f64,
    /// Knee this topology should be measured against. Zero disables the knee term.
    ideal_knee: f64,
    feasible: bool,
}

/// Knee ratio of an ideal Butterworth high-pass — the −10 dB point as a fraction of
/// the −3 dB point. A 2nd-order rolloff puts it at (1/9)^(1/4) = 0.577, a 4th-order at
/// (1/9)^(1/8) = 0.760. Comparing a sealed box against the 4th-order figure would
/// reject every correct sealed alignment, so the target follows the system order.
const KNEE_2ND: f64 = 0.577;
const KNEE_4TH: f64 = 0.760;

/// Analysis band: low enough to see the rolloff, high enough to establish a
/// passband reference clear of the driver's inductive droop.
fn band(fs: f64) -> (f64, f64) {
    let lo = (fs * 0.15).clamp(3.0, 30.0);
    // The ceiling has to clear the system resonance of even the smallest box in the
    // search range, or a small box's own peak lands in the reference region and the
    // alignment is scored against its own overshoot.
    let hi = (fs * 10.0).max(300.0);
    (lo, hi)
}

/// Level of the driver's mass-controlled asymptote, in dB.
///
/// Every enclosure converges to this same output well above its resonance — the box
/// stops loading the cone — so it is a reference that does not move with the candidate
/// being scored. Deriving the reference from each candidate's *own* curve instead lets
/// a small box whose resonance has climbed into the reference region be measured
/// against its own peak, which hides the peak and makes absurd boxes look flat.
fn passband_reference(req: &AlignRequest) -> f64 {
    let dp = &req.driver;
    let huge = effective_vas(dp) * 100.0;
    let circuit = build_sealed(dp, huge, req.q_loss);
    let xo = PassiveCrossoverSpec {
        enabled: false,
        filter_type: "lowpass_1st".into(),
        inductance_mh: 0.0,
        capacitance_uf: 0.0,
        r_series: 0.0,
    };
    let re = if dp.re > 0.0 { dp.re } else { 4.0 };
    let e_g = ((req.input_power / req.num_drivers).max(1e-6) * re).sqrt();

    let (_, f_hi) = band(dp.fs);
    let mut reference = f64::NEG_INFINITY;
    for i in 0..24 {
        let f = 10.0_f64.powf(
            (f_hi / 2.5).log10() + i as f64 / 23.0 * (f_hi.log10() - (f_hi / 2.5).log10()),
        );
        let Ok(sol) = solve_circuit(&circuit, f, e_g, dp, &xo) else { continue };
        reference = reference.max(compute_spl(sol.total_radiated_velocity, f, 1.0, 1.0));
    }
    reference
}

fn evaluate(req: &AlignRequest, geom: &Geom, reference: f64) -> Metrics {
    let dp = &req.driver;
    let circuit = build_circuit(req, geom);
    let xo = PassiveCrossoverSpec {
        enabled: false,
        filter_type: "lowpass_1st".into(),
        inductance_mh: 0.0,
        capacitance_uf: 0.0,
        r_series: 0.0,
    };

    // Mirror simulate_system's drive level so excursion matches the plotted curve.
    let re = if dp.re > 0.0 { dp.re } else { 4.0 };
    let p_per_driver = (req.input_power / req.num_drivers).max(1e-6);
    let e_g = (p_per_driver * re).sqrt();

    let (f_lo, f_hi) = band(dp.fs);
    let log_lo = f_lo.log10();
    let step = (f_hi.log10() - log_lo) / (N_POINTS - 1) as f64;

    let mut freqs = [0.0f64; N_POINTS];
    let mut spl = [0.0f64; N_POINTS];
    let mut exc_mm = [0.0f64; N_POINTS];
    let mut pr_exc_mm = [0.0f64; N_POINTS];
    let mut max_port_u = 0.0f64;

    for i in 0..N_POINTS {
        let f = 10.0_f64.powf(log_lo + i as f64 * step);
        // A geometry whose circuit has no solution is simply not a candidate; `passes`
        // rejects anything not marked feasible.
        let Ok(sol) = solve_circuit(&circuit, f, e_g, dp, &xo) else {
            return Metrics { feasible: false, ..Default::default() };
        };
        freqs[i] = f;
        spl[i] = compute_spl(sol.total_radiated_velocity, f, 1.0, 1.0);
        exc_mm[i] = circuit::peak_displacement_mm(sol.driver_displacement);
        // A passive radiator usually runs out of travel before the cone does, so an
        // alignment that respects Xmax has to respect the radiator's too.
        if matches!(geom, Geom::PassiveRadiator { .. }) {
            if let Some(u) = sol.port_velocities.first() {
                let w = 2.0 * std::f64::consts::PI * f;
                let area = (req.pr_sd * 1e-4).max(1e-6);
                let j = num_complex::Complex64::new(0.0, 1.0);
                pr_exc_mm[i] = circuit::peak_displacement_mm(u / (j * w * area));
            }
        }
        if geom.has_port() {
            for u in &sol.port_velocities {
                max_port_u = max_port_u.max(u.norm());
            }
        }
    }

    if !spl.iter().all(|v| v.is_finite()) {
        return Metrics::default();
    }

    let is_bandpass = matches!(geom, Geom::Bp4 { .. } | Geom::Bp6 { .. });
    let mut m = if is_bandpass {
        score_bandpass(&freqs, &spl, reference)
    } else {
        score_highpass(&freqs, &spl, reference)
    };

    m.ideal_knee = match geom {
        Geom::Sealed { .. } => KNEE_2ND,
        Geom::Vented { .. } | Geom::PassiveRadiator { .. } => KNEE_4TH,
        // A bandpass is scored on passband ripple and width, not on knee shape.
        Geom::Bp4 { .. } | Geom::Bp6 { .. } => 0.0,
    };

    // Excursion is judged over the passband only. A vented cone unloads without limit
    // below tuning, so including the bottom of the analysis band would make every
    // alignment look over-excursed and the constraint would never bind on anything.
    // Out-of-band content is the high-pass filter's job, not the alignment's.
    let mut cone_ratio = 0.0f64;
    let mut radiator_ratio = 0.0f64;
    for i in 0..N_POINTS {
        if freqs[i] < m.f3 {
            continue;
        }
        if dp.xmax > 0.0 {
            cone_ratio = cone_ratio.max(exc_mm[i] / dp.xmax);
        }
        if req.pr_xmax > 0.0 {
            radiator_ratio = radiator_ratio.max(pr_exc_mm[i] / req.pr_xmax);
        }
    }
    // Whichever runs out first is the one that limits the design.
    m.excursion_ratio = cone_ratio.max(radiator_ratio);

    if geom.has_port() && max_port_u > 0.0 {
        // Smallest vent that keeps air speed under the chuffing limit.
        let area_req = (max_port_u / MAX_PORT_VELOCITY).max(2e-3);
        m.port_area_req = area_req;
        m.port_velocity = max_port_u / area_req;
    }

    m
}

/// Score a high-pass response (sealed, vented, passive radiator).
fn score_highpass(freqs: &[f64; N_POINTS], spl: &[f64; N_POINTS], reference: f64) -> Metrics {
    if !reference.is_finite() {
        return Metrics::default();
    }
    // Start the downward scan from the top of the band, where every candidate has
    // settled onto the shared asymptote.
    let ref_idx = N_POINTS - 1;

    let overshoot = (0..N_POINTS).fold(0.0f64, |a, i| a.max(spl[i] - reference));

    // Walk DOWN from the passband so the corner is the edge of the *contiguous*
    // passband. Scanning upward from the bottom would latch onto a detached
    // low-frequency port bump and report an F3 far below any usable output.
    let f3 = edge_below(freqs, spl, ref_idx, reference - 3.0);
    let f10 = edge_below(freqs, spl, ref_idx, reference - 10.0);

    Metrics {
        f3,
        overshoot,
        knee: if f3 > 0.0 { f10 / f3 } else { 0.0 },
        ripple: overshoot,
        feasible: true,
        ..Default::default()
    }
}

/// Score a bandpass response, where the passband is bounded on both sides.
fn score_bandpass(
    freqs: &[f64; N_POINTS],
    spl: &[f64; N_POINTS],
    reference: f64,
) -> Metrics {
    let mut peak = f64::NEG_INFINITY;
    let mut peak_idx = 0usize;
    for (i, &level) in spl.iter().enumerate() {
        if level > peak {
            peak = level;
            peak_idx = i;
        }
    }
    if !peak.is_finite() {
        return Metrics::default();
    }
    let threshold = peak - 3.0;

    let f3 = edge_below(freqs, spl, peak_idx, threshold);
    let f_high = edge_above(freqs, spl, peak_idx, threshold);

    // Both corners have to be resolved strictly inside the analysed band. When a
    // corner is not found the edge scan returns the band limit, and every number
    // derived from it — bandwidth, ripple, in-band level — then describes a passband
    // that partly lies outside the window rather than the design being scored.
    if f3 <= freqs[0] * 1.02 || f_high >= freqs[N_POINTS - 1] * 0.98 {
        return Metrics::default();
    }

    // A bandpass narrower than about half an octave is a resonant sliver, not a
    // loudspeaker. Rejecting these stops the solver from collapsing both chambers
    // onto a razor-thin peak, which scores zero ripple precisely because there is
    // almost no passband in which to have ripple.
    if f_high <= f3 * MIN_BANDWIDTH_RATIO {
        return Metrics::default();
    }

    // Ripple and mean level across the −3 dB passband.
    let mut sum = 0.0;
    let mut count = 0usize;
    for i in 0..N_POINTS {
        if freqs[i] >= f3 && freqs[i] <= f_high {
            sum += spl[i];
            count += 1;
        }
    }
    if count == 0 {
        return Metrics::default();
    }
    let mean = sum / count as f64;

    let mut dev = 0.0f64;
    for i in 0..N_POINTS {
        if freqs[i] >= f3 && freqs[i] <= f_high {
            dev = dev.max((spl[i] - mean).abs());
        }
    }

    Metrics {
        f3,
        f_high,
        passband_level: mean - reference,
        overshoot: dev,
        knee: 0.0,
        ripple: dev,
        feasible: true,
        ..Default::default()
    }
}

/// Lowest frequency above `from_idx` at which the response drops through `level`,
/// log-interpolated — the upper edge of a bandpass passband.
fn edge_above(
    freqs: &[f64; N_POINTS],
    spl: &[f64; N_POINTS],
    from_idx: usize,
    level: f64,
) -> f64 {
    for i in from_idx..N_POINTS.saturating_sub(1) {
        if spl[i] >= level && spl[i + 1] < level {
            let t = (spl[i] - level) / (spl[i] - spl[i + 1]).max(1e-9);
            let lg = freqs[i].log10() + t * (freqs[i + 1].log10() - freqs[i].log10());
            return 10.0_f64.powf(lg);
        }
    }
    freqs[N_POINTS - 1]
}

/// Highest frequency below `from_idx` at which the response drops through `level`,
/// log-interpolated. Walking downward from inside the passband is what makes this the
/// contiguous passband edge rather than any lower crossing.
fn edge_below(
    freqs: &[f64; N_POINTS],
    spl: &[f64; N_POINTS],
    from_idx: usize,
    level: f64,
) -> f64 {
    let mut i = from_idx;
    while i > 0 {
        if spl[i - 1] < level && spl[i] >= level {
            let t = (level - spl[i - 1]) / (spl[i] - spl[i - 1]).max(1e-9);
            let lg = freqs[i - 1].log10() + t * (freqs[i].log10() - freqs[i - 1].log10());
            return 10.0_f64.powf(lg);
        }
        i -= 1;
    }
    // Never drops through the level inside the analysed band.
    freqs[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost functions — one per alignment family
// ─────────────────────────────────────────────────────────────────────────────

fn cost(req: &AlignRequest, geom: &Geom, m: &Metrics) -> f64 {
    if !m.feasible {
        return f64::INFINITY;
    }
    let fs = req.driver.fs.max(1.0);
    let f3n = m.f3 / fs;
    let vn = geom.total_volume() / effective_vas(&req.driver);

    // A sealed box is fully described by Qtc, which follows exactly from Vb with no
    // approximation, so target it directly rather than inferring it from the curve.
    if let Geom::Sealed { vb } = *geom {
        let qtc = req.driver.qts * (effective_vas(&req.driver) / vb.max(1e-6) + 1.0).sqrt();
        let want = match req.target {
            AlignTarget::MaximallyFlat => 0.707, // Butterworth
            AlignTarget::ExtendedBass => 0.600,  // larger box, tighter transient
            AlignTarget::Boomy => 1.000,         // smaller box, more output at f0
        };
        let d = qtc - want;
        // Qts sets a floor on Qtc; when the target is unreachable this drives the box
        // as large as the range allows, which is the closest approach available.
        return 10.0 * d * d + 0.02 * vn;
    }

    // A bandpass is specified by its passband, not by a corner frequency and a
    // rolloff shape, so it gets its own objectives rather than reusing the high-pass
    // ones with different weights.
    if matches!(geom, Geom::Bp4 { .. } | Geom::Bp6 { .. }) {
        return bandpass_cost(req, m, vn);
    }

    // Ripple below this is inaudible and within the solver's own numerical noise.
    let ripple = (m.ripple - 0.5).max(0.0);
    // How far short of a proper 4th-order knee the rolloff falls. Without this a
    // grossly oversized box wins by drooping gently to a low F3 with little ripple.
    let knee_deficit = (m.ideal_knee - m.knee).max(0.0);

    match req.target {
        // Flatness first, then a proper knee; extension and size separate the
        // candidates that satisfy both.
        AlignTarget::MaximallyFlat => {
            2.0 * ripple * ripple + 20.0 * knee_deficit * knee_deficit + 0.15 * f3n + 0.2 * vn
        }

        // Lowest F3 that still holds ripple inside 2 dB with a recognisably vented
        // rolloff.
        AlignTarget::ExtendedBass => {
            let r = (m.ripple - 2.0).max(0.0);
            let k = (m.ideal_knee * 0.92 - m.knee).max(0.0);
            f3n + 3.0 * r * r + 20.0 * k * k + 0.02 * vn
        }

        // Aim for a ~3 dB hump, and prefer the smaller cabinet that gets you there.
        AlignTarget::Boomy => {
            let e = m.overshoot - 3.0;
            let k = (m.ideal_knee * 0.85 - m.knee).max(0.0);
            5.0 * e * e + 20.0 * k * k + 0.3 * f3n + 0.6 * vn
        }
    }
}

/// Objectives for a bandpass enclosure.
///
/// When the caller names a passband the corners are matched directly; otherwise the
/// preset decides how bandwidth, flatness and in-band gain trade against each other.
fn bandpass_cost(req: &AlignRequest, m: &Metrics, vn: f64) -> f64 {
    // Bandwidth in octaves — the quantity a bandpass is actually bought for.
    let octaves = (m.f_high / m.f3).log2();

    if let Some(t) = req.passband {
        // Log-ratio error so both corners are matched proportionally: being 5 Hz off
        // at 25 Hz matters far more than being 5 Hz off at 80 Hz.
        let e_lo = (m.f3 / t.low).ln().abs();
        let e_hi = (m.f_high / t.high).ln().abs();
        let ripple = (m.ripple - 1.0).max(0.0);
        return 4.0 * (e_lo + e_hi) + 0.5 * ripple * ripple + 0.1 * vn;
    }

    // Nothing in flatness, bandwidth or gain says *where* the band should sit, so
    // without a target the solver will happily centre a tidy little passband at
    // 140 Hz on a 33 Hz subwoofer driver. Anchor it to the driver's resonance, which
    // a well-designed bandpass straddles; the log makes a band an octave too low as
    // costly as one an octave too high.
    let centre = (m.f3 * m.f_high).sqrt();
    let off_centre = (centre / req.driver.fs.max(1.0)).ln().abs();

    match req.target {
        // Flattest band available; width is the tiebreak, not the goal.
        AlignTarget::MaximallyFlat => {
            let ripple = (m.ripple - 0.5).max(0.0);
            6.0 * ripple * ripple - 0.8 * octaves + off_centre + 0.15 * vn
        }
        // Wide and still reasonably flat, with some gain allowed.
        AlignTarget::ExtendedBass => {
            let ripple = (m.ripple - 1.5).max(0.0);
            2.0 * ripple * ripple - 1.2 * octaves - 0.10 * m.passband_level
                + off_centre
                + 0.15 * vn
        }
        // Trade bandwidth for in-band gain — the SPL build.
        AlignTarget::Boomy => {
            let ripple = (m.ripple - 3.0).max(0.0);
            2.0 * ripple * ripple - 0.5 * m.passband_level - 0.2 * octaves
                + off_centre
                + 0.3 * vn
        }
    }
}

/// Hard constraint check. Returns false for candidates that must not be recommended.
fn passes(req: &AlignRequest, geom: &Geom, m: &Metrics, c: &AlignConstraints) -> bool {
    if !m.feasible {
        return false;
    }
    if let Some(cap) = c.max_volume {
        if geom.total_volume() * req.num_drivers > cap {
            return false;
        }
    }
    if c.respect_xmax && req.driver.xmax > 0.0 && m.excursion_ratio > 1.0 {
        return false;
    }
    if let Some(t) = c.target_f3 {
        if m.f3 > t {
            return false;
        }
    }
    if c.buildable_port && geom.has_port() && m.port_area_req > 0.0 {
        // The vent that keeps velocity in check must also physically fit: it may not
        // swallow the cabinet, nor be longer than a folded duct could reasonably be.
        let vol_l = geom.total_volume();
        let tune = match *geom {
            Geom::Vented { fb, .. } => fb,
            Geom::Bp4 { ff, .. } => ff,
            Geom::Bp6 { ff, .. } => ff,
            _ => return true,
        };
        let len = circuit::derive_port_length_m(m.port_area_req, tune, vol_l * 1e-3);
        let displaced_l = m.port_area_req * len * 1000.0;
        if displaced_l > 0.30 * vol_l {
            return false;
        }
        // Allow a folded port up to 3 internal box dimensions long.
        let box_dim_m = (vol_l * 1e-3).cbrt();
        if len > 3.0 * box_dim_m {
            return false;
        }
    }
    true
}

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Copy)]
struct Axis {
    lo: f64,
    hi: f64,
    log: bool,
}

impl Axis {
    fn at(&self, t: f64) -> f64 {
        if self.log {
            10.0_f64.powf(self.lo.log10() + t * (self.hi.log10() - self.lo.log10()))
        } else {
            self.lo + t * (self.hi - self.lo)
        }
    }
}

fn axes_for(req: &AlignRequest, c: &AlignConstraints) -> Vec<Axis> {
    let vas = effective_vas(&req.driver);
    let fs = req.driver.fs.max(1.0);

    // Per-driver volume; the caller multiplies back up by num_drivers.
    let v_cap = c
        .max_volume
        .map(|cap| (cap / req.num_drivers).max(0.05 * vas))
        .unwrap_or(f64::INFINITY);

    let vol = |lo: f64, hi: f64| Axis {
        lo: (lo * vas).min(v_cap),
        hi: (hi * vas).min(v_cap),
        log: true,
    };
    let freq = |lo: f64, hi: f64| Axis {
        lo: lo * fs,
        hi: hi * fs,
        log: true,
    };

    // A named passband tells us roughly where the tunings have to sit, so the search
    // can cover that region densely instead of spreading the same number of grid
    // points across every tuning the driver could theoretically take.
    let tuning = match req.passband {
        Some(t) => Axis { lo: (t.low * 0.5).max(3.0), hi: t.high * 2.0, log: true },
        None => freq(0.3, 2.5),
    };

    match req.enclosure_type.as_str() {
        "ported" => vec![vol(0.1, 8.0), freq(0.35, 2.0)],
        "passive_radiator" => vec![vol(0.1, 8.0), freq(0.35, 2.0)],
        "bandpass4" => vec![vol(0.1, 5.0), vol(0.05, 3.0), tuning],
        "bandpass6_parallel" | "bandpass6_series" => {
            vec![vol(0.1, 5.0), vol(0.05, 3.0), tuning, tuning]
        }
        _ => vec![vol(0.05, 8.0)],
    }
}

fn decode(req: &AlignRequest, p: &[f64]) -> Geom {
    match req.enclosure_type.as_str() {
        "ported" => Geom::Vented { vb: p[0], fb: p[1] },
        "passive_radiator" => Geom::PassiveRadiator { vb: p[0], fb: p[1] },
        "bandpass4" => Geom::Bp4 { vr: p[0], vf: p[1], ff: p[2] },
        "bandpass6_parallel" | "bandpass6_series" => Geom::Bp6 {
            vr: p[0],
            vf: p[1],
            fr: p[2],
            ff: p[3],
        },
        _ => Geom::Sealed { vb: p[0] },
    }
}

/// Coarse grid then two shrinking refinements, reusing any metric already computed.
///
/// The relaxation ladder re-runs this with each constraint set in turn, and `evaluate`
/// never reads the constraints — only `passes` does — so the coarse grid is bit-identical
/// every time `max_volume` is unchanged, which is three of the four rungs. Without the
/// cache a 6th-order bandpass that exhausts the ladder re-simulated the same candidates
/// four times over.
fn run_search(
    req: &AlignRequest,
    c: &AlignConstraints,
    reference: f64,
    cache: &mut EvalCache,
) -> Option<(Geom, Metrics)> {
    let mut axes = axes_for(req, c);
    let dims = axes.len();

    // Keep the total candidate count roughly constant as dimensionality grows.
    let coarse_n = match dims {
        1 => 48,
        2 => 18,
        3 => 11,
        _ => 8,
    };

    let mut best: Option<([f64; MAX_DIMS], Geom, Metrics, f64)> = None;
    let mut best_t = [0.5f64; MAX_DIMS];

    for stage in 0..3 {
        // Refinement runs inside an already-narrow window, so a coarser grid costs
        // little accuracy — and in four dimensions it is the difference between 2401
        // and 625 candidates per stage.
        let refine_n = if dims >= 3 { 5 } else { 7 };
        let n: usize = if stage == 0 { coarse_n } else { refine_n };
        let total = n.pow(dims as u32);

        // Odometer decode of each flat index into per-axis grid positions. Fixed arrays
        // rather than Vecs: the search is at most four-dimensional and this runs tens
        // of thousands of times per solve, so two heap allocations per candidate cost
        // more than the parallelism saves on a machine with few cores to spread over.
        let candidates: Vec<([f64; MAX_DIMS], [f64; MAX_DIMS])> = (0..total)
            .map(|idx| {
                let mut rem = idx;
                let mut t = [0.0f64; MAX_DIMS];
                let mut params = [0.0f64; MAX_DIMS];
                for d in 0..dims {
                    let k = rem % n;
                    rem /= n;
                    t[d] = if n == 1 { 0.5 } else { k as f64 / (n - 1) as f64 };
                    params[d] = axes[d].at(t[d]);
                }
                (t, params)
            })
            .collect();

        // Evaluating a candidate is an independent circuit solve — 96 of them — and is
        // effectively the whole cost of the search, so the misses go out to rayon.
        // Anything the ladder has already computed is served from the cache instead;
        // that check is the cheap half, so it stays on this thread.
        let mut metrics: Vec<Option<Metrics>> = candidates
            .iter()
            .map(|(_, params)| cache.get(&params[..dims]))
            .collect();

        // Gather the misses, and fold the duplicates among them together.
        //
        // Both halves matter. Collecting first means a stage the ladder has already
        // covered does no parallel work at all. Deduplicating means the refinement
        // stages do not evaluate the same geometry twice: their windows are narrow
        // enough that distinct grid positions decode to identical parameters, and the
        // sequential version got that for free by populating the cache as it went. A
        // 6th-order bandpass exhausting the ladder evaluates 5,575 geometries with this
        // and 9,441 without — the batch would have given back most of what the cache won.
        let mut unique: Vec<usize> = Vec::new();
        let mut owner: std::collections::HashMap<[u64; MAX_DIMS], usize> =
            std::collections::HashMap::new();
        let mut which: Vec<usize> = Vec::new();
        let mut misses: Vec<usize> = Vec::new();
        for (i, m) in metrics.iter().enumerate() {
            if m.is_some() {
                continue;
            }
            misses.push(i);
            let key = EvalCache::key(&candidates[i].1[..dims]).unwrap_or_default();
            match owner.get(&key) {
                Some(&u) => which.push(u),
                None => {
                    owner.insert(key, unique.len());
                    which.push(unique.len());
                    unique.push(i);
                }
            }
        }

        if !unique.is_empty() {
            // Every candidate is an independent circuit solve — 96 of them — and this
            // is effectively the entire cost of the search.
            let computed: Vec<Metrics> = unique
                .par_iter()
                .map(|&i| evaluate(req, &decode(req, &candidates[i].1[..dims]), reference))
                .collect();
            for (&i, &u) in misses.iter().zip(&which) {
                let m = computed[u];
                cache.insert(&candidates[i].1[..dims], m);
                metrics[i] = Some(m);
            }
        }

        // Selection stays sequential and in index order, so the winner — including
        // which of two equal costs wins — does not depend on how the work was split.
        for (idx, (t, params)) in candidates.into_iter().enumerate() {
            let Some(m) = metrics[idx] else { continue };
            let geom = decode(req, &params[..dims]);
            if !passes(req, &geom, &m, c) {
                continue;
            }
            let sc = cost(req, &geom, &m);
            if !sc.is_finite() {
                continue;
            }
            if best.as_ref().is_none_or(|(_, _, _, b)| sc < *b) {
                best = Some((t, geom, m, sc));
                best_t = t;
            }
        }

        best.as_ref()?;

        // Shrink each axis to a window around the incumbent for the next pass.
        let width = if stage == 0 {
            1.5 / (coarse_n - 1) as f64
        } else {
            1.5 / (refine_n - 1) as f64 * 0.35
        };
        for d in 0..dims {
            let lo_t = (best_t[d] - width).max(0.0);
            let hi_t = (best_t[d] + width).min(1.0);
            let (nl, nh) = (axes[d].at(lo_t), axes[d].at(hi_t));
            if nh > nl {
                axes[d] = Axis { lo: nl, hi: nh, log: axes[d].log };
            }
        }
    }

    best.map(|(_, g, m, _)| (g, m))
}

/// `solve_alignment` with the metric cache switched off, so a test can prove the two
/// agree. Not used in production.
#[cfg(test)]
fn solve_alignment_uncached(req: &AlignRequest) -> AlignmentRecommendation {
    solve_with(req, false)
}

// ─────────────────────────────────────────────────────────────────────────────
// Naming
// ─────────────────────────────────────────────────────────────────────────────

/// Label the result with the classical alignment family it landed nearest, so the
/// readout means something to someone who knows the literature.
fn classify(req: &AlignRequest, geom: &Geom, m: &Metrics) -> String {
    match *geom {
        Geom::Sealed { vb } => {
            // Qtc = Qts·√(Vas/Vb + 1)
            let qtc = req.driver.qts * (effective_vas(&req.driver) / vb.max(1e-6) + 1.0).sqrt();
            let family = if qtc < 0.55 {
                "over-damped"
            } else if qtc < 0.62 {
                "Bessel"
            } else if qtc < 0.76 {
                "Butterworth"
            } else if qtc < 1.05 {
                "under-damped"
            } else {
                "peaked"
            };
            format!("Sealed {} (Qtc {:.2})", family, qtc)
        }
        Geom::Vented { fb, .. } | Geom::PassiveRadiator { fb, .. } => {
            let h = fb / req.driver.fs.max(1e-6);
            if m.overshoot > 1.5 {
                format!("Chebyshev C4 (Fb/Fs {:.2})", h)
            } else if m.overshoot > 0.35 {
                format!("Quasi-Chebyshev (Fb/Fs {:.2})", h)
            } else if (h - 1.0).abs() < 0.08 {
                "SBB4 (Fb ≈ Fs)".to_string()
            } else if h > 1.0 {
                format!("QB3 (Fb/Fs {:.2})", h)
            } else {
                format!("BB4 / EBS (Fb/Fs {:.2})", h)
            }
        }
        Geom::Bp4 { .. } => "BP4".to_string(),
        Geom::Bp6 { .. } => {
            if req.enclosure_type == "bandpass6_series" {
                "BP6 series".to_string()
            } else {
                "BP6 parallel".to_string()
            }
        }
    }
}

fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}
fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// The whole optimisation rests on one property: `evaluate` is a pure function of
    /// the request and the geometry, and never reads the constraints — only `passes`
    /// does. So a metric computed under one constraint set is still correct under the
    /// next, and the relaxation ladder can reuse it.
    ///
    /// This asserts that directly: the shared cache the ladder actually uses must
    /// produce the same recommendation as giving every search a cache of its own.
    #[test]
    fn reusing_metrics_across_the_ladder_changes_nothing() {
        let dp = driver(32.0, 0.30, 130.0, 1210.0, 5.3, 9.0, 1000.0);
        // Unsatisfiable, so every rung of the ladder runs.
        let tight = AlignConstraints {
            max_volume: Some(1.0),
            target_f3: Some(15.0),
            ..Default::default()
        };

        for enclosure in ["ported", "passive_radiator", "bandpass4", "bandpass6_parallel"] {
            for c in [AlignConstraints::default(), tight] {
                let mut req = request(dp.clone(), enclosure, AlignTarget::MaximallyFlat);
                req.constraints = c;

                let shared = solve_alignment(&req);
                let isolated = solve_alignment_uncached(&req);

                assert_eq!(
                    (shared.v_box, shared.tuning_freq, shared.v_rear, shared.v_front,
                     shared.rear_tuning_freq, shared.front_tuning_freq),
                    (isolated.v_box, isolated.tuning_freq, isolated.v_rear, isolated.v_front,
                     isolated.rear_tuning_freq, isolated.front_tuning_freq),
                    "{enclosure}: caching metrics across the ladder changed the result"
                );
                assert_eq!(shared.alignment_name, isolated.alignment_name);
                assert_eq!(shared.notes, isolated.notes);
            }
        }
    }

    /// Candidates are evaluated in parallel, so the search must not be allowed to
    /// depend on the order they finish in. Selection stays sequential and in index
    /// order for exactly that reason; this requires the same answer every time,
    /// including which of two equal costs wins.
    #[test]
    fn the_search_is_deterministic_though_it_runs_in_parallel() {
        let dp = driver(32.0, 0.30, 130.0, 1210.0, 5.3, 9.0, 1000.0);
        for enclosure in ["ported", "bandpass4", "bandpass6_parallel"] {
            let req = request(dp.clone(), enclosure, AlignTarget::MaximallyFlat);
            let first = solve_alignment(&req);
            for run in 1..8 {
                let again = solve_alignment(&req);
                assert_eq!(
                    (first.v_box, first.tuning_freq, first.v_rear, first.v_front,
                     first.rear_tuning_freq, first.front_tuning_freq),
                    (again.v_box, again.tuning_freq, again.v_rear, again.v_front,
                     again.rear_tuning_freq, again.front_tuning_freq),
                    "{enclosure}: run {run} disagreed with the first"
                );
                assert_eq!(first.alignment_name, again.alignment_name);
            }
        }
    }

    /// Wall-clock cost of a solve, so a change to the search can be judged rather than
    /// argued about. Run with:
    ///   cargo test --release --lib -- --ignored --nocapture time_alignment_search
    #[test]
    #[ignore = "benchmark: prints timings rather than asserting"]
    fn time_alignment_search() {
        let dp = driver(32.0, 0.30, 130.0, 1210.0, 5.3, 9.0, 1000.0);
        // A cap the search cannot satisfy forces the whole relaxation ladder to run,
        // which is the case the duplicated work is worst in.
        let tight = AlignConstraints {
            max_volume: Some(1.0),
            target_f3: Some(15.0),
            ..Default::default()
        };

        for enclosure in ["ported", "bandpass4", "bandpass6_parallel"] {
            for (label, c) in [("unconstrained", AlignConstraints::default()), ("full ladder", tight)] {
                let mut req = request(dp.clone(), enclosure, AlignTarget::MaximallyFlat);
                req.constraints = c;
                let t = std::time::Instant::now();
                let runs = 5;
                for _ in 0..runs {
                    std::hint::black_box(solve_alignment(std::hint::black_box(&req)));
                }
                println!("  {enclosure:20} {label:16} {:>8.1} ms/solve",
                         t.elapsed().as_secs_f64() * 1000.0 / runs as f64);
            }
        }
    }

    #[test]
    #[ignore = "generator: emits reference values for src/lib/effectiveVas.test.ts"]
    fn emit_effective_vas_reference() {
        use crate::model::{Driver, apply_driver_config, driver_to_params};
        // (fs, sd cm², mms g, nameplate vas L, driver_config)
        let cases: [(f64, f64, f64, f64, &str); 7] = [
            (33.0, 1680.0, 335.0, 278.0, "standard"),
            (33.0, 1680.0, 335.0, 278.0, "isobaric_series"),
            (33.0, 1680.0, 335.0, 278.0, "isobaric_parallel"),
            (19.5, 330.0, 95.0, 40.0, "standard"),
            (26.4, 500.0, 220.0, 53.0, "standard"),
            // No Mms on file: nothing to derive from, so the nameplate stands.
            (30.0, 800.0, 0.0, 120.0, "standard"),
            // …and the isobaric halving cannot apply to a figure we did not derive.
            (30.0, 800.0, 0.0, 120.0, "isobaric_series"),
        ];
        for (fs, sd, mms, vas, cfg) in cases {
            let d = Driver { fs, sd, mms, vas, qms: 6.0, qes: 0.4, re: 3.6, ..Default::default() };
            let dp = apply_driver_config(driver_to_params(&d), cfg);
            println!("  [{fs}, {sd}, {mms}, {vas}, \"{cfg}\", {:.9}],", effective_vas(&dp));
        }
    }

    /// Build a driver whose Mms and Bl actually reproduce the quoted Fs/Qts/Vas under
    /// the circuit model. `solve_circuit` derives compliance from Fs and Mms and
    /// ignores nameplate Vas, so a test driver with arbitrary Mms would silently be
    /// testing a different driver than its labels claim.
    fn driver(fs: f64, qts: f64, vas: f64, sd: f64, re: f64, xmax: f64, pe: f64) -> DriverParams {
        let qms = 6.0;
        let qes = qts * qms / (qms - qts);
        let sd_m2 = sd * 1e-4;
        let w_s = 2.0 * std::f64::consts::PI * fs;
        let mms_kg =
            (circuit::RHO0 * circuit::C_AIR * circuit::C_AIR * sd_m2 * sd_m2) / (w_s * w_s * vas * 1e-3);
        let bl = (w_s * mms_kg * re / qes).sqrt();
        DriverParams {
            fs,
            qts,
            qes,
            qms,
            vas,
            re,
            sd,
            xmax,
            mms: mms_kg * 1000.0,
            le: 1.5,
            bl,
            pe,
            sens: 88.0,
        }
    }

    fn request(dp: DriverParams, enclosure: &str, target: AlignTarget) -> AlignRequest {
        AlignRequest {
            driver: dp,
            enclosure_type: enclosure.to_string(),
            num_drivers: 1.0,
            input_power: 100.0,
            q_port: 50.0,
            q_loss: crate::simulate::DEFAULT_Q_LOSS,
            pr_mms: 200.0,
            pr_xmax: 0.0,
            pr_sd: 500.0,
            pr_qms: 5.0,
            target,
            constraints: AlignConstraints::default(),
            passband: None,
        }
    }

    /// (name, fs, qts, vas, sd cm², re, xmax mm, pe W)
    type RefDriver = (&'static str, f64, f64, f64, f64, f64, f64, f64);

    /// Reference drivers spanning the Qts range that broke the old curve-fit formulas.
    fn reference_drivers() -> Vec<RefDriver> {
        vec![
            ("Peerless XLS-10",  19.5, 0.66,  40.0,  330.0, 3.6, 12.5, 200.0),
            ("Dayton UM18-22",   17.7, 0.51, 453.0, 1210.0, 3.4, 19.0, 800.0),
            ("JL 12W7",          26.4, 0.52,  53.0,  500.0, 2.4, 25.0, 750.0),
            ("B&C 18SW115",      32.0, 0.30, 130.0, 1210.0, 5.3,  9.0,1000.0),
            ("18Sound 18NLW9601",33.0, 0.28, 145.0, 1190.0, 5.2, 10.0,1200.0),
        ]
    }

    fn ported(dp: DriverParams, t: AlignTarget) -> AlignmentRecommendation {
        solve_alignment(&request(dp, "ported", t))
    }

    /// Qtc follows exactly from Vb, so a correct sealed alignment is checkable in
    /// closed form regardless of how the solver arrived at it.
    fn qtc_of(dp: &DriverParams, v_box: f64) -> f64 {
        dp.qts * (effective_vas(dp) / v_box + 1.0).sqrt()
    }

    // ── The bug this module replaces ─────────────────────────────────────────

    /// A fixed formula cannot adapt to the enclosure it is being applied to.
    ///
    /// The old closed-form fits (Vb = 15·Vas·Qts^2.87, Fb = 0.42·Fs·Qts^-0.9) were
    /// derived for one particular set of assumptions. In a low-loss box they fall
    /// apart — a Qts 0.66 driver lands with several dB of passband ripple — while the
    /// solver, which evaluates whatever box it is actually given, holds its bar across
    /// the whole realistic range of enclosure losses.
    ///
    /// Worth stating plainly: at a normal Ql of 7 the old fits are not bad for these
    /// drivers. Losses damp the very peaking the fits get wrong, so the gap is widest
    /// in a tight cabinet.
    #[test]
    fn holds_its_flatness_bar_across_enclosure_losses() {
        for (name, fs, qts, vas, sd, re, xmax, pe) in reference_drivers() {
            for q_loss in [3.0, 7.0, 20.0, 200.0] {
                let dp = driver(fs, qts, vas, sd, re, xmax, pe);
                let mut req = request(dp, "ported", AlignTarget::MaximallyFlat);
                req.q_loss = q_loss;
                let rec = solve_alignment(&req);
                assert!(
                    rec.ripple_db <= 1.0,
                    "{name} at Ql {q_loss}: {:.2} dB of ripple",
                    rec.ripple_db
                );
            }
        }
    }

    /// The same check applied to the formula the solver replaced, in the low-loss box
    /// where its assumptions break down.
    #[test]
    fn the_old_curve_fits_do_not_hold_that_bar() {
        let (name, fs, qts, vas, sd, re, xmax, pe) = reference_drivers()[0]; // highest Qts
        let dp = driver(fs, qts, vas, sd, re, xmax, pe);
        let mut req = request(dp.clone(), "ported", AlignTarget::MaximallyFlat);
        req.q_loss = 200.0;
        let reference = passband_reference(&req);

        let old_vb = 15.0 * effective_vas(&dp) * qts.powf(2.87);
        let old_fb = fs * 0.42 * qts.powf(-0.9);
        let old = evaluate(&req, &Geom::Vented { vb: old_vb, fb: old_fb }, reference);

        assert!(
            old.ripple > 1.0,
            "{name}: the old fit was expected to break down in a low-loss box, got {:.2} dB",
            old.ripple
        );
        assert!(solve_alignment(&req).ripple_db <= 1.0, "the solver should still hold");
    }

    // ── Response quality ─────────────────────────────────────────────────────

    #[test]
    fn maximally_flat_is_actually_flat() {
        for (name, fs, qts, vas, sd, re, xmax, pe) in reference_drivers() {
            let rec = ported(driver(fs, qts, vas, sd, re, xmax, pe), AlignTarget::MaximallyFlat);
            assert!(
                rec.ripple_db <= 1.0,
                "{name}: {:.2} dB of passband ripple is not maximally flat",
                rec.ripple_db
            );
            assert!(
                rec.knee >= 0.72,
                "{name}: knee {:.2} is a droopy rolloff, not a 4th-order one",
                rec.knee
            );
            let h = rec.tuning_freq / fs;
            assert!(
                (0.45..=1.40).contains(&h),
                "{name}: Fb/Fs = {h:.2} is not a plausible vented tuning"
            );
        }
    }

    /// The failure the old formulas showed was Qts-dependent, so sweep Qts rather than
    /// only checking a handful of named drivers.
    #[test]
    fn stays_sane_across_the_whole_qts_range() {
        for i in 0..=10 {
            let qts = 0.20 + i as f64 * 0.05;
            let dp = driver(30.0, qts, 80.0, 500.0, 3.5, 12.0, 400.0);
            let rec = ported(dp, AlignTarget::MaximallyFlat);
            assert!(
                rec.ripple_db <= 1.5,
                "Qts {qts:.2}: ripple {:.2} dB",
                rec.ripple_db
            );
            assert!(rec.knee >= 0.70, "Qts {qts:.2}: knee {:.2}", rec.knee);
            let h = rec.tuning_freq / 30.0;
            assert!(
                (0.40..=1.60).contains(&h),
                "Qts {qts:.2}: Fb/Fs = {h:.2} is out of range"
            );
            assert!(rec.v_box > 0.0 && rec.v_box < 5000.0, "Qts {qts:.2}: Vb {:.1} L", rec.v_box);
        }
    }

    #[test]
    fn sealed_lands_on_a_butterworth_qtc() {
        for (name, fs, qts, vas, sd, re, xmax, pe) in reference_drivers() {
            let dp = driver(fs, qts, vas, sd, re, xmax, pe);
            let rec = solve_alignment(&request(dp.clone(), "sealed", AlignTarget::MaximallyFlat));
            let qtc = qtc_of(&dp, rec.v_box);
            // 0.707 exactly where reachable; a driver whose own Qts is already near it
            // can only be approached from above.
            assert!(
                (0.66..=0.82).contains(&qtc),
                "{name}: sealed Qtc {qtc:.3} in {:.1} L is not a maximally flat alignment",
                rec.v_box
            );
        }
    }

    // ── Preset semantics ─────────────────────────────────────────────────────

    #[test]
    fn extended_bass_reaches_at_least_as_deep_as_flat() {
        for (name, fs, qts, vas, sd, re, xmax, pe) in reference_drivers() {
            let dp = driver(fs, qts, vas, sd, re, xmax, pe);
            let flat = ported(dp.clone(), AlignTarget::MaximallyFlat);
            let ext = ported(dp, AlignTarget::ExtendedBass);
            assert!(
                ext.f3 <= flat.f3 * 1.02,
                "{name}: extended bass F3 {:.1} Hz is not deeper than flat {:.1} Hz",
                ext.f3, flat.f3
            );
        }
    }

    #[test]
    fn boomy_trades_a_smaller_box_for_a_hump() {
        for (name, fs, qts, vas, sd, re, xmax, pe) in reference_drivers() {
            let dp = driver(fs, qts, vas, sd, re, xmax, pe);
            let flat = ported(dp.clone(), AlignTarget::MaximallyFlat);
            let boomy = ported(dp, AlignTarget::Boomy);
            assert!(
                boomy.ripple_db >= 2.0,
                "{name}: boomy ripple {:.2} dB has no hump",
                boomy.ripple_db
            );
            assert!(
                boomy.ripple_db > flat.ripple_db,
                "{name}: boomy should be peakier than maximally flat"
            );
            // A deliberate hump is not always the smaller cabinet — for a low-Qts
            // driver reaching +3 dB can take more volume — but it should never be a
            // wild departure in size.
            assert!(
                boomy.v_box <= flat.v_box * 1.5,
                "{name}: boomy box {:.1} L against flat {:.1} L",
                boomy.v_box, flat.v_box
            );
        }
    }

    // ── Constraints ──────────────────────────────────────────────────────────

    #[test]
    fn volume_cap_is_never_exceeded() {
        let dp = driver(17.7, 0.51, 453.0, 1210.0, 3.4, 19.0, 800.0);
        let mut req = request(dp, "ported", AlignTarget::MaximallyFlat);
        req.constraints.max_volume = Some(120.0);
        let rec = solve_alignment(&req);
        assert!(
            rec.v_box <= 120.0 + 1e-6,
            "cap of 120 L was exceeded: {:.1} L",
            rec.v_box
        );
        assert!(rec.v_box > 0.0);
    }

    #[test]
    fn xmax_constraint_pulls_the_alignment_back_within_the_driver() {
        // A short-throw 4 mm driver at 1200 W runs past its limit in the
        // unconstrained optimum, so the constraint has something to bite on.
        let dp = driver(32.0, 0.30, 130.0, 1210.0, 5.3, 4.0, 1000.0);
        let mut req = request(dp, "ported", AlignTarget::MaximallyFlat);
        req.input_power = 1200.0;

        let free = solve_alignment(&req);
        assert!(
            free.excursion_ratio > 1.0,
            "test premise: unconstrained alignment should over-excurse, got {:.2}",
            free.excursion_ratio
        );

        req.constraints.respect_xmax = true;
        let held = solve_alignment(&req);
        assert!(
            held.excursion_ratio <= 1.001,
            "Xmax constraint did not hold: excursion ratio {:.2}",
            held.excursion_ratio
        );
        assert!(
            held.notes.iter().all(|n| !n.contains("relaxed")),
            "Xmax should have been satisfiable, but was relaxed: {:?}",
            held.notes
        );
    }

    #[test]
    fn buildable_port_constraint_keeps_vent_velocity_in_check() {
        let dp = driver(19.5, 0.66, 40.0, 330.0, 3.6, 12.5, 200.0);
        let mut req = request(dp, "ported", AlignTarget::Boomy);
        req.input_power = 400.0;
        req.constraints.buildable_port = true;
        let rec = solve_alignment(&req);
        if rec.notes.iter().any(|n| n.contains("relaxed")) {
            return; // nothing satisfied it; the relaxation note is the contract
        }
        assert!(
            rec.port_velocity <= MAX_PORT_VELOCITY + 0.1,
            "port velocity {:.1} m/s exceeds the chuffing limit",
            rec.port_velocity
        );
    }

    #[test]
    fn unsatisfiable_constraints_relax_and_say_so() {
        let dp = driver(17.7, 0.51, 453.0, 1210.0, 3.4, 19.0, 800.0);
        let mut req = request(dp, "ported", AlignTarget::MaximallyFlat);
        req.constraints.target_f3 = Some(3.0); // physically out of reach
        let rec = solve_alignment(&req);
        assert!(rec.v_box > 0.0, "solver must still return a usable box");
        assert!(
            rec.notes.iter().any(|n| n.contains("relaxed")),
            "an impossible target F3 should be reported as relaxed, got {:?}",
            rec.notes
        );
    }

    // ── Other enclosure types ────────────────────────────────────────────────

    #[test]
    fn multiple_drivers_scale_volume_but_not_tuning() {
        let dp = driver(32.0, 0.30, 130.0, 1210.0, 5.3, 9.0, 1000.0);
        let one = solve_alignment(&request(dp.clone(), "ported", AlignTarget::MaximallyFlat));

        let mut req = request(dp, "ported", AlignTarget::MaximallyFlat);
        req.num_drivers = 2.0;
        req.input_power = 200.0;
        let two = solve_alignment(&req);

        let ratio = two.v_box / one.v_box;
        assert!(
            (1.8..=2.2).contains(&ratio),
            "two drivers should need about twice the volume, got {ratio:.2}×"
        );
        assert!(
            (two.tuning_freq - one.tuning_freq).abs() / one.tuning_freq < 0.15,
            "tuning should not depend on driver count: {:.1} vs {:.1} Hz",
            two.tuning_freq, one.tuning_freq
        );
    }

    const BANDPASS_TYPES: [&str; 3] = ["bandpass4", "bandpass6_parallel", "bandpass6_series"];

    /// The two Qts extremes from the reference set. A 6th-order search is 4-dimensional
    /// and costs roughly a hundred times a ported one, so the bandpass sweeps run the
    /// extremes rather than all five drivers; `print_bandpass` covers the full set.
    fn extreme_drivers() -> Vec<RefDriver> {
        reference_drivers()
            .into_iter()
            .filter(|d| d.0 == "Peerless XLS-10" || d.0 == "18Sound 18NLW9601")
            .collect()
    }

    #[test]
    fn bandpass4_produces_a_usable_passband() {
        let dp = driver(32.0, 0.30, 130.0, 1210.0, 5.3, 9.0, 1000.0);
        let rec = solve_alignment(&request(dp, "bandpass4", AlignTarget::MaximallyFlat));
        assert!(rec.v_rear > 0.0 && rec.v_front > 0.0, "both chambers must be sized");
        assert!(
            rec.front_tuning_freq > 10.0 && rec.front_tuning_freq < 150.0,
            "front chamber tuning {:.1} Hz is out of range",
            rec.front_tuning_freq
        );
        assert!(rec.f3 > 0.0 && rec.f3 < 200.0, "F3 {:.1} Hz is out of range", rec.f3);
    }

    /// The scoring this replaces measured ripple *inside* the −3 dB window but never
    /// rewarded bandwidth, so a razor-thin resonant peak scored a perfect 0.00 dB and
    /// won: every BP6 parallel result collapsed to minimum chambers with both tunings
    /// pinned to the bottom of the search range.
    #[test]
    fn bandpass_alignments_are_never_degenerate() {
        for (name, fs, qts, vas, sd, re, xmax, pe) in extreme_drivers() {
            for enc in BANDPASS_TYPES {
                for (label, t) in [
                    ("maximally_flat", AlignTarget::MaximallyFlat),
                    ("extended_bass", AlignTarget::ExtendedBass),
                    ("boomy", AlignTarget::Boomy),
                ] {
                    let dp = driver(fs, qts, vas, sd, re, xmax, pe);
                    let rec = solve_alignment(&request(dp, enc, t));
                    let ctx = format!("{name} / {enc} / {label}");

                    assert!(
                        rec.f3 > 0.0 && rec.f_high > 0.0,
                        "{ctx}: passband corners were not resolved"
                    );
                    // The floor is enforced on exact values; the reported corners are
                    // rounded to 0.1 Hz, so allow for that when checking it here.
                    assert!(
                        rec.f_high >= rec.f3 * (MIN_BANDWIDTH_RATIO - 0.02),
                        "{ctx}: passband {:.1}–{:.1} Hz is a resonant sliver, not a loudspeaker",
                        rec.f3, rec.f_high
                    );
                    assert!(
                        rec.v_rear > 0.0 && rec.v_front > 0.0,
                        "{ctx}: chamber volumes {:.1} / {:.1} L", rec.v_rear, rec.v_front
                    );
                    assert!(
                        rec.ripple_db <= 2.5,
                        "{ctx}: {:.2} dB of passband ripple", rec.ripple_db
                    );

                    // The band has to sit somewhere near the driver's usable range.
                    let centre = (rec.f3 * rec.f_high).sqrt();
                    assert!(
                        centre > fs / 3.0 && centre < fs * 3.0,
                        "{ctx}: passband centred at {centre:.1} Hz for an {fs} Hz driver"
                    );
                }
            }
        }
    }

    #[test]
    fn bandpass_passband_target_is_honoured() {
        let dp = driver(32.0, 0.30, 130.0, 1210.0, 5.3, 9.0, 1000.0);
        for enc in BANDPASS_TYPES {
            let mut req = request(dp.clone(), enc, AlignTarget::MaximallyFlat);
            req.passband = Some(PassbandTarget { low: 25.0, high: 80.0 });
            let rec = solve_alignment(&req);
            assert!(
                (rec.f3 - 25.0).abs() / 25.0 <= 0.20,
                "{enc}: asked for a 25 Hz lower corner, got {:.1} Hz",
                rec.f3
            );
            assert!(
                (rec.f_high - 80.0).abs() / 80.0 <= 0.20,
                "{enc}: asked for an 80 Hz upper corner, got {:.1} Hz",
                rec.f_high
            );
        }
    }

    /// A passband target should move the result, not be quietly ignored.
    #[test]
    fn different_passband_targets_give_different_boxes() {
        let dp = driver(32.0, 0.30, 130.0, 1210.0, 5.3, 9.0, 1000.0);
        let mut low = request(dp.clone(), "bandpass6_parallel", AlignTarget::MaximallyFlat);
        low.passband = Some(PassbandTarget { low: 20.0, high: 50.0 });
        let mut high = request(dp, "bandpass6_parallel", AlignTarget::MaximallyFlat);
        high.passband = Some(PassbandTarget { low: 40.0, high: 100.0 });

        let a = solve_alignment(&low);
        let b = solve_alignment(&high);
        assert!(
            b.f3 > a.f3 * 1.3,
            "a higher target passband should give a higher corner: {:.1} vs {:.1} Hz",
            b.f3, a.f3
        );
    }

    #[test]
    fn maximum_output_trades_bandwidth_for_gain() {
        for (name, fs, qts, vas, sd, re, xmax, pe) in extreme_drivers() {
            let dp = driver(fs, qts, vas, sd, re, xmax, pe);
            let req_flat = request(dp.clone(), "bandpass4", AlignTarget::MaximallyFlat);
            let reference = passband_reference(&req_flat);

            let flat = solve_alignment(&req_flat);
            let loud = solve_alignment(&request(dp.clone(), "bandpass4", AlignTarget::Boomy));

            let gain = |r: &AlignmentRecommendation| {
                let g = Geom::Bp4 { vr: r.v_rear, vf: r.v_front, ff: r.front_tuning_freq };
                evaluate(&req_flat, &g, reference).passband_level
            };
            assert!(
                gain(&loud) > gain(&flat),
                "{name}: maximum output ({:.1} dB) should out-gain maximum flatness ({:.1} dB)",
                gain(&loud), gain(&flat)
            );
            assert!(
                loud.f_high / loud.f3 <= flat.f_high / flat.f3 * 1.05,
                "{name}: maximum output should not be the wider band"
            );
        }
    }

    /// A radiator normally runs out of travel before the cone does, so an alignment
    /// that respects Xmax has to respect the radiator's limit too — otherwise it
    /// happily recommends a box that is mechanically impossible to build.
    #[test]
    fn passive_radiator_travel_limits_the_alignment() {
        let dp = driver(32.0, 0.30, 130.0, 1210.0, 5.3, 40.0, 1000.0);
        let mut req = request(dp, "passive_radiator", AlignTarget::MaximallyFlat);
        req.input_power = 600.0;
        req.pr_sd = 1200.0;
        req.pr_mms = 250.0;

        // With a generous cone limit and no radiator limit, nothing binds.
        req.constraints.respect_xmax = true;
        req.pr_xmax = 0.0;
        let unlimited = solve_alignment(&req);
        assert!(
            unlimited.excursion_ratio <= 1.001,
            "test premise: the cone alone should not be the limit here, saw {:.2}",
            unlimited.excursion_ratio
        );

        // Give the radiator a short throw and the solver has to work around it.
        req.pr_xmax = 4.0;
        let limited = solve_alignment(&req);
        if limited.notes.iter().any(|n| n.contains("relaxed")) {
            return; // nothing satisfied it; the relaxation note is the contract
        }
        assert!(
            limited.excursion_ratio <= 1.001,
            "radiator travel was not respected: ratio {:.2}",
            limited.excursion_ratio
        );
        assert_ne!(
            (limited.v_box, limited.tuning_freq),
            (unlimited.v_box, unlimited.tuning_freq),
            "a radiator that cannot move should change the recommendation"
        );
    }

    #[test]
    fn bandpass_respects_xmax() {
        // The unconstrained BP6 series optima ran 2–4.5× past Xmax before this bound.
        let dp = driver(19.5, 0.66, 40.0, 330.0, 3.6, 12.5, 200.0);
        let mut req = request(dp, "bandpass6_series", AlignTarget::MaximallyFlat);
        req.input_power = 400.0;
        req.constraints.respect_xmax = true;
        let rec = solve_alignment(&req);
        if rec.notes.iter().any(|n| n.contains("relaxed")) {
            return; // nothing satisfied it; the relaxation note is the contract
        }
        assert!(
            rec.excursion_ratio <= 1.001,
            "bandpass excursion ratio {:.2} exceeds Xmax",
            rec.excursion_ratio
        );
    }

    #[test]
    fn passive_radiator_returns_a_tuning() {
        let dp = driver(32.0, 0.30, 130.0, 1210.0, 5.3, 9.0, 1000.0);
        let rec = solve_alignment(&request(dp, "passive_radiator", AlignTarget::MaximallyFlat));
        assert!(rec.v_box > 0.0, "box must be sized");
        assert!(
            rec.tuning_freq > 5.0 && rec.tuning_freq < 150.0,
            "PR tuning {:.1} Hz is out of range",
            rec.tuning_freq
        );
    }

    #[test]
    #[ignore = "diagnostic"]
    fn print_bandpass() {
        for (name, fs, qts, vas, sd, re, xmax, pe) in reference_drivers() {
            let dp = driver(fs, qts, vas, sd, re, xmax, pe);
            println!("\n{name}  Fs={fs} Qts={qts} Vas={vas}L");
            for enc in ["bandpass4", "bandpass6_parallel", "bandpass6_series"] {
                for (label, t) in [
                    ("flat ", AlignTarget::MaximallyFlat),
                    ("ext  ", AlignTarget::ExtendedBass),
                    ("boomy", AlignTarget::Boomy),
                ] {
                    let req = request(dp.clone(), enc, t);
                    let reference = passband_reference(&req);
                    let r = solve_alignment(&req);
                    // Re-evaluate the winner to expose the passband edges.
                    let g = if enc == "bandpass4" {
                        Geom::Bp4 { vr: r.v_rear, vf: r.v_front, ff: r.front_tuning_freq }
                    } else {
                        Geom::Bp6 { vr: r.v_rear, vf: r.v_front, fr: r.rear_tuning_freq, ff: r.front_tuning_freq }
                    };
                    let m = evaluate(&req, &g, reference);
                    println!(
                        "  {enc:18} {label}: Vr={:6.1} Vf={:6.1} L  Fr={:5.1} Ff={:5.1} Hz  F3={:5.1}  ripple={:.2} dB  exc={:.2}",
                        r.v_rear, r.v_front, r.rear_tuning_freq, r.front_tuning_freq, r.f3, r.ripple_db, m.excursion_ratio
                    );
                }
            }
        }
    }

    #[test]
    #[ignore = "diagnostic: cargo test -- --ignored --nocapture print_alignments"]
    fn print_alignments() {
        for (name, fs, qts, vas, sd, re, xmax, pe) in reference_drivers() {
            let dp = driver(fs, qts, vas, sd, re, xmax, pe);
            println!("\n{name}  Fs={fs} Qts={qts} Vas={vas}L  (effective Vas {:.1} L)", effective_vas(&dp));
            for (label, t) in [
                ("flat ", AlignTarget::MaximallyFlat),
                ("ext  ", AlignTarget::ExtendedBass),
                ("boomy", AlignTarget::Boomy),
            ] {
                let r = solve_alignment(&request(dp.clone(), "ported", t));
                println!(
                    "  {label}: Vb={:6.1} L  Fb={:5.1} Hz (Fb/Fs {:.2})  F3={:5.1}  ripple={:.2} dB  knee={:.2}  [{}]",
                    r.v_box, r.tuning_freq, r.tuning_freq / fs, r.f3, r.ripple_db, r.knee, r.alignment_name
                );
            }
            let s = solve_alignment(&request(dp.clone(), "sealed", AlignTarget::MaximallyFlat));
            println!("  sealed: Vb={:6.1} L  F3={:5.1}  [{}]", s.v_box, s.f3, s.alignment_name);

            // What the replaced closed-form fits would have recommended, scored on the
            // same model, for comparison.
            let req = request(dp.clone(), "ported", AlignTarget::MaximallyFlat);
            let reference = passband_reference(&req);
            let old_vb = 15.0 * effective_vas(&dp) * qts.powf(2.87);
            let old_fb = fs * 0.42 * qts.powf(-0.9);
            let om = evaluate(&req, &Geom::Vented { vb: old_vb, fb: old_fb }, reference);
            println!(
                "  OLD  : Vb={:6.1} L  Fb={:5.1} Hz (Fb/Fs {:.2})  F3={:5.1}  ripple={:.2} dB  knee={:.2}",
                old_vb, old_fb, old_fb / fs, om.f3, om.ripple, om.knee
            );
        }
    }
}
