import { Vec2 } from "./panelMethod";

// A body side profile for the 2D flow model: the closed outline above a
// ground plane at y = 0, plus the points where the flow is assumed to
// separate from it. The freestream runs along +x, so the nose faces -x
// (upstream) - the mirror image of the 3D viewer's nose-forward +x.
export interface BodyOutline {
  name: string;
  polygon: Vec2[];
  lengthM: number;
  heightM: number;
  rideHeightM: number;
  // Upper and lower separation points at the tail, where the wake starts.
  separationTop: Vec2;
  separationBottom: Vec2;
}

// Phase-7 reference silhouette: a generic three-box saloon, 4.6 m long and
// 1.45 m tall with 0.15 m ground clearance, square-backed so the flow
// leaves it at the tail's two sharp edges. A fixed shape - the vehicle's
// own outline replaces it once the flow is connected to the configuration.
// Profile as (u, v): u nose (0) to tail (1), v height above the floor as a
// fraction of the body's height above its ride height.
const REFERENCE_PROFILE: [number, number][] = [
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
];

// Potential flow is singular at a sharp convex corner: a polygon vertex
// where the roof breaks into the rear window would show a local speed spike
// that a real (curved) roof doesn't have. The upper outline is therefore
// smoothed with a Catmull-Rom spline through the profile points. Its two
// ends stay where they are, so the nose and the tail's sharp edges - where
// the flow is meant to separate - are untouched.
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

export function profileOutline(
  name: string,
  profile: [number, number][],
  lengthM: number,
  heightM: number,
  rideHeightM: number,
): BodyOutline {
  const bodyH = heightM - rideHeightM;
  // Nose at x = -L/2 so the freestream (along +x) meets it first.
  const toPoint = ([u, v]: [number, number]): Vec2 => ({ x: -lengthM / 2 + u * lengthM, y: rideHeightM + v * bodyH });
  const upper = smoothCurve(profile.map(toPoint));
  const tailTop = upper[upper.length - 1];
  // Counter-clockwise: along the floor nose to tail, up the base, then back
  // over the top from tail to nose.
  const polygon: Vec2[] = [
    { x: -lengthM / 2, y: rideHeightM },
    { x: lengthM / 2, y: rideHeightM },
    ...[...upper].reverse(),
  ];
  return {
    name,
    polygon,
    lengthM,
    heightM,
    rideHeightM,
    separationTop: tailTop,
    separationBottom: { x: lengthM / 2, y: rideHeightM },
  };
}

export const REFERENCE_BODY: BodyOutline = profileOutline("Reference saloon", REFERENCE_PROFILE, 4.6, 1.45, 0.15);
