import { BodyDimensions, BodyType } from "./types";

// The shape of each body type: what the 3D viewer extrudes and what the 2D
// wind tunnel flows air around, defined once so the two can't disagree.
// Everything here is a representative shape for the class, not any
// manufacturer's surfaces. Coordinates are metres with +x toward the nose
// and y up from the ground, the body centred on x = 0.

// A side profile as (u, v) pairs: u runs nose (0) to tail (1) along the
// body length, v is the height above the floor as a fraction of the body's
// height above its ride height.
export type Profile = [number, number][];

export function sampleProfile(profile: Profile, u: number): number {
  for (let i = 1; i < profile.length; i++) {
    const [u0, v0] = profile[i - 1];
    const [u1, v1] = profile[i];
    if (u <= u1 && u1 > u0) return v0 + ((u - u0) / (u1 - u0)) * (v1 - v0);
  }
  return profile[profile.length - 1][1];
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Piecewise-linear lookup through sorted (x, value) knots.
export function lerpKnots(knots: [number, number][], x: number): number {
  if (x <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    const [x0, y0] = knots[i - 1];
    const [x1, y1] = knots[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return knots[knots.length - 1][1];
}

// Generic closed-bodywork car: a full-width lower body (bonnet, flanks,
// boot/deck) plus a narrower glasshouse on top.
export interface ClosedBodySpec {
  // Upper outline of the lower body, nose to tail (see Profile).
  lowerProfile: Profile;
  // The glasshouse as a closed polygon in the same (u, v) space: every
  // point but the last traces its top edge front to rear (windscreen base,
  // roof, rear glass), and the last is its rear base.
  cabin: Profile;
  // Cabin width at its base, as a fraction of body width, and how much
  // narrower it gets by the roof (tumblehome).
  cabinWidthFraction: number;
  tumblehome: number;
  // Plan-view narrowing at the very nose and tail, as a fraction of width.
  noseTaper: number;
  tailTaper: number;
}

// One-box: short bonnet, steep windscreen running straight into a long
// flat roof and a near-vertical tailgate.
export const MINIVAN_SPEC: ClosedBodySpec = {
  lowerProfile: [[0, 0.25], [0.02, 0.42], [0.1, 0.5], [0.2, 0.53], [0.97, 0.56], [1, 0.5]],
  cabin: [[0.12, 0.49], [0.32, 1], [0.95, 0.985], [0.995, 0.62], [0.995, 0.49]],
  cabinWidthFraction: 0.93,
  tumblehome: 0.1,
  noseTaper: 0.08,
  tailTaper: 0.03,
};

// Two-box: tall upright nose and bonnet, high beltline, square tail.
export const SUV_SPEC: ClosedBodySpec = {
  lowerProfile: [[0, 0.3], [0.02, 0.48], [0.2, 0.56], [0.28, 0.58], [0.97, 0.6], [1, 0.52]],
  cabin: [[0.27, 0.55], [0.42, 1], [0.92, 0.98], [0.985, 0.64], [0.985, 0.55]],
  cabinWidthFraction: 0.9,
  tumblehome: 0.12,
  noseTaper: 0.08,
  tailTaper: 0.04,
};

// Mid-engine wedge: low pointed nose, cab-forward canopy, engine deck
// behind the cabin over the rear axle.
export const SUPERCAR_SPEC: ClosedBodySpec = {
  lowerProfile: [[0, 0.3], [0.02, 0.4], [0.12, 0.45], [0.3, 0.52], [0.85, 0.58], [0.96, 0.56], [1, 0.42]],
  cabin: [[0.28, 0.48], [0.45, 1], [0.6, 0.99], [0.86, 0.58], [0.86, 0.48]],
  cabinWidthFraction: 0.8,
  tumblehome: 0.18,
  noseTaper: 0.15,
  tailTaper: 0.06,
};

export type BodyShape = { kind: "closed"; spec: ClosedBodySpec } | { kind: "openWheel" };

// Typed as a Record so a new body type fails to compile until it has one.
export const BODY_SHAPES: Record<BodyType, BodyShape> = {
  minivan: { kind: "closed", spec: MINIVAN_SPEC },
  suv: { kind: "closed", spec: SUV_SPEC },
  supercar: { kind: "closed", spec: SUPERCAR_SPEC },
  f1: { kind: "openWheel" },
};

// The upper side-on outline of a closed body - the higher of the lower
// body and the cabin at each station - as (u, v) pairs nose to tail. This
// is the silhouette the 2D flow sees: the cabin's narrower width doesn't
// exist in a 2D section.
export function closedBodySilhouette(spec: ClosedBodySpec, samples = 50): Profile {
  const cabinTop = spec.cabin.slice(0, -1);
  const cabinStart = cabinTop[0][0];
  const cabinEnd = cabinTop[cabinTop.length - 1][0];
  const silhouette: Profile = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const lower = sampleProfile(spec.lowerProfile, u);
    const cabin = u >= cabinStart && u <= cabinEnd ? sampleProfile(cabinTop, u) : 0;
    silhouette.push([u, Math.max(lower, cabin)]);
  }
  return silhouette;
}

// The lower body's plan-view width at x, as a fraction of the full width:
// it narrows over the last stretch of the nose and tail.
export function closedBodyPlanTaper(spec: ClosedBodySpec, lengthM: number, x: number): number {
  const halfL = lengthM / 2;
  return (
    1 -
    spec.noseTaper * smoothstep(halfL - 0.12 * lengthM, halfL, x) -
    spec.tailTaper * smoothstep(-halfL + 0.08 * lengthM, -halfL, x)
  );
}

// --- Axles ------------------------------------------------------------------

// Where each body style's axles sit along its length. The physics only
// knows the wheelbase, so how the remaining length splits into front and
// rear overhang is a visual-only, representative figure per body style:
// mid-engined cars and F1 cars carry more ahead of the front axle than
// front-engined boxes, which hang more out the back.
const FRONT_OVERHANG_SHARE: Record<BodyType, number> = {
  minivan: 0.44,
  suv: 0.43,
  supercar: 0.52,
  f1: 0.55,
};

export interface AxleLayout {
  frontX: number;
  rearX: number;
}

export function axleLayout(dimensions: BodyDimensions & { wheelbaseM: number }, bodyType: BodyType): AxleLayout {
  const { lengthM, wheelbaseM } = dimensions;
  const overhangM = Math.max(0, lengthM - wheelbaseM);
  const frontX = lengthM / 2 - overhangM * FRONT_OVERHANG_SHARE[bodyType];
  return { frontX, rearX: frontX - wheelbaseM };
}

// --- Open-wheel spine -------------------------------------------------------

// Key stations along a single-seater, from its axles and length.
export function openWheelStations(lengthM: number, axles: AxleLayout) {
  const { frontX, rearX } = axles;
  return {
    noseTipX: lengthM / 2 - 0.15,
    cockpitFrontX: frontX - 0.55,
    rollHoopX: frontX - 1.25,
    sidepodFrontX: frontX - 0.95,
    sidepodRearX: rearX + 0.45,
    gearboxEndX: rearX - 0.3,
  };
}

export const OPEN_WHEEL_SPINE_MAX_WIDTH_M = 0.9;
export const OPEN_WHEEL_SIDEPOD_MAX_WIDTH_M = 1.45;

// Plan-view full widths as sorted (x, width) knots: the spine narrowing
// from the tub to the slim nose and down to the gearbox, and the sidepods
// tapering toward the rear ("coke bottle").
export function openWheelPlanKnots(
  lengthM: number,
  axles: AxleLayout,
): { spine: [number, number][]; sidepod: [number, number][] } {
  const { frontX, rearX } = axles;
  const { noseTipX, cockpitFrontX, rollHoopX, sidepodFrontX, sidepodRearX, gearboxEndX } = openWheelStations(
    lengthM,
    axles,
  );
  return {
    spine: [
      [gearboxEndX, 0.3],
      [rearX + 0.6, 0.45],
      [rollHoopX - 0.2, 0.55],
      [rollHoopX + 0.1, 0.85],
      [cockpitFrontX, 0.85],
      [frontX, 0.42],
      [noseTipX, 0.22],
    ],
    sidepod: [
      [sidepodRearX, 0.55],
      [sidepodRearX + 0.6, 0.9],
      [sidepodFrontX - 0.5, OPEN_WHEEL_SIDEPOD_MAX_WIDTH_M],
      [sidepodFrontX, 1.35],
    ],
  };
}

// The nose, monocoque, airbox and engine cover on the car's centreline, as
// upper and lower outlines from the nose tip to the gearbox, each (x, y).
export function openWheelSpineChains(
  lengthM: number,
  heightM: number,
  axles: AxleLayout,
): { upper: [number, number][]; lower: [number, number][] } {
  const { frontX, rearX } = axles;
  const { noseTipX, cockpitFrontX, rollHoopX, gearboxEndX } = openWheelStations(lengthM, axles);
  return {
    upper: [
      [noseTipX, 0.2],
      [frontX, 0.42],
      [cockpitFrontX, 0.58],
      [rollHoopX + 0.1, 0.62],
      [rollHoopX - 0.05, heightM],
      [rollHoopX - 0.35, heightM - 0.05],
      [rearX + 0.6, 0.5],
      [gearboxEndX, 0.38],
    ],
    lower: [
      [noseTipX, 0.14],
      [frontX + 0.2, 0.12],
      [frontX - 0.3, 0.08],
      [rearX + 0.4, 0.08],
      [gearboxEndX, 0.18],
    ],
  };
}
