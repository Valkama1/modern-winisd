import { Project } from "../types";
import { SPEED_OF_SOUND } from "./calculations";

/**
 * Port geometry, kept in one place because the solver, the sidebar readout and the
 * net-volume stat all need the same numbers.
 *
 * These mirror `derive_port_length_m` in src-tauri/src/circuit.rs. When the two
 * disagree the app shows a tuning it is not simulating, which has happened twice: the
 * floors were once 1 cm in Rust against 0.1 cm here, and the slot branch of
 * auto_calculate_port used a different end correction.
 */

/** Unflanged single-end correction applied to the physical duct length. */
export const END_CORRECTION = 0.732;

/** Shortest duct the solver will model, in metres. Mirrors circuit.rs. */
export const MIN_PORT_LENGTH_M = 0.01;

/** Cross-sectional area of one port, in m². */
export function portAreaM2(
  shape: string,
  diameterCm: number,
  widthCm: number,
  heightCm: number,
): number {
  if (shape === "rectangular") {
    return Math.max(widthCm * 0.01 * heightCm * 0.01, 1e-6);
  }
  const r = (diameterCm / 2) * 0.01;
  return Math.max(Math.PI * r * r, 1e-6);
}

/**
 * Total vent area a box breathes through, in m² — every port in group 1 plus group 2
 * when it is enabled.
 *
 * Tuning is set by the *combined* area, so anything deriving a length has to use this
 * rather than a single port's area.
 */
export function totalPortAreaM2(project: Project): number {
  const count = Math.max(1, project.portCount);
  let area =
    count *
    portAreaM2(project.portShape, project.portDiameter, project.portWidth, project.portHeight);

  if (project.port2Enabled) {
    const count2 = Math.max(1, project.port2Count);
    area +=
      count2 *
      portAreaM2(
        project.port2Shape,
        project.port2Diameter,
        project.port2Width,
        project.port2Height,
      );
  }
  return area;
}

/**
 * Physical duct length for a Helmholtz tuning, in metres.
 *
 * Byte-for-byte the same rule as the solver, including the 0.15 m fallback for
 * unusable inputs and the 1 cm floor.
 */
export function portLengthM(areaM2: number, tuningHz: number, volumeM3: number): number {
  if (tuningHz <= 0 || areaM2 <= 0 || volumeM3 <= 0) return 0.15;
  const rEq = Math.sqrt(areaM2 / Math.PI);
  const c = SPEED_OF_SOUND;
  const l =
    (c * c * areaM2) / (4 * Math.PI * Math.PI * tuningHz * tuningHz * volumeM3) -
    END_CORRECTION * rEq;
  return Math.max(MIN_PORT_LENGTH_M, l);
}

/**
 * Duct length for a project's current vent, in cm.
 *
 * `clamped` means the vent is too large for this box at this tuning — its end
 * correction alone already overshoots Fb, so the simulated tuning is higher than Fb.
 * `lengthCm` is zero when the project has nothing to compute from.
 */
export function projectPortLength(project: Project): { lengthCm: number; clamped: boolean } {
  const num = project.numDrivers > 0 ? project.numDrivers : 1;
  const volumeM3 = (project.vBox / num) * 1e-3;
  const area = totalPortAreaM2(project);

  if (area <= 0 || project.tuningFreq <= 0 || volumeM3 <= 0) {
    return { lengthCm: 0, clamped: false };
  }
  const length = portLengthM(area, project.tuningFreq, volumeM3);
  return { lengthCm: length * 100, clamped: length <= MIN_PORT_LENGTH_M };
}

/** Volume the ducts themselves displace inside the cabinet, in litres. */
export function portDisplacementLitres(project: Project): number {
  const num = project.numDrivers > 0 ? project.numDrivers : 1;
  const volumeM3 = (project.vBox / num) * 1e-3;
  const area = totalPortAreaM2(project);
  if (area <= 0 || project.tuningFreq <= 0 || volumeM3 <= 0) return 0;
  // One length shared by every duct, as the solver assumes.
  return num * area * portLengthM(area, project.tuningFreq, volumeM3) * 1000;
}
