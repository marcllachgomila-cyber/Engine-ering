import { CircuitPoint } from "./types";

// Turns a circuit's real centerline - a dense, ordered polyline of
// [longitude, latitude] points downloaded from OpenStreetMap (see
// lib/physics/circuitData/*.json and the README notes there on how that
// data was produced) - into a physics-ready lap: even arc-length samples
// with distance, heading and curvature all *derived from the geometry*,
// exactly like the previous stylized-waypoint version, just fed by real
// survey data instead of a hand-drawn sketch.

type Vec = { x: number; y: number };

// Equirectangular projection centered on the circuit's own centroid. Real
// circuits span at most a few kilometres, so the flat-earth approximation
// this makes is accurate to well under a metre - far below the resolution
// that matters for lap physics.
//
// The result is then rotated so every circuit's *shape as a whole* reads as
// landscape (wide, not tall) - regardless of which way the start/finish
// line happens to face in real life - rather than true-north-up, which
// would otherwise point each track map in whatever direction it was
// surveyed in. `circuitId` optionally selects a per-circuit adjustment (see
// ORIENTATION_OVERRIDE_DEG below) to match the layout each circuit is
// conventionally drawn in (e.g. the F1 calendar's circuit maps): the
// landscape-fit alone only pins the track down to within a 180-degree turn
// (and, for a roughly symmetric outline like Monza's, sometimes a 90-degree
// one too), with no way to prefer the conventional option on its own.
function projectToLocalMeters(lonLat: number[][], circuitId?: string): Vec[] {
  const EARTH_RADIUS_M = 6371000;
  const lat0 =
    (lonLat.reduce((sum, [, lat]) => sum + lat, 0) / lonLat.length) * (Math.PI / 180);
  const lon0 = lonLat.reduce((sum, [lon]) => sum + lon, 0) / lonLat.length;
  const pts = lonLat.map(([lon, lat]) => ({
    x: ((lon - lon0) * Math.PI) / 180 * EARTH_RADIUS_M * Math.cos(lat0),
    y: ((lat - lat0) * Math.PI) / 180 * EARTH_RADIUS_M,
  }));
  let angle = landscapeOrientationAngle(pts);
  const overrideDeg = circuitId ? ORIENTATION_OVERRIDE_DEG[circuitId] : undefined;
  if (overrideDeg) angle += (overrideDeg * Math.PI) / 180;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  return pts.map((p) => ({
    x: p.x * cosA - p.y * sinA,
    y: p.x * sinA + p.y * cosA,
  }));
}

// Circuits whose landscape-fit orientation (see landscapeOrientationAngle)
// doesn't match how they're conventionally drawn (e.g. on the official F1
// calendar's circuit maps), checked against those references by eye, and
// the extra rotation (degrees, added on top of the landscape fit) that
// corrects it. Only ever a pure rotation here - never a mirror - since
// mirroring would reverse the circuit's real CW/CCW racing direction.
const ORIENTATION_OVERRIDE_DEG: Record<string, number> = {
  lusail: 180,
  cota: 180,
};

// Convex hull of a 2D point set via Andrew's monotone chain, O(n log n).
function convexHull(pts: Vec[]): Vec[] {
  const sorted = [...pts].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: Vec, a: Vec, b: Vec) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const buildHalf = (points: Vec[]) => {
    const half: Vec[] = [];
    for (const p of points) {
      while (half.length >= 2 && cross(half[half.length - 2], half[half.length - 1], p) <= 0) {
        half.pop();
      }
      half.push(p);
    }
    return half;
  };
  const lower = buildHalf(sorted);
  const upper = buildHalf([...sorted].reverse());
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// The rotation (radians) that lays the track's own shape out as landscape
// (as wide as possible relative to its height) - via rotating calipers over
// the convex hull: for every hull edge direction, measure the axis-aligned
// bounding box that edge direction would produce, and keep whichever is
// widest relative to its height. This is a well-defined, start/finish-blind
// notion of "horizontal" - unlike aligning to the start/finish straight
// (the previous approach), it doesn't depend on where that straight happens
// to sit on an otherwise tall or lopsided circuit.
function landscapeOrientationAngle(pts: Vec[]): number {
  const hull = convexHull(pts);
  const n = hull.length;
  if (n < 2) return 0;

  let bestAngle = 0;
  let bestAspect = -Infinity; // width / height of the bounding box, to maximize
  for (let i = 0; i < n; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % n];
    const edgeAngle = Math.atan2(b.y - a.y, b.x - a.x);
    // Rotate by -edgeAngle so this hull edge becomes horizontal, then
    // measure the resulting bounding box.
    const cosA = Math.cos(-edgeAngle);
    const sinA = Math.sin(-edgeAngle);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of hull) {
      const rx = p.x * cosA - p.y * sinA;
      const ry = p.x * sinA + p.y * cosA;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }
    const width = maxX - minX;
    const height = Math.max(maxY - minY, 1e-6);
    const aspect = width / height;
    if (aspect > bestAspect) {
      bestAspect = aspect;
      bestAngle = -edgeAngle;
    }
  }
  return bestAngle;
}

// Resamples a closed polyline (wrapping from the last point back to the
// first) at even arc-length spacing via linear interpolation. The source
// polyline is already dense real geometry, so no curve-fitting is needed
// here - just even spacing for the physics integrator downstream.
function resampleClosed(pts: Vec[], stepM: number): { samples: Vec[]; stepM: number; totalLengthM: number } {
  const n = pts.length;
  const segLen: number[] = [];
  let totalLengthM = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    segLen.push(d);
    totalLengthM += d;
  }
  const sampleCount = Math.max(8, Math.round(totalLengthM / stepM));
  const actualStepM = totalLengthM / sampleCount;

  function sampleAt(distanceM: number): Vec {
    let d = ((distanceM % totalLengthM) + totalLengthM) % totalLengthM;
    let i = 0;
    while (d > segLen[i]) {
      d -= segLen[i];
      i++;
    }
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const t = segLen[i] > 1e-9 ? d / segLen[i] : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  const samples: Vec[] = [];
  for (let i = 0; i < sampleCount; i++) samples.push(sampleAt(i * actualStepM));
  return { samples, stepM: actualStepM, totalLengthM };
}

// Real OSM waypoints carry digitisation jitter (survey/tracing noise of a
// few tens of centimetres) that would otherwise blow up under the
// finite-difference curvature calculation below. A small circular moving
// average removes that jitter while leaving genuine corner geometry -
// including the tightest hairpins on the calendar (~9m radius) - intact.
const SMOOTHING_RADIUS_M = 8;
// Baseline separation used for the 3-point curvature estimate. Larger values
// trade fine detail for stability; this is small enough to still resolve
// tight hairpins distinctly from the corners either side of them.
const CURVATURE_BASELINE_M = 6;
// Sample spacing for the physics centerline (matches the previous
// stylized-geometry default).
const DEFAULT_STEP_M = 2;

function smoothCircular(samples: Vec[], stepM: number): Vec[] {
  const n = samples.length;
  const window = Math.max(1, Math.round(SMOOTHING_RADIUS_M / stepM));
  return samples.map((_, i) => {
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (let k = -window; k <= window; k++) {
      const p = samples[((i + k) % n + n) % n];
      sx += p.x;
      sy += p.y;
      count++;
    }
    return { x: sx / count, y: sy / count };
  });
}

export function buildCircuitGeometry(
  coordinates: number[][],
  circuitId?: string,
  targetStepM = DEFAULT_STEP_M,
): CircuitPoint[] {
  const localPts = projectToLocalMeters(coordinates, circuitId);
  const { samples, stepM, totalLengthM } = resampleClosed(localPts, targetStepM);
  const smoothed = smoothCircular(samples, stepM);
  const n = smoothed.length;
  const curvOffset = Math.max(1, Math.round(CURVATURE_BASELINE_M / stepM));

  const points: CircuitPoint[] = [];
  for (let i = 0; i < n; i++) {
    const prev = smoothed[((i - 1) % n + n) % n];
    const next = smoothed[(i + 1) % n];
    const headingRad = Math.atan2(next.y - prev.y, next.x - prev.x);

    // Signed Menger curvature from three points spaced CURVATURE_BASELINE_M
    // apart: 2 * (signed triangle area) / (product of the three side
    // lengths). Positive = turning left/CCW, matching CircuitPoint's
    // documented sign convention.
    const cp = smoothed[((i - curvOffset) % n + n) % n];
    const cc = smoothed[i];
    const cn = smoothed[(i + curvOffset) % n];
    const a = Math.hypot(cc.x - cp.x, cc.y - cp.y);
    const b = Math.hypot(cn.x - cc.x, cn.y - cc.y);
    const c = Math.hypot(cn.x - cp.x, cn.y - cp.y);
    const cross = (cc.x - cp.x) * (cn.y - cp.y) - (cc.y - cp.y) * (cn.x - cp.x);
    const curvature = a * b * c > 1e-6 ? (2 * cross) / (a * b * c) : 0;

    points.push({
      distanceM: i * stepM,
      x: smoothed[i].x,
      y: smoothed[i].y,
      headingRad,
      curvature,
    });
  }

  // buildCircuitGeometry samples at a fixed step derived from the real
  // geometry's own arc length, so the last sample already lands one step
  // short of totalLengthM - nothing further to reconcile against lengthM
  // here; callers that need the authoritative lap length use totalLengthM
  // directly (see circuits.ts).
  void totalLengthM;
  return points;
}

// Fits a set of local-meter points into an SVG viewBox and returns both the
// viewBox string and a straight-line-joined path string through the same
// (uniformly scaled) points, for the track-map illustration. This is drawn
// from the same real geometry as the physics centerline - just rescaled for
// display - rather than a separate hand-drawn outline.
//
// The width is fixed and always fully used - every circuit is scaled to
// span the same side-to-side extent regardless of its real-world aspect
// ratio - while the height instead varies per circuit to fit whatever that
// scale requires. A shared fixed box (as both dimensions previously were)
// necessarily under-uses the narrower axis for any circuit whose aspect
// ratio doesn't match the box's; since orientation is already normalized
// (see projectToLocalMeters) so every circuit's start/finish reads
// horizontally, width is the axis worth maximizing consistently.
const VIEW_BOX_WIDTH = 300;
const VIEW_BOX_PADDING = 14;

export function buildViewBoxAndOutline(coordinates: number[][], circuitId?: string): {
  viewBox: string;
  outlinePath: string;
} {
  const localPts = projectToLocalMeters(coordinates, circuitId);
  const xs = localPts.map((p) => p.x);
  const ys = localPts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);

  const availW = VIEW_BOX_WIDTH - 2 * VIEW_BOX_PADDING;
  const scale = availW / spanX;
  const viewBoxHeight = spanY * scale + 2 * VIEW_BOX_PADDING;

  const offsetX = VIEW_BOX_PADDING;
  const offsetY = VIEW_BOX_PADDING;

  // SVG y grows downward; real-world y (north) grows upward, so flip it.
  const toSvg = (p: Vec) => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (maxY - p.y) * scale,
  });

  const svgPts = localPts.map(toSvg);
  const [p0, ...rest] = svgPts;
  const d = [`M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`, ...rest.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`), "Z"].join(
    " ",
  );

  return { viewBox: `0 0 ${VIEW_BOX_WIDTH} ${viewBoxHeight.toFixed(2)}`, outlinePath: d };
}

// Real lap length in metres, computed directly from the source geometry's
// own arc length (great-circle distance between consecutive lon/lat
// points) rather than a separately hand-entered constant.
export function computeLengthM(coordinates: number[][]): number {
  const EARTH_RADIUS_M = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[(i + 1) % coordinates.length];
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    total += 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
  }
  return total;
}
