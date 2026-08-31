import { Project } from "../types";
import { portDisplacementLitres } from "./portGeometry";

/**
 * What occupies a cabinet, and the gross volume needed to enclose a given net one.
 *
 * `vBox` throughout the app is the *net* acoustic volume — the air the cone actually
 * compresses. That is what the solver turns into the enclosure's compliance, so it is
 * the figure alignments and tunings are computed from. The volume you have to build is
 * larger, by whatever the drivers, radiator and ducts take up.
 */

/**
 * Volume a driver's cone and motor take out of the box, in litres.
 *
 * A rough geometric estimate: manufacturers who publish a displacement figure give a
 * smaller number than this, so treat it as an upper bound rather than a specification.
 */
export function driverDisplacementLitres(project: Project): number {
  const sdM2 = (project.driver.sd || 0) * 1e-4;
  if (sdM2 <= 0) return 0;
  const coneRadiusM = Math.sqrt(sdM2 / Math.PI);
  const drivers = Math.max(1, project.numDrivers);
  // An isobaric pair puts a second driver inside the same cabinet.
  const bodies = project.driverConfig === "standard" ? drivers : drivers * 2;
  return bodies * sdM2 * (coneRadiusM * 0.8) * 1000;
}

/** The same for a passive radiator, which occupies the box just as a driver does. */
export function radiatorDisplacementLitres(project: Project): number {
  if (project.enclosureType !== "passive_radiator") return 0;
  const sdM2 = (project.prSd || 0) * 1e-4;
  if (sdM2 <= 0) return 0;
  const radiusM = Math.sqrt(sdM2 / Math.PI);
  // No motor behind it, so it intrudes less than a driver of the same area.
  return Math.max(1, project.numDrivers) * sdM2 * (radiusM * 0.4) * 1000;
}

/** Everything taking up room inside the cabinet, in litres. */
export function occupiedVolumeLitres(project: Project): number {
  return (
    driverDisplacementLitres(project) +
    radiatorDisplacementLitres(project) +
    portDisplacementLitres(project)
  );
}

/**
 * Interior volume the cabinet must enclose to leave `vBox` of air behind the cone.
 *
 * This is the number to build to; `vBox` is the number to simulate with.
 */
export function grossVolumeLitres(project: Project): number {
  return project.vBox + occupiedVolumeLitres(project);
}
