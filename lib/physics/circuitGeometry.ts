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

// How strongly each relaxation pass pulls a point's offset toward its
// neighbors' straightening target (see computeRacingLine). This only
// controls how smoothly the relaxation approaches its answer - what keeps
// it *bounded* (as opposed to collapsing the way naive smoothing of a
// closed curve does) is that every offset is measured and clamped against
// that point's own fixed centerline position, never against a moving
// reference. Don't conflate the two.
const RACING_LINE_DAMPING = 0.28;
// Generous cap - the relaxation converges well before this for every
// circuit on the calendar; it's a backstop against pathological geometry,
// not the normal stopping condition (see RACING_LINE_CONVERGENCE_EPSILON_M).
const RACING_LINE_MAX_ITERATIONS = 600;
const RACING_LINE_CONVERGENCE_EPSILON_M = 1e-4;
// Extra inward clamp, as a fraction of the centerline's own radius of
// curvature at that point: offsetting a corner inward by more than its own
// radius self-intersects the offset curve. Doesn't currently bite (a 12m
// track width's 6m half-width is well under any real corner's radius, even
// the tightest hairpins on the calendar), but keeps the relaxation correct
// if either constant changes.
const RACING_LINE_INSIDE_CLAMP_FACTOR = 0.8;

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

// Heading (tangent direction) and signed Menger curvature at every point of
// a closed, evenly-spaced polyline. Used twice by buildCircuitGeometry:
// once on the raw centerline (heading feeds the racing-line normals below;
// curvature feeds its inside-corner clamp), and once more on the final
// racing-line polyline to produce the CircuitPoint output.
function computeHeadingsAndCurvature(
  pts: Vec[],
  stepM: number,
): { headingRad: number[]; curvature: number[] } {
  const n = pts.length;
  const curvOffset = Math.max(1, Math.round(CURVATURE_BASELINE_M / stepM));
  const headingRad: number[] = [];
  const curvature: number[] = [];

  for (let i = 0; i < n; i++) {
    const prev = pts[((i - 1) % n + n) % n];
    const next = pts[(i + 1) % n];
    headingRad.push(Math.atan2(next.y - prev.y, next.x - prev.x));

    // Signed Menger curvature from three points spaced CURVATURE_BASELINE_M
    // apart: 2 * (signed triangle area) / (product of the three side
    // lengths). Positive = turning left/CCW, matching CircuitPoint's
    // documented sign convention.
    const cp = pts[((i - curvOffset) % n + n) % n];
    const cc = pts[i];
    const cn = pts[(i + curvOffset) % n];
    const a = Math.hypot(cc.x - cp.x, cc.y - cp.y);
    const b = Math.hypot(cn.x - cc.x, cn.y - cc.y);
    const c = Math.hypot(cn.x - cp.x, cn.y - cp.y);
    const cross = (cc.x - cp.x) * (cn.y - cp.y) - (cc.y - cp.y) * (cn.x - cp.x);
    curvature.push(a * b * c > 1e-6 ? (2 * cross) / (a * b * c) : 0);
  }

  return { headingRad, curvature };
}

// Finds a racing line within the track corridor by letting each centerline
// point slide sideways (within +-trackWidthM/2) and relaxing those offsets
// toward whatever locally reduces curvature - the same thing a real driver
// does by using the full track width to straighten a corner or link a
// chicane into one smoother arc, which a pure centerline trace can't
// represent. This directly addresses the reason the hot-lap solver was
// finding corners far tighter than real drivers achieve: cornering speed
// (speedProfile.ts) is derived entirely from curvature, and the centerline
// alone systematically understates how straight a real line through a
// corner actually is.
//
// This is a discrete Laplacian ("taut string") relaxation, but each point's
// offset is measured, every pass, against that *same point's own fixed*
// centerline position and normal - never against a moving reference frame.
// That's what keeps it bounded: naive Laplacian smoothing of a closed curve
// is curve-shortening flow, which collapses the whole curve to a point
// given enough iterations, because each step re-measures from the curve's
// own (shrinking) previous shape. Here, no matter how many passes run, no
// point can ever move further than its own fixed corridor half-width from
// where it started.
function computeRacingLine(
  centerline: Vec[],
  centerlineHeadingRad: number[],
  centerlineCurvature: number[],
  trackWidthM: number,
): Vec[] {
  const n = centerline.length;
  const halfWidth = trackWidthM / 2;
  const alpha = new Array<number>(n).fill(0);
  const normals = centerlineHeadingRad.map((h) => ({ x: -Math.sin(h), y: Math.cos(h) }));
  // Per-point outer clamp: the track-width half-width, further restricted
  // near tight corners so the offset can never exceed the centerline's own
  // radius of curvature there (see RACING_LINE_INSIDE_CLAMP_FACTOR).
  const bounds = centerlineCurvature.map((k) =>
    Math.min(halfWidth, RACING_LINE_INSIDE_CLAMP_FACTOR / Math.max(Math.abs(k), 1e-6)),
  );

  const offsetPoint = (i: number): Vec => ({
    x: centerline[i].x + alpha[i] * normals[i].x,
    y: centerline[i].y + alpha[i] * normals[i].y,
  });

  for (let pass = 0; pass < RACING_LINE_MAX_ITERATIONS; pass++) {
    let maxDelta = 0;
    // Alternate sweep direction each pass (symmetric Gauss-Seidel) so a
    // single fixed direction around the closed loop doesn't bias the
    // result toward one side of every corner.
    const forward = pass % 2 === 0;
    for (let step = 0; step < n; step++) {
      const i = forward ? step : n - 1 - step;
      const prevP = offsetPoint((i - 1 + n) % n);
      const nextP = offsetPoint((i + 1) % n);
      const midX = (prevP.x + nextP.x) / 2;
      const midY = (prevP.y + nextP.y) / 2;
      // Project the straightening pull onto this point's own fixed normal
      // only, so points never slide along the track (only sideways within
      // the corridor) - each index stays anchored to the same arc-length
      // position on the centerline it started at.
      const desiredAlpha =
        (midX - centerline[i].x) * normals[i].x + (midY - centerline[i].y) * normals[i].y;
      const bound = bounds[i];
      const next = Math.min(
        bound,
        Math.max(-bound, alpha[i] + RACING_LINE_DAMPING * (desiredAlpha - alpha[i])),
      );
      maxDelta = Math.max(maxDelta, Math.abs(next - alpha[i]));
      alpha[i] = next;
    }
    if (maxDelta < RACING_LINE_CONVERGENCE_EPSILON_M) break;
  }

  return centerline.map((_, i) => offsetPoint(i));
}

export function buildCircuitGeometry(
  coordinates: number[][],
  circuitId?: string,
  targetStepM = DEFAULT_STEP_M,
  trackWidthM = 12,
  officialLengthM?: number,
): CircuitPoint[] {
  const localPts = projectToLocalMeters(coordinates, circuitId);
  const { samples, stepM } = resampleClosed(localPts, targetStepM);
  const smoothed = smoothCircular(samples, stepM);

  const centerlineShape = computeHeadingsAndCurvature(smoothed, stepM);
  const racingLine = computeRacingLine(
    smoothed,
    centerlineShape.headingRad,
    centerlineShape.curvature,
    trackWidthM,
  );

  // The relaxation above leaves points unevenly spaced (each one only ever
  // moved sideways, not along the track) - resample back to even arc-length
  // spacing exactly as the raw centerline already was, then rescale
  // distanceM so the geometry's own bookkeeping matches the circuit's
  // official length (a racing line is typically ~1-2% shorter than the
  // centerline, from cutting corners) - otherwise a lap-progress fraction
  // computed as distanceM / circuit.lengthM elsewhere would never quite
  // reach 1.
  const resampledLine = resampleClosed(racingLine, targetStepM);
  const targetLengthM = officialLengthM ?? resampledLine.totalLengthM;
  const scale = targetLengthM / resampledLine.totalLengthM;

  const finalShape = computeHeadingsAndCurvature(resampledLine.samples, resampledLine.stepM);
  const n = resampledLine.samples.length;

  const points: CircuitPoint[] = [];
  for (let i = 0; i < n; i++) {
    points.push({
      distanceM: i * resampledLine.stepM * scale,
      x: resampledLine.samples[i].x,
      y: resampledLine.samples[i].y,
      headingRad: finalShape.headingRad[i],
      curvature: finalShape.curvature[i],
    });
  }

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
