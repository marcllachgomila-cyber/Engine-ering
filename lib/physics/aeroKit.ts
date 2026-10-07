import { AeroKitConfig, BodyType, RearWing } from "./types";

// Bolt-on aero and ride height for a custom road car, as increments on the
// body type's representative coefficients (defaults.ts).
//
// The parts (wing, splitter, diffuser) are sized as force areas - added
// Cd*A and Cl*A in m^2 - not as coefficients: a given wing makes a given
// force at a given speed whatever it's bolted to, so it mustn't make more
// downforce on a minivan just because the minivan's frontal area is
// bigger. They're converted to coefficient increments on each car's own
// frontal area, which itself is left unchanged (a wing or splitter adds
// little projected area next to the body). Ride height acts on the body
// itself, so its effect is a coefficient change.
//
// The sizes are representative estimates in the typical range reported
// for production-car add-ons in the vehicle-aerodynamics literature - not
// measurements for any car, and the same caveat as the base coefficients
// applies. What they're built to get right is the *trade-off* each part
// makes:
//
// - A rear wing buys downforce with drag. A low-angle wing/spoiler works
//   at a lift-to-drag ratio around 5; a high-angle wing makes three times
//   the downforce but less efficiently (L/D ~4.5), so drag climbs faster.
// - A front splitter adds front downforce for very little drag.
// - A flat floor with a diffuser both reduces drag (smooth underbody) and
//   makes downforce, and that downforce grows as the car gets closer to
//   the ground (ground effect).
// - Lowering the body reduces drag and lift a little (less air under the
//   car); raising it does the opposite. It also moves the centre of
//   gravity by the same amount, which the weight-transfer model uses.
//
// Not modelled: the parts' mass, front/rear downforce balance (the data
// has none), and ground-effect stall at very low ride heights - the ride
// height range is limited to stay clear of it.

export const STOCK_AERO_KIT: AeroKitConfig = {
  rideHeightOffsetMm: 0,
  rearWing: "none",
  frontSplitter: false,
  underbody: "standard",
};

export const RIDE_HEIGHT_OFFSET_MIN_MM = -40;
export const RIDE_HEIGHT_OFFSET_MAX_MM = 40;

// An F1 car's aero is its whole regulated package (and its coefficients
// already include wings and floor), so the kit is road cars only.
export function aeroKitAvailable(bodyType: BodyType): boolean {
  return bodyType !== "f1";
}

// Added force areas (m^2). On a 1.95 m^2 supercar these are coefficient
// increments of +0.03/+0.15 (low wing), +0.10/+0.45 (high wing),
// +0.01/+0.12 (splitter) and -0.02/+0.15 (diffuser).
const REAR_WING: Record<RearWing, { dCdA: number; dClA: number }> = {
  none: { dCdA: 0, dClA: 0 },
  low: { dCdA: 0.06, dClA: 0.3 },
  high: { dCdA: 0.2, dClA: 0.9 },
};
const FRONT_SPLITTER = { dCdA: 0.02, dClA: 0.24 };
const DIFFUSER = { dCdA: -0.04, dClA: 0.3 };
// Diffuser downforce gain per mm the body is lowered (and loss per mm
// raised), clamped so it can't go negative or run away.
const DIFFUSER_GAIN_PER_MM = 0.006;
// Body-only ride-height sensitivity, per mm of offset (+ = raised).
const RIDE_HEIGHT_DCD_PER_MM = 0.0004;
const RIDE_HEIGHT_DCL_PER_MM = -0.001;
// Keeps an extreme combination physically sensible.
const MIN_DRAG_COEFFICIENT = 0.15;

export interface AeroContribution {
  label: string;
  dCd: number;
  dCl: number;
  // One line on why this part moves the numbers the way it does.
  reason: string;
}

// The kit's effect broken down part by part, as coefficient increments on
// a car of the given frontal area, for showing the working.
export function aeroKitContributions(kit: AeroKitConfig, frontalAreaM2: number): AeroContribution[] {
  const perArea = (p: { dCdA: number; dClA: number }) => ({ dCd: p.dCdA / frontalAreaM2, dCl: p.dClA / frontalAreaM2 });
  const out: AeroContribution[] = [];
  const offset = kit.rideHeightOffsetMm;
  if (offset !== 0) {
    out.push({
      label: `Ride height ${offset > 0 ? "+" : ""}${offset} mm`,
      dCd: RIDE_HEIGHT_DCD_PER_MM * offset,
      dCl: RIDE_HEIGHT_DCL_PER_MM * offset,
      reason: offset < 0 ? "less air forced under the car" : "more air forced under the car",
    });
  }
  if (kit.rearWing !== "none") {
    const w = REAR_WING[kit.rearWing];
    out.push({
      label: `Rear wing (${kit.rearWing})`,
      ...perArea(w),
      reason: kit.rearWing === "high" ? "high angle: 3x the downforce at a worse L/D" : "low angle: efficient downforce, L/D ~5",
    });
  }
  if (kit.frontSplitter) {
    out.push({ label: "Front splitter", ...perArea(FRONT_SPLITTER), reason: "front downforce for little drag" });
  }
  if (kit.underbody === "diffuser") {
    const heightFactor = Math.min(1.5, Math.max(0.5, 1 - DIFFUSER_GAIN_PER_MM * offset));
    out.push({
      label: "Flat floor + diffuser",
      dCd: DIFFUSER.dCdA / frontalAreaM2,
      dCl: (DIFFUSER.dClA * heightFactor) / frontalAreaM2,
      reason:
        offset === 0
          ? "smooth underbody cuts drag; diffuser adds downforce"
          : `smooth underbody cuts drag; diffuser downforce x${heightFactor.toFixed(2)} at this ride height`,
    });
  }
  return out;
}

export interface AeroWithKit {
  dragCoefficient: number;
  liftCoefficient: number;
  frontalAreaM2: number;
  cgHeightM: number;
  contributions: AeroContribution[];
}

// The body type's coefficients with the kit applied. With no kit (or the
// stock kit) every value comes back exactly as given.
export function applyAeroKit(
  base: { dragCoefficient: number; liftCoefficient: number; frontalAreaM2: number; cgHeightM: number },
  kit: AeroKitConfig | undefined,
): AeroWithKit {
  if (!kit) return { ...base, contributions: [] };
  const contributions = aeroKitContributions(kit, base.frontalAreaM2);
  const dCd = contributions.reduce((s, c) => s + c.dCd, 0);
  const dCl = contributions.reduce((s, c) => s + c.dCl, 0);
  return {
    dragCoefficient: Math.max(MIN_DRAG_COEFFICIENT, base.dragCoefficient + dCd),
    liftCoefficient: base.liftCoefficient + dCl,
    frontalAreaM2: base.frontalAreaM2,
    cgHeightM: base.cgHeightM + kit.rideHeightOffsetMm / 1000,
    contributions,
  };
}
