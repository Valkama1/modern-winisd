# Modern WinISD (Tauri + React + Rust)

A modern, high-fidelity electro-mechano-acoustic loudspeaker simulation engine. Powered by a high-performance Rust backend using Modified Nodal Analysis (MNA) and a fast, responsive React + TypeScript frontend built with Tauri.

---

## 🚀 Features

### 1. High-Performance Acoustic Circuit Solver
* **Modified Nodal Analysis (MNA)**: At each frequency point, the backend solves a complex matrix admittance equation $Y(\omega) \cdot x = b$ representing the entire physical and acoustic system.
* **Standard Enclosures**:
  * **Sealed (2nd order)**
  * **Vented/Ported (4th order)**: Supports single or multiple ports, circular or rectangular shapes, and secondary ports.
  * **4th-Order Bandpass**: Sealed rear chamber, ported front chamber.
  * **6th-Order Parallel Bandpass**: Both front and rear chambers ported directly to the environment.
  * **6th-Order Series Bandpass**: Rear chamber vented into the front chamber, front chamber vented to the outside.
  * **Passive Radiator**: Resonating mass-compliance coupling.
* **Custom Topology Editor**: Design custom acoustic circuits using nodes and elements (Drivers, Chambers, Ports, Passive Radiators, and Radiation Loads) and solve them dynamically.

### 2. Signal & DSP Shaping
* **Active EQ / DSP Filtering**: Model 2nd-order Highpass (HP), Lowpass (LP), Peaking EQ, Low Shelf, and High Shelf filters.
* **Passive Crossover Network Simulation**: Real-time modeling of loudspeaker complex load impedance $Z_{\text{driver}}(j\omega) = Z_e + (Bl)^2/Z_m$ interacting with 1st/2nd-order crossover circuits (inductor $L$, capacitor $C$, inductor DCR $R_s$).
* **Voice Coil Inductance ($L_e$) Estimation**: Automatically estimates fallback coil inductance if missing ($L_{e,\text{estimated}} = R_e \times 0.15\text{ mH}$) to preserve filter math accuracy.

### 3. Acoustic Environment Correction
* **Cabin Gain Estimation**: Computes vehicle pressure-zone cabin enhancement with a $+12\text{ dB/octave}$ slope below a configurable corner frequency ($F_{\text{cabin}}$).
* **In-Room SPL Simulation**: Simulates boundary reflections using the Image Source Method (2nd order, 25 virtual image sources) with a drag-and-drop floor-plan speaker & listener placement editor.

### 4. Advanced Graphing & GUI
* **Multi-Graph Dashboard**: Stacked real-time visualization of:
  * Sound Pressure Level (SPL)
  * System Transfer Function (Magnitude & Phase)
  * Cone Excursion (with $X_{\text{max}}$ reference lines)
  * Port Air Velocity (with $17\text{ m/s}$ chuffing guideline)
  * System Electrical Impedance (incorporates passive crossover networks)
  * Group Delay (ms)
* **Draggable Measurement Ruler**: Drag a vertical ruler across the chart to read coordinates, intersection points, and delta values across all active curves.
* **Vector Graphic Exporting**: Export graphs directly as high-resolution PNG or SVG files including curves, reference lines, and ruler measurements.
* **Persistence & Settings**: Automatic session state auto-save (`localStorage` for project parameters, theme configurations, custom graph heights, and chart scales) and project files import/export (`.wproj`).

---

## 🛠️ Architecture & Technology Stack

* **Frontend**: React, TypeScript, Tailwind CSS, Lucide icons, HTML5 canvas overlay.
* **Backend**: Rust, Tauri, `nalgebra` (dense matrix LU solvers), `num-complex` (frequency domain AC circuit calculations).
* **Interprocess Communication**: Tauri invoke commands serializing state between JSON and Rust structs.

---

## 📦 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v18+)
* [Rust](https://www.rust-lang.org/) (stable toolchain)
* Tauri build dependencies (for Linux):
  ```bash
  sudo apt-get install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <repository_url>
   cd winisd
   ```
2. Install frontend node modules:
   ```bash
   npm install
   ```

### Running the App (Development)

Run Tauri in development mode:
```bash
npm run tauri dev
```

### Compiling Backend Tests

Run backend unit tests verifying MNA matrices, passive crossover attenuation slopes, and acoustic formulas:
```bash
cd src-tauri
cargo test
```

### Building for Production

Compile a production-ready standalone executable bundle:
```bash
npm run build
npm run tauri build
```
The compiled binaries will be outputted under `src-tauri/target/release/bundle/`.
