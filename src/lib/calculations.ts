import { EqFilter, RoomConfig, SimPoint } from "../types";

// ── EQ filter frequency response ─────────────────────────────────────────────
export function filterGainDb(flt: EqFilter, f: number): number {
  if (!flt.enabled || f <= 0) return 0;
  const w  = 2 * Math.PI * f;
  const w0 = 2 * Math.PI * Math.max(1, flt.freq);
  const Q  = Math.max(0.1, flt.q);
  const dRe = w0 * w0 - w * w;
  const dIm = w * w0 / Q;

  if (flt.type === "lowshelf") {
    const G = Math.pow(10, flt.gain / 20);
    const t = w / w0;
    return 20 * Math.log10(Math.max(Math.sqrt(G * G + t * t) / Math.sqrt(1 + t * t), 1e-10));
  }
  if (flt.type === "highshelf") {
    const G = Math.pow(10, flt.gain / 20);
    const t = w / w0;
    return 20 * Math.log10(Math.max(Math.sqrt(1 + G * G * t * t) / Math.sqrt(1 + t * t), 1e-10));
  }

  let nRe: number, nIm: number;
  if (flt.type === "hp")   { nRe = -w * w;    nIm = 0; }
  else if (flt.type === "lp") { nRe = w0 * w0; nIm = 0; }
  else { // peak
    const G = Math.pow(10, flt.gain / 20);
    nRe = dRe; nIm = w * G * w0 / Q;
  }

  const dMagSq = dRe * dRe + dIm * dIm;
  if (dMagSq < 1e-30) return 0;
  return 10 * Math.log10(Math.max((nRe * nRe + nIm * nIm) / dMagSq, 1e-20));
}

export function totalFilterGainDb(filters: EqFilter[], f: number): number {
  return filters.filter(flt => flt.enabled).reduce((sum, flt) => sum + filterGainDb(flt, f), 0);
}

// ── Image Source Method room correction ───────────────────────────────────────
// Returns dB correction at each frequency (relative to anechoic at direct-path distance).
export function computeRoomCorrection(cfg: RoomConfig, freqs: number[]): number[] {
  const { length: Lx, width: Ly, height: Lz,
          speakers, listenerX: lx, listenerY: ly, listenerZ: lz, absorption } = cfg;
  if (speakers.length === 0) return freqs.map(() => 0);
  const c = 343.0;
  const r = Math.sqrt(Math.max(0, 1 - absorption));

  // Allen-Berkley image sources up to 2nd order for every speaker.
  // Each speaker's contributions are amplitude-normalised to that speaker's
  // own direct-path distance so that adding a 2nd identical speaker at the
  // same position doubles pressure (+6 dB), matching physical expectation.
  const allSources: { dist: number; refl: number; d0: number }[] = [];
  for (const spk of speakers) {
    const { x: sx, y: sy, z: sz } = spk;
    const d0 = Math.sqrt((lx-sx)**2 + (ly-sy)**2 + (lz-sz)**2);
    if (d0 < 0.01) continue;
    for (let nx = -2; nx <= 2; nx++) {
      for (let ny = -2; ny <= 2; ny++) {
        for (let nz = -2; nz <= 2; nz++) {
          for (const sigX of [-1, 1] as const) {
            for (const sigY of [-1, 1] as const) {
              for (const sigZ of [-1, 1] as const) {
                const rx = sigX === 1 ? 2*Math.abs(nx) : Math.abs(2*nx-1);
                const ry = sigY === 1 ? 2*Math.abs(ny) : Math.abs(2*ny-1);
                const rz = sigZ === 1 ? 2*Math.abs(nz) : Math.abs(2*nz-1);
                if (rx + ry + rz > 2) continue;
                const ix = 2*nx*Lx + sigX*sx;
                const iy = 2*ny*Ly + sigY*sy;
                const iz = 2*nz*Lz + sigZ*sz;
                const d = Math.sqrt((lx-ix)**2 + (ly-iy)**2 + (lz-iz)**2);
                if (d < 0.001) continue;
                allSources.push({ dist: d, refl: rx+ry+rz, d0 });
              }
            }
          }
        }
      }
    }
  }

  return freqs.map(freq => {
    const omega = 2 * Math.PI * freq;
    let hRe = 0, hIm = 0;
    for (const src of allSources) {
      const amp = (src.d0 / src.dist) * Math.pow(r, src.refl);
      const phase = -omega * (src.dist - src.d0) / c;
      hRe += amp * Math.cos(phase);
      hIm += amp * Math.sin(phase);
    }
    return 20 * Math.log10(Math.max(Math.sqrt(hRe*hRe + hIm*hIm), 1e-10));
  });
}

/** Find the lowest frequency where the curve rises through (peak − dropDb).
 *  Returns null if the drop is never reached in the data.  */
export function findLFCrossover(pts: SimPoint[], dropDb: number): number | null {
  if (pts.length < 2) return null;
  const maxDb = Math.max(...pts.map(p => p.db));
  const target = maxDb - dropDb;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i - 1].db < target && pts[i].db >= target) {
      const logF0 = Math.log10(pts[i - 1].frequency);
      const logF1 = Math.log10(pts[i].frequency);
      const t = (target - pts[i - 1].db) / (pts[i].db - pts[i - 1].db);
      return Math.pow(10, logF0 + t * (logF1 - logF0));
    }
  }
  return null;
}

export const RHO_AIR = 1.18; // kg/m³, standard air density
export const SPEED_OF_SOUND = 343.0; // m/s

/** Mechanical compliance implied by Vas and Sd: Cms = Vas / (rho * c² * Sd²), SI units. */
export function cmsFromVasSd(vasLiters: number, sdCm2: number): number {
  const sdM2 = sdCm2 * 1e-4;
  const vasM3 = vasLiters * 1e-3;
  return vasM3 / (RHO_AIR * SPEED_OF_SOUND * SPEED_OF_SOUND * sdM2 * sdM2);
}

/** Moving mass (kg) implied by Fs and Cms: Mms = 1 / (ws² * Cms). */
export function mmsKgFromFsCms(fs: number, cms: number): number {
  const ws = 2.0 * Math.PI * fs;
  return 1.0 / (ws * ws * cms);
}

/** Motor strength Bl (T·m) implied by Fs, moving mass (kg), Re and Qes. */
export function blFromFsMmsQes(fs: number, mmsKg: number, re: number, qes: number): number {
  const ws = 2.0 * Math.PI * fs;
  return Math.sqrt((ws * mmsKg * re) / qes);
}

/** Reference efficiency (eta0) implied by Fs, Vas and Qes; feeds the sensitivity formula. */
export function eta0FromFsVasQes(fs: number, vasLiters: number, qes: number): number {
  const vasM3 = vasLiters * 1e-3;
  return (4.0 * Math.PI * Math.PI / Math.pow(SPEED_OF_SOUND, 3)) * (Math.pow(fs, 3) * vasM3) / qes;
}
