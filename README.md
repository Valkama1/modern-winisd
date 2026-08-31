# WinISD Modern

A loudspeaker enclosure designer for sealed, vented, bandpass and passive-radiator
boxes.

Inspired by WinISD, which has been the tool of choice for this for twenty years and
shows it. This keeps the idea and rebuilds it: a real circuit solver instead of
closed-form alignment tables, several drivers compared on the same graphs, and honest
limits drawn on the model rather than left for you to know about.

Tauri + React + TypeScript, with the acoustics in Rust.

---

## Features

**Enclosures**
- Sealed, vented, 4th-order bandpass, 6th-order bandpass (parallel and series),
  passive radiator
- Custom topology builder for anything the standard types do not cover
- Multiple ports, circular or slot, plus a second port group
- Isobaric and multi-driver configurations
- Enclosure losses (Ql) and port losses, rather than assuming a lossless box

**Auto-alignment**
- Searches the actual circuit model for the best box and tuning, so it works across the
  whole Qts range instead of only where the classic formulas hold
- Targets: maximally flat, extended bass, high output — and for bandpass boxes, a
  passband you name
- Optional constraints: stay within Xmax at rated power, keep the port buildable, cap
  the box volume, hit a target F3. It says which one bound the result

**Graphs**
- Gain, Transfer Function, SPL, Maximum SPL, Phase, Group Delay, Cone Excursion, Port
  Air Velocity, Impedance
- Transfer Function is normalised against the same driver in free air, so it shows what
  the enclosure alone contributes — coil, sensitivity and radiation model divide out
- Maximum SPL takes the lower of the excursion and thermal ceilings and marks which one
  is binding
- Excursion and port velocity carry their limits; a passive radiator carries its own
- The region past the piston model (ka = 0.5) is shaded, because a lumped simulation has
  nothing useful to say above it
- Overlay several designs, drag a ruler across them all, export SVG or PNG

**Signal chain**
- Parametric EQ: high/low pass, peaking, shelving
- Passive crossover networks against the driver's real complex load
- In-room response by image sources, with drag-and-drop speaker and listener placement
- Cabin gain for vehicle installs

**Driver and project handling**
- Driver database with Thiele/Small consistency checks that say what they cannot verify
- Projects (`.wproj`) for one design, workspaces (`.wsp`) for a whole comparison
- Session restores itself automatically

---

## Limits worth knowing

It is a lumped-parameter simulation, like every tool of this kind. It models the
electro-mechano-acoustic circuit and nothing else: no cone breakup, no directivity, no
baffle diffraction. Above roughly ka = 0.5 the results stop meaning much, which is why
the graphs shade that region instead of quietly drawing a flat line through it.

---

## Getting started

Needs [Node.js](https://nodejs.org/) 18+ and a stable [Rust](https://www.rust-lang.org/)
toolchain. On Linux you will also want the Tauri system dependencies:

```bash
sudo apt-get install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

```bash
npm install
npm run tauri dev
```

## Building

```bash
npm run tauri build
```

Bundles land in `src-tauri/target/release/bundle/`.

## Tests

```bash
npm test                        # frontend
cd src-tauri && cargo test      # solver and alignment
npm run bench                   # graph render cost
```

---

## How it works

The Rust side solves the acoustic circuit by modified nodal analysis: each enclosure is
built as nodes and elements — driver, chamber, port, passive radiator, radiation load —
and every frequency point is one complex admittance solve. Adding an enclosure type
means describing its topology, not writing new response maths.

The alignment solver drives that same model, so a recommendation always matches the
curve you are shown.

**Frontend** React, TypeScript, Tailwind.
**Backend** Rust, `nalgebra`, `num-complex`, Tauri.
