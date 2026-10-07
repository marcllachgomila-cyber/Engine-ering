import { axleLayout, BODY_SHAPES, closedBodySilhouette, openWheelSpineChains } from "../physics/bodyShapes";
import { VehicleState } from "../physics/vehicleState";
import { Vec2 } from "./panelMethod";

// The 2D section the wind tunnel flows air around: a closed outline above a
// ground plane at y = 0, plus where the flow is assumed to leave it. The
// freestream runs along +x, so the nose faces -x (upstream) - the mirror
// image of the 3D viewer's nose-forward +x.

// --- Separation model ---------------------------------------------------------
//
// Potential flow never separates, so where the flow leaves the body is
// decided from the geometry, using the best-known result for a car's rear:
// the slanted-back (Ahmed) body. Below a slant of about 30 degrees the flow
// stays attached down the slope; above it, the flow separates at the top of
// the slope - the roof's trailing edge - and the whole slope sits in the
// wake. (The real switch is a 3D effect involving trailing vortices and
// isn't perfectly sharp; a single threshold is the simplification.)
// Either way the flow also leaves at the tail's sharp base edges.
export const CRITICAL_REAR_SLANT_DEG = 30;
// Surface sloping down more steeply than this behind the crest counts as
// part of the rear slope; the roof and deck either side of it don't.
const SLANT_DETECT_DEG = 10;

export interface RearSlope {
  angleDeg: number;
  // Top (roof trailing edge) and bottom of the slope.
  start: Vec2;
  end: Vec2;
}

export interface BodyOutline {
  // Identifies the shape for caching the (expensive) flow solution.
  key: string;
  name: string;
  // What the outline represents: the side silhouette of a closed body, or
  // the centreline section of an open-wheeler.
  section: "silhouette" | "centreline";
  polygon: Vec2[];
  lengthM: number;
  heightM: number;
  rideHeightM: number;
  // Top of the tail's base, and the underbody's trailing edge.
  tailTop: Vec2;
  separationBottom: Vec2;
  // Where the upper flow leaves the body: the roof's trailing edge if the
  // rear slope is past the critical angle, otherwise the tail top.
  separationTop: Vec2;
  rearSlope: RearSlope | null;
  separatesAtRoof: boolean;
}

// Even arc-length spacing for the outline's points: the panel method wants
// panels of similar size, and a dense input (a sampled spline) would
// otherwise mean hundreds of tiny panels and a slow solve.
const OUTLINE_SPACING_M = 0.08;

function resampleCurve(points: Vec2[], spacingM: number): Vec2[] {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = cumulative[cumulative.length - 1];
  const count = Math.max(2, Math.round(total / spacingM) + 1);
  const out: Vec2[] = [];
  let seg = 1;
  for (let k = 0; k < count; k++) {
    const s = (total * k) / (count - 1);
    while (seg < points.length - 1 && cumulative[seg] < s) seg++;
    const span = cumulative[seg] - cumulative[seg - 1] || 1;
    const t = (s - cumulative[seg - 1]) / span;
    out.push({
      x: points[seg - 1].x + (points[seg].x - points[seg - 1].x) * t,
      y: points[seg - 1].y + (points[seg].y - points[seg - 1].y) * t,
    });
  }
  return out;
}

// Potential flow is singular at a sharp convex corner, so a polygon vertex
// where a roof breaks into a rear window would show a local speed spike a
// real (curved) roof doesn't have. Coarse outlines are therefore smoothed
// with a Catmull-Rom spline; the two ends stay put, so the nose and the
// tail's sharp edges are untouched.
const SPLINE_SAMPLES_PER_SEGMENT = 8;

function smoothCurve(points: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < SPLINE_SAMPLES_PER_SEGMENT; s++) {
      const t = s / SPLINE_SAMPLES_PER_SEGMENT;
      const t2 = t * t;
      const t3 = t2 * t;
      const blend = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

// A light 3-point average for already-dense outlines (a sampled envelope),
// rounding off its kinks without moving the ends.
function relax(points: Vec2[], passes: number): Vec2[] {
  let current = points;
  for (let p = 0; p < passes; p++) {
    current = current.map((pt, i) =>
      i === 0 || i === current.length - 1
        ? pt
        : { x: pt.x, y: 0.25 * current[i - 1].y + 0.5 * pt.y + 0.25 * current[i + 1].y },
    );
  }
  return current;
}

// Passes of the 3-point average over a sampled closed-body silhouette:
// enough to round its windscreen and roof edges to a believable radius
// (~0.2 m), not so many that the rear slope stops reading as a slope.
const SILHOUETTE_RELAX_PASSES = 4;

// The rear slope: behind the highest point of the upper outline, the first
// stretch steeper than SLANT_DETECT_DEG, measured top to bottom.
export function findRearSlope(upper: Vec2[]): RearSlope | null {
  let crest = 0;
  upper.forEach((p, i) => {
    if (p.y > upper[crest].y) crest = i;
  });
  const downslopeDeg = (i: number) =>
    (Math.atan2(upper[i].y - upper[i + 1].y, upper[i + 1].x - upper[i].x) * 180) / Math.PI;
  let start = -1;
  for (let i = crest; i < upper.length - 1; i++) {
    if (downslopeDeg(i) > SLANT_DETECT_DEG) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  let end = upper.length - 1;
  for (let i = start + 1; i < upper.length - 1; i++) {
    if (downslopeDeg(i) < SLANT_DETECT_DEG) {
      end = i;
      break;
    }
  }
  // The slope's angle is the median over its (evenly spaced) segments, so
  // the rounded transitions at its top and bottom don't drag it down the
  // way a straight end-to-end average would.
  const angles: number[] = [];
  for (let i = start; i < end; i++) angles.push(downslopeDeg(i));
  angles.sort((x, y) => x - y);
  const mid = angles.length >> 1;
  const angleDeg = angles.length % 2 ? angles[mid] : (angles[mid - 1] + angles[mid]) / 2;
  return { angleDeg, start: upper[start], end: upper[end] };
}

// Builds the outline from its upper and lower edges, each nose to tail.
function outlineFromChains(
  key: string,
  name: string,
  section: BodyOutline["section"],
  upperRaw: Vec2[],
  lower: Vec2[],
  dims: { lengthM: number; heightM: number; rideHeightM: number },
): BodyOutline {
  const upper = resampleCurve(upperRaw, OUTLINE_SPACING_M);
  const rearSlope = findRearSlope(upper);
  const separatesAtRoof = !!rearSlope && rearSlope.angleDeg > CRITICAL_REAR_SLANT_DEG;
  const tailTop = upper[upper.length - 1];
  return {
    key,
    name,
    section,
    // Counter-clockwise: along the bottom nose to tail, up the base, then
    // back over the top from tail to nose.
    polygon: [...lower, ...[...upper].reverse()],
    ...dims,
    tailTop,
    separationBottom: lower[lower.length - 1],
    separationTop: separatesAtRoof && rearSlope ? rearSlope.start : tailTop,
    rearSlope,
    separatesAtRoof,
  };
}

// From a coarse (u, v) profile - see lib/physics/bodyShapes.ts.
export function profileOutline(
  name: string,
  profile: [number, number][],
  lengthM: number,
  heightM: number,
  rideHeightM: number,
): BodyOutline {
  const bodyH = heightM - rideHeightM;
  const upper = smoothCurve(profile.map(([u, v]) => ({ x: -lengthM / 2 + u * lengthM, y: rideHeightM + v * bodyH })));
  const lower = [
    { x: -lengthM / 2, y: rideHeightM },
    { x: lengthM / 2, y: rideHeightM },
  ];
  return outlineFromChains(`profile:${name}`, name, "silhouette", upper, lower, { lengthM, heightM, rideHeightM });
}

// The selected vehicle's own section: the side silhouette (body and cabin
// together) for closed bodies, the centreline section for an open-wheeler.
// Wheels aren't part of either - the section is through the body.
export function vehicleBodyOutline(vehicle: VehicleState): BodyOutline {
  const { bodyType, displayName } = vehicle.identity;
  const { lengthM, heightM, rideHeightM } = vehicle.dimensions;
  const shape = BODY_SHAPES[bodyType];
  const key = `${bodyType}:${lengthM}:${heightM}:${rideHeightM}:${vehicle.dimensions.wheelbaseM}`;
  const dims = { lengthM, heightM, rideHeightM };

  if (shape.kind === "closed") {
    const bodyH = heightM - rideHeightM;
    const upper = relax(
      closedBodySilhouette(shape.spec).map(([u, v]) => ({ x: -lengthM / 2 + u * lengthM, y: rideHeightM + v * bodyH })),
      SILHOUETTE_RELAX_PASSES,
    );
    const lower = [
      { x: -lengthM / 2, y: rideHeightM },
      { x: lengthM / 2, y: rideHeightM },
    ];
    return outlineFromChains(key, displayName, "silhouette", upper, lower, dims);
  }

  // Open-wheeler: the same spine the 3D model extrudes, mirrored so the
  // nose faces upstream.
  const chains = openWheelSpineChains(lengthM, heightM, axleLayout(vehicle.dimensions, bodyType));
  const toFlow = ([x, y]: [number, number]): Vec2 => ({ x: -x, y });
  const upper = smoothCurve(chains.upper.map(toFlow));
  const lower = chains.lower.map(toFlow);
  return outlineFromChains(key, displayName, "centreline", upper, lower, {
    ...dims,
    rideHeightM: Math.min(...lower.map((p) => p.y)),
  });
}

// A fixed generic three-box saloon (4.6 m long, 1.45 m tall, 0.15 m ground
// clearance, square-backed). Not shown in the app any more - kept as the
// flow checks' regression body (scripts/flow-check.ts).
export const REFERENCE_BODY: BodyOutline = profileOutline(
  "Reference saloon",
  [
    [0, 0.25],
    [0.015, 0.4],
    [0.07, 0.48],
    [0.3, 0.55],
    [0.45, 0.94],
    [0.55, 1],
    [0.7, 0.97],
    [0.84, 0.64],
    [0.98, 0.6],
    [1, 0.55],
  ],
  4.6,
  1.45,
  0.15,
);
