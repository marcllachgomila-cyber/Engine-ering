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
  const lat0 = lonLat.reduce((sum, [, lat]) => sum + lat, 0) / lonLat.length;
  const lon0 = lonLat.reduce((sum, [lon]) => sum + lon, 0) / lonLat.length;
  const pts = lonLat.map(([lon, lat]) => ({
    x: ((lon - lon0) * Math.PI) / 180 * EARTH_RADIUS_M * Math.cos((lat0 * Math.PI) / 180),
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

// The OSM source polylines are uneven - a metre apart through some corners,
// hundreds of metres apart down some straights, ~17m on average - and a
// straight-segment polyline has no curvature at all except a spike at each
// vertex. Measuring curvature on it directly (even after a light moving
// average) turns every vertex angle into a fake hairpin. Instead, the
// centerline is a periodic cubic smoothing spline fitted through the
// surveyed points: smooth by construction, closed with no seam, and with
// heading and curvature taken from its own analytic derivatives rather
// than finite differences.
//
// Smoothing length of the centerline fit, in metres: roughly the
// wavelength below which the fit stops following the data. It's there to
// absorb a few tens of centimetres of digitisation jitter, not to round
// corners off - a corner of radius R comes out only (1 + (L/R)^4) times
// wider, so ~1% at R = 15m, the tightest hairpins on the calendar.
const CENTERLINE_SMOOTHING_LENGTH_M = 5;
// The racing line (below) is already smooth, so its spline only needs to
// carry it for analytic derivatives, not filter it.
const RACING_LINE_SMOOTHING_LENGTH_M = 1;
// B-spline knot spacing, in the fit's chord-length parameter. Finer than
// both smoothing lengths so the knots never constrain the shape; the
// roughness penalty does.
const SPLINE_KNOT_SPACING_M = 2;
// Source points closer than this are the same surveyed point twice (most
// files repeat the first point at the end to close the loop).
const DUPLICATE_POINT_EPSILON_M = 0.05;
// Sample spacing for the physics line (matches the previous
// stylized-geometry default).
const DEFAULT_STEP_M = 2;

// The racing line slides sideways along the normals of a gently smoothed
// copy of the centerline rather than the centerline's own: around a tight
// corner the centerline's normals cross a few metres inside it, so offsets
// along them would fold over. This only picks the directions the line may
// move in - where it may go is still the real corridor around the real
// centerline (see corridorBounds).
const REFERENCE_SMOOTHING_LENGTH_M = 20;
// How far along the centerline, either way, counts as "the same bit of
// track" when measuring the corridor - enough to take in the whole of any
// corner, not so much that a neighbouring straight elsewhere could count.
const CORRIDOR_SEARCH_WINDOW_M = 80;
// Interior-point settings for the racing-line QP (see computeRacingLine):
// it converges in a few dozen Newton steps; the cap is only a backstop.
// The tolerance is on the complementarity gap and the stationarity
// residual, far below anything that would show up in the curvature.
const RACING_LINE_MAX_ITERATIONS = 100;
const RACING_LINE_TOLERANCE = 1e-9;
const RACING_LINE_CENTERING = 0.1;
const RACING_LINE_STEP_TO_BOUNDARY = 0.99;
// Backstop on how far past the centerline the corridor may reach, in
// half-widths - only ever approached on the inside of the tightest
// hairpins, where the two legs' kerbs meet.
const CORRIDOR_MAX_REACH_HALF_WIDTHS = 3;
// Tiny pull toward the reference line that keeps the racing-line system
// strictly positive definite on long straights; far too small to move the
// line measurably.
const RACING_LINE_RIDGE = 1e-6;

interface ShapeSample extends Vec {
  headingRad: number;
  curvature: number;
}

function dropDuplicatePoints(pts: Vec[]): Vec[] {
  const out: Vec[] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > DUPLICATE_POINT_EPSILON_M) out.push(p);
  }
  while (
    out.length > 1 &&
    Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <=
      DUPLICATE_POINT_EPSILON_M
  ) {
    out.pop();
  }
  return out;
}

function distanceToSegmentM(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq)) : 0;
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

// How far the polyline turns at vertex i, in degrees (0 = straight on,
// 180 = straight back the way it came).
function turnDegAt(pts: Vec[], i: number): number {
  const n = pts.length;
  const prev = pts[(i - 1 + n) % n];
  const tip = pts[i];
  const next = pts[(i + 1) % n];
  const turn = Math.atan2(next.y - tip.y, next.x - tip.x) - Math.atan2(tip.y - prev.y, tip.x - prev.x);
  return Math.abs(((((turn * 180) / Math.PI + 540) % 360) + 360) % 360 - 180);
}

// Where the source polyline reverses at a single vertex (turning more
// than REVERSAL_TURN_DEG), and the way back runs within half a track width of
// the way out, that tip isn't a corner - two centerline legs that close
// would put the track on top of itself. It's an out-and-back spur left
// where OSM ways were stitched together (a stub of old layout or pit
// lane). Drop the tip and look again, until the path no longer doubles
// back on itself. A real hairpin traced with a sharp tip survives this:
// its legs part by more than a track width within a vertex or two.
const REVERSAL_TURN_DEG = 120;

function removeOutAndBackSpurs(pts: Vec[], halfWidthM: number): Vec[] {
  const out = [...pts];
  for (let i = 0; out.length > 3 && i < out.length; ) {
    const n = out.length;
    const prev = out[(i - 1 + n) % n];
    const tip = out[i];
    const next = out[(i + 1) % n];
    const legGap = Math.min(distanceToSegmentM(next, prev, tip), distanceToSegmentM(prev, tip, next));
    if (turnDegAt(out, i) > REVERSAL_TURN_DEG && legGap < halfWidthM) {
      out.splice(i, 1);
      // The neighbours are now adjacent - the one before may be the new tip.
      i = Math.max(0, i - 1);
    } else {
      i++;
    }
  }
  return out;
}

// A genuine hairpin traced as a single sharp vertex (turning more than
// REVERSAL_TURN_DEG in one go) says where its two legs run and that the
// track turns round, but not how - and no spline through that point can
// say either: it slows to a near-standstill at the tip and turns back on
// itself in a cusp, however stiff it's made. Replace each such tip with
// the circular arc of radius `radiusM` tangent to both legs - half the
// track width, the tightest any real centerline can turn without its
// inside edge folding over. If a leg is too short to hold the arc's
// tangent point, its far vertex joins the arc too. The first point (the
// start/finish line) is kept first.
const FILLET_POINT_SPACING_M = 2;
const FILLET_MAX_ABSORBED_VERTICES = 6;

function filletReversals(pts: Vec[], radiusM: number): Vec[] {
  let out = [...pts];
  const start = out[0];
  const skipped = new Set<Vec>();
  for (;;) {
    const i = out.findIndex((p, k) => !skipped.has(p) && turnDegAt(out, k) > REVERSAL_TURN_DEG);
    if (i < 0) break;
    // Rotate the tip to the middle so both legs index without wrapping.
    const half = Math.floor(out.length / 2);
    const shift = (i - half + out.length) % out.length;
    out = [...out.slice(shift), ...out.slice(0, shift)];
    const tip = out[half];

    let a = half - 1;
    let b = half + 1;
    let arc: Vec[] | null = null;
    while (half - a + (b - half) - 2 <= FILLET_MAX_ABSORBED_VERTICES && a > 0 && b < out.length - 1) {
      const inLen = Math.hypot(tip.x - out[a].x, tip.y - out[a].y);
      const outLen = Math.hypot(out[b].x - tip.x, out[b].y - tip.y);
      const inDir = { x: (tip.x - out[a].x) / inLen, y: (tip.y - out[a].y) / inLen };
      const outDir = { x: (out[b].x - tip.x) / outLen, y: (out[b].y - tip.y) / outLen };
      const cross = inDir.x * outDir.y - inDir.y * outDir.x;
      const turn = Math.atan2(cross, inDir.x * outDir.x + inDir.y * outDir.y);
      const tangentM = radiusM * Math.tan(Math.abs(turn) / 2);
      if (inLen < tangentM || outLen < tangentM) {
        if (inLen < tangentM) a--;
        if (outLen < tangentM) b++;
        continue;
      }
      // Arc from the in-leg tangent point, around the centre on the
      // inside of the turn, to the out-leg tangent point.
      const side = Math.sign(turn);
      const p1 = { x: tip.x - inDir.x * tangentM, y: tip.y - inDir.y * tangentM };
      const centre = { x: p1.x - side * inDir.y * radiusM, y: p1.y + side * inDir.x * radiusM };
      const startAngle = Math.atan2(p1.y - centre.y, p1.x - centre.x);
      const steps = Math.max(2, Math.ceil((radiusM * Math.abs(turn)) / FILLET_POINT_SPACING_M));
      arc = [];
      for (let k = 0; k <= steps; k++) {
        const angle = startAngle + (turn * k) / steps;
        arc.push({ x: centre.x + radiusM * Math.cos(angle), y: centre.y + radiusM * Math.sin(angle) });
      }
      break;
    }
    if (arc) out.splice(a + 1, b - a - 1, ...arc);
    else skipped.add(tip);
  }
  let startIndex = out.indexOf(start);
  if (startIndex < 0) {
    const distance = (p: Vec) => Math.hypot(p.x - start.x, p.y - start.y);
    startIndex = out.reduce((best, p, k) => (distance(p) < distance(out[best]) ? k : best), 0);
  }
  return [...out.slice(startIndex), ...out.slice(0, startIndex)];
}

// A symmetric matrix whose only non-zeros sit within `bandwidth` of the
// diagonal, cyclically (row 0 also touches the last few columns) - the
// shape every system in this file has, since each unknown only interacts
// with its neighbours around a closed loop. band[k][i] holds A[i][i+k mod n].
class CyclicBandMatrix {
  readonly size: number;
  readonly bandwidth: number;
  readonly band: Float64Array[];

  constructor(size: number, bandwidth: number) {
    this.size = size;
    this.bandwidth = bandwidth;
    if (size <= 2 * bandwidth + 1) throw new Error("CyclicBandMatrix: too few unknowns for its bandwidth");
    this.band = Array.from({ length: bandwidth + 1 }, () => new Float64Array(size));
  }

  // Adds v to A[i][j] (and so, by symmetry, to A[j][i]). Out-of-band
  // entries are ignored, so callers can loop over all ordered pairs of a
  // local stencil and each off-diagonal pair lands exactly once.
  add(i: number, j: number, v: number): void {
    const n = this.size;
    const d = (((j - i) % n) + n) % n;
    if (d <= this.bandwidth) this.band[d][((i % n) + n) % n] += v;
  }

  get(i: number, j: number): number {
    const n = this.size;
    const d = (((j - i) % n) + n) % n;
    if (d <= this.bandwidth) return this.band[d][i];
    if (n - d <= this.bandwidth) return this.band[n - d][j];
    return 0;
  }

  multiply(x: ArrayLike<number>): Float64Array {
    const n = this.size;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = this.band[0][i] * x[i];
      for (let k = 1; k <= this.bandwidth; k++) {
        s += this.band[k][i] * x[(i + k) % n];
        s += this.band[k][(i - k + n) % n] * x[(i - k + n) % n];
      }
      out[i] = s;
    }
    return out;
  }

  solve(rhsList: ArrayLike<number>[]): Float64Array[] {
    const solveOne = this.factor();
    return rhsList.map(solveOne);
  }

  // Factorises A (symmetric positive definite) once and returns a function
  // solving A x = rhs for any right-hand side. The last `bandwidth` unknowns
  // are split off as a small dense border, which leaves the rest a plain
  // (non-cyclic) band matrix: banded Cholesky on that, then a Schur
  // complement for the border. O(n) to factor, O(n) per solve.
  factor(): (rhs: ArrayLike<number>) => Float64Array {
    const p = this.bandwidth;
    const n = this.size;
    const n1 = n - p;
    const w = p + 1;

    // Banded Cholesky of the interior block: L[i*w + (i-j)] = L(i, j).
    const L = new Float64Array(n1 * w);
    for (let i = 0; i < n1; i++) {
      for (let j = Math.max(0, i - p); j <= i; j++) {
        let s = this.get(i, j);
        for (let k = Math.max(0, i - p); k < j; k++) s -= L[i * w + (i - k)] * L[j * w + (j - k)];
        if (i === j) {
          if (s <= 0) throw new Error("CyclicBandMatrix: not positive definite");
          L[i * w] = Math.sqrt(s);
        } else {
          L[i * w + (i - j)] = s / L[j * w];
        }
      }
    }
    const solveInterior = (r: ArrayLike<number>): Float64Array => {
      const y = new Float64Array(n1);
      for (let i = 0; i < n1; i++) {
        let s = r[i];
        for (let k = Math.max(0, i - p); k < i; k++) s -= L[i * w + (i - k)] * y[k];
        y[i] = s / L[i * w];
      }
      for (let i = n1 - 1; i >= 0; i--) {
        let s = y[i];
        for (let k = i + 1; k <= Math.min(n1 - 1, i + p); k++) s -= L[k * w + (k - i)] * y[k];
        y[i] = s / L[i * w];
      }
      return y;
    };

    // Y = A11^-1 A12, and the border's Schur complement S = A22 - A21 Y.
    const Y: Float64Array[] = [];
    for (let r = 0; r < p; r++) {
      const col = new Float64Array(n1);
      for (let i = 0; i < n1; i++) col[i] = this.get(i, n1 + r);
      Y.push(solveInterior(col));
    }
    const S: number[][] = [];
    for (let r = 0; r < p; r++) {
      S.push([]);
      for (let c = 0; c < p; c++) {
        let s = this.get(n1 + r, n1 + c);
        for (let i = 0; i < n1; i++) s -= this.get(n1 + r, i) * Y[c][i];
        S[r].push(s);
      }
    }

    return (rhs) => {
      const z = solveInterior(rhs);
      const border: number[] = [];
      for (let r = 0; r < p; r++) {
        let s = rhs[n1 + r];
        for (let i = 0; i < n1; i++) s -= this.get(n1 + r, i) * z[i];
        border.push(s);
      }
      const x2 = solveDense(S, border);
      const x = new Float64Array(n);
      for (let i = 0; i < n1; i++) {
        let s = z[i];
        for (let r = 0; r < p; r++) s -= Y[r][i] * x2[r];
        x[i] = s;
      }
      for (let r = 0; r < p; r++) x[n1 + r] = x2[r];
      return x;
    };
  }
}

// Gaussian elimination with partial pivoting, for the few-unknown border
// system above.
function solveDense(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    for (let r = c + 1; r < n; r++) {
      const f = a[r][c] / a[c][c];
      for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = a[r][n];
    for (let k = r + 1; k < n; k++) s -= a[r][k] * x[k];
    x[r] = s / a[r][r];
  }
  return x;
}

// Uniform cubic B-spline basis centred on 0 (support -2..2), with its first
// and second derivatives, in units of knot spacings.
function bSpline(u: number): [number, number, number] {
  const a = Math.abs(u);
  const sign = u < 0 ? -1 : 1;
  if (a < 1) return [(4 - 6 * a * a + 3 * a * a * a) / 6, sign * (-2 * a + 1.5 * a * a), -2 + 3 * a];
  if (a < 2) {
    const b = 2 - a;
    return [(b * b * b) / 6, sign * (-0.5 * b * b), b];
  }
  return [0, 0, 0];
}

// A closed curve r(t) = sum_j c_j B((t - j*h)/h), periodic in t with period
// `periodM` (the chord length around the source points).
interface PeriodicSpline {
  periodM: number;
  knotSpacingM: number;
  cx: Float64Array;
  cy: Float64Array;
}

interface SplineEval {
  x: number;
  y: number;
  dx: number;
  dy: number;
  ddx: number;
  ddy: number;
}

function evalSpline(spline: PeriodicSpline, t: number): SplineEval {
  const { cx, cy, knotSpacingM: h, periodM } = spline;
  const m = cx.length;
  const u = ((((t % periodM) + periodM) % periodM) / h);
  const k = Math.floor(u);
  const out: SplineEval = { x: 0, y: 0, dx: 0, dy: 0, ddx: 0, ddy: 0 };
  for (let j = k - 1; j <= k + 2; j++) {
    const [b, db, ddb] = bSpline(u - j);
    const idx = ((j % m) + m) % m;
    out.x += cx[idx] * b;
    out.y += cy[idx] * b;
    out.dx += (cx[idx] * db) / h;
    out.dy += (cy[idx] * db) / h;
    out.ddx += (cx[idx] * ddb) / (h * h);
    out.ddy += (cy[idx] * ddb) / (h * h);
  }
  return out;
}

// Periodic cubic smoothing spline through a closed loop of points
// (penalised B-splines on fine knots - numerically the same thing as the
// classic smoothing spline). Minimises, for x(t) and y(t) separately,
//
//   sum_i w_i (p_i - r(t_i))^2  +  L^4 * integral r''(t)^2 dt
//
// over the chord-length parameter t. Each point is weighted by the length
// of track it stands for (half the gap to each neighbour), so the data term
// approximates an integral along the track and L acts as a true length
// scale everywhere - dense and sparse stretches of survey alike.
function fitPeriodicSpline(pts: Vec[], smoothingLengthM: number): PeriodicSpline {
  const n = pts.length;
  const chord: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    chord.push(Math.hypot(b.x - a.x, b.y - a.y));
  }
  const t: number[] = [0];
  for (let i = 1; i < n; i++) t.push(t[i - 1] + chord[i - 1]);
  const periodM = t[n - 1] + chord[n - 1];

  const m = Math.max(8, Math.round(periodM / SPLINE_KNOT_SPACING_M));
  const h = periodM / m;
  const A = new CyclicBandMatrix(m, 3);
  const rx = new Float64Array(m);
  const ry = new Float64Array(m);

  for (let i = 0; i < n; i++) {
    const w = (chord[i] + chord[(i - 1 + n) % n]) / 2;
    const u = t[i] / h;
    const k = Math.floor(u);
    const idx: number[] = [];
    const val: number[] = [];
    for (let j = k - 1; j <= k + 2; j++) {
      idx.push(((j % m) + m) % m);
      val.push(bSpline(u - j)[0]);
    }
    for (let a = 0; a < 4; a++) {
      rx[idx[a]] += w * val[a] * pts[i].x;
      ry[idx[a]] += w * val[a] * pts[i].y;
      for (let b = 0; b < 4; b++) A.add(idx[a], idx[b], w * val[a] * val[b]);
    }
  }

  // integral r''^2 dt ~= sum_j (second difference of c_j)^2 / h^3.
  const penalty = smoothingLengthM ** 4 / h ** 3;
  const stencil = [1, -2, 1];
  for (let j = 0; j < m; j++) {
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) A.add(j - 1 + a, j - 1 + b, penalty * stencil[a] * stencil[b]);
    }
  }

  const [cx, cy] = A.solve([rx, ry]);
  return { periodM, knotSpacingM: h, cx, cy };
}

// Walks the spline at even arc-length spacing (as close to targetStepM as
// divides the loop evenly), with heading and signed curvature from the
// spline's own derivatives: kappa = (x'y'' - y'x'') / |r'|^3, positive =
// turning left/CCW, matching CircuitPoint's documented sign convention.
function sampleByArcLength(
  spline: PeriodicSpline,
  targetStepM: number,
): { samples: ShapeSample[]; stepM: number; totalLengthM: number } {
  // Arc length s(t) by Simpson's rule on a grid a quarter-knot apart.
  const gridCount = Math.round(spline.periodM / spline.knotSpacingM) * 4;
  const dt = spline.periodM / gridCount;
  const speed = (t: number) => {
    const e = evalSpline(spline, t);
    return Math.hypot(e.dx, e.dy);
  };
  const s = new Float64Array(gridCount + 1);
  for (let g = 0; g < gridCount; g++) {
    const t0 = g * dt;
    s[g + 1] = s[g] + (dt / 6) * (speed(t0) + 4 * speed(t0 + dt / 2) + speed(t0 + dt));
  }
  const totalLengthM = s[gridCount];
  const sampleCount = Math.max(8, Math.round(totalLengthM / targetStepM));
  const stepM = totalLengthM / sampleCount;

  const samples: ShapeSample[] = [];
  let g = 0;
  for (let i = 0; i < sampleCount; i++) {
    const target = i * stepM;
    while (g < gridCount - 1 && s[g + 1] < target) g++;
    const t = (g + (target - s[g]) / Math.max(s[g + 1] - s[g], 1e-12)) * dt;
    const e = evalSpline(spline, t);
    const speedSq = e.dx * e.dx + e.dy * e.dy;
    samples.push({
      x: e.x,
      y: e.y,
      headingRad: Math.atan2(e.dy, e.dx),
      curvature: (e.dx * e.ddy - e.dy * e.ddx) / Math.pow(speedSq, 1.5),
    });
  }
  return { samples, stepM, totalLengthM };
}

// The stretch of the line r + alpha*n (n a unit vector) lying within
// `radius` of the segment a-b, as [from, to] in alpha, or null if the line
// misses it. The set of points within `radius` of a segment is a capsule -
// convex - so this is always a single interval: the hull of where the line
// crosses the two end discs and the rectangle between them.
function lineCapsuleInterval(
  r: Vec,
  n: Vec,
  a: Vec,
  b: Vec,
  radius: number,
): [number, number] | null {
  let from = Infinity;
  let to = -Infinity;
  for (const c of [a, b]) {
    const dx = r.x - c.x;
    const dy = r.y - c.y;
    const along = dx * n.x + dy * n.y;
    const disc = along * along - (dx * dx + dy * dy) + radius * radius;
    if (disc < 0) continue;
    const root = Math.sqrt(disc);
    from = Math.min(from, -along - root);
    to = Math.max(to, -along + root);
  }
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length > 1e-9) {
    const ex = (b.x - a.x) / length;
    const ey = (b.y - a.y) / length;
    // Segment frame: u along a->b in [0, length], v across it in [-radius, radius].
    const u0 = (r.x - a.x) * ex + (r.y - a.y) * ey;
    const du = n.x * ex + n.y * ey;
    const v0 = -(r.x - a.x) * ey + (r.y - a.y) * ex;
    const dv = -n.x * ey + n.y * ex;
    let lo = -Infinity;
    let hi = Infinity;
    const slab = (p0: number, dp: number, min: number, max: number) => {
      if (Math.abs(dp) < 1e-12) {
        if (p0 < min || p0 > max) hi = -Infinity;
        return;
      }
      const t1 = (min - p0) / dp;
      const t2 = (max - p0) / dp;
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
    };
    slab(u0, du, 0, length);
    slab(v0, dv, -radius, radius);
    if (lo <= hi) {
      from = Math.min(from, lo);
      to = Math.max(to, hi);
    }
  }
  return from <= to ? [from, to] : null;
}

// How far each reference point may slide along its normal, each way, and
// stay on track - the track being every point within half the track width
// of the centerline. On a straight that's just +-half-width either side of
// where the normal crosses the centerline; on the inside of a tight corner
// it's more, since the kerb there is the corner of two edges meeting, not a
// parallel offset of the centerline. Computed exactly, as the stretch of
// the normal inside the union of the nearby centerline segments' capsules
// that contains the crossing.
function corridorBounds(
  reference: ShapeSample[],
  centerline: ShapeSample[],
  stepM: number,
  halfWidthM: number,
): { lo: Float64Array; hi: Float64Array } {
  const nRef = reference.length;
  const nCl = centerline.length;
  const window = Math.round(CORRIDOR_SEARCH_WINDOW_M / stepM);
  // No edge is looked for further than this from the crossing, so no
  // segment further than this plus a half-width (plus a segment) matters.
  const maxReachM = CORRIDOR_MAX_REACH_HALF_WIDTHS * halfWidthM;
  const relevantM = maxReachM + halfWidthM + stepM;
  const lo = new Float64Array(nRef);
  const hi = new Float64Array(nRef);
  const at = (j: number) => centerline[((j % nCl) + nCl) % nCl];

  let anchor = 0;
  for (let i = 0; i < nRef; i++) {
    const r = reference[i];
    const n = { x: -Math.sin(r.headingRad), y: Math.cos(r.headingRad) };

    // Nearest centerline sample, tracked forward from the last one (both
    // lines run the same way round, at the same spacing).
    let best = Infinity;
    const guess = anchor;
    for (let k = -window; k <= window; k++) {
      const c = at(guess + k);
      const d = (c.x - r.x) ** 2 + (c.y - r.y) ** 2;
      if (d < best) {
        best = d;
        anchor = guess + k;
      }
    }

    // Where the normal crosses the centerline (nearest crossing).
    let crossing = Infinity;
    for (let k = -window; k < window; k++) {
      const a = at(anchor + k);
      const b = at(anchor + k + 1);
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const denom = n.x * ey - n.y * ex;
      if (Math.abs(denom) < 1e-12) continue;
      // Solve r + alpha n = a + t (b - a) for alpha and t.
      const wx = a.x - r.x;
      const wy = a.y - r.y;
      const alpha = (wx * ey - wy * ex) / denom;
      const t = (wx * n.y - wy * n.x) / denom;
      if (t >= 0 && t <= 1 && Math.abs(alpha) < Math.abs(crossing)) crossing = alpha;
    }
    if (!Number.isFinite(crossing)) {
      const c = at(anchor);
      crossing = (c.x - r.x) * n.x + (c.y - r.y) * n.y;
    }

    // The union of the nearby capsules along the normal, and the connected
    // stretch of it around the crossing (which is inside by construction).
    const cx = r.x + crossing * n.x;
    const cy = r.y + crossing * n.y;
    const intervals: [number, number][] = [];
    for (let k = -window; k < window; k++) {
      const a = at(anchor + k);
      const b = at(anchor + k + 1);
      if (Math.hypot((a.x + b.x) / 2 - cx, (a.y + b.y) / 2 - cy) > relevantM) continue;
      const interval = lineCapsuleInterval(r, n, a, b, halfWidthM);
      if (interval) intervals.push(interval);
    }
    let from = crossing - halfWidthM;
    let to = crossing + halfWidthM;
    for (let grew = true; grew; ) {
      grew = false;
      for (const [s, e] of intervals) {
        if (s <= to && e >= from && (s < from || e > to)) {
          from = Math.min(from, s);
          to = Math.max(to, e);
          grew = true;
        }
      }
    }
    lo[i] = Math.max(from, crossing - maxReachM);
    hi[i] = Math.min(to, crossing + maxReachM);
  }
  return { lo, hi };
}

// A minimum-curvature racing line: each point may slide sideways, anywhere
// within the track corridor, and the offsets are chosen to minimise the
// line's total squared curvature (sum of |second difference|^2). That's
// what a real driver does with the track width - straighten each corner,
// link a chicane into one arc - and the curvature it leaves is what sets
// cornering speed (speedProfile.ts).
//
// Minimising squared *curvature* (rather than length, i.e. pulling the
// line taut) matters: a taut string is straight between the points where
// it touches the kerb and bends abruptly at them, which reads as
// single-point curvature spikes; the minimum-curvature line eases in and
// out of every contact with the edge, so its curvature is continuous.
//
// The offsets solve a convex quadratic programme with box constraints,
// by a primal-dual interior-point method: each Newton step is one O(n)
// banded solve, and it converges in a few dozen steps however badly
// conditioned the system is (long, gentle bends make it very badly
// conditioned - first-order methods crawl here).
function computeRacingLine(centerline: ShapeSample[], stepM: number, trackWidthM: number): Vec[] {
  const reference = sampleByArcLength(
    fitPeriodicSpline(centerline, REFERENCE_SMOOTHING_LENGTH_M),
    stepM,
  ).samples;
  const n = reference.length;
  const nx = reference.map((p) => -Math.sin(p.headingRad));
  const ny = reference.map((p) => Math.cos(p.headingRad));
  const { lo, hi } = corridorBounds(reference, centerline, stepM, trackWidthM / 2);

  // Energy sum_k |P_{k-1} - 2P_k + P_{k+1}|^2 with P_i = r_i + a_i n_i is
  // a quadratic 1/2 a'Ha - b'a with H_ij = 2 (n_i . n_j) Q_ij and
  // b_i = -2 n_i . (Q r)_i, Q being the cyclic [1 -4 6 -4 1] stencil.
  const q = [6, -4, 1];
  const H = new CyclicBandMatrix(n, 2);
  const b = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k <= 2; k++) {
      const j = (i + k) % n;
      H.add(i, j, 2 * q[k] * (nx[i] * nx[j] + ny[i] * ny[j]) + (k === 0 ? RACING_LINE_RIDGE : 0));
    }
    let qx = 0;
    let qy = 0;
    for (let k = -2; k <= 2; k++) {
      const r = reference[(i + k + n) % n];
      qx += q[Math.abs(k)] * r.x;
      qy += q[Math.abs(k)] * r.y;
    }
    b[i] = -2 * (nx[i] * qx + ny[i] * qy);
  }

  // Start mid-corridor, with the multipliers for both edges at 1.
  const alpha = Float64Array.from(lo, (l, i) => (l + hi[i]) / 2);
  const zLo = new Float64Array(n).fill(1);
  const zHi = new Float64Array(n).fill(1);
  for (let iter = 0; iter < RACING_LINE_MAX_ITERATIONS; iter++) {
    const gradient = H.multiply(alpha);
    let gap = 0;
    let residual = 0;
    for (let i = 0; i < n; i++) {
      gap += (alpha[i] - lo[i]) * zLo[i] + (hi[i] - alpha[i]) * zHi[i];
      residual = Math.max(residual, Math.abs(gradient[i] - b[i] - zLo[i] + zHi[i]));
    }
    const mu = gap / (2 * n);
    if (mu < RACING_LINE_TOLERANCE && residual < RACING_LINE_TOLERANCE * 1e3) break;
    const target = RACING_LINE_CENTERING * mu;

    // Newton step on the perturbed KKT conditions, reduced to one system
    // in the offsets: (H + Z_lo/S_lo + Z_hi/S_hi) d = rhs.
    const system = new CyclicBandMatrix(n, 2);
    const rhs = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const sLo = alpha[i] - lo[i];
      const sHi = hi[i] - alpha[i];
      for (let k = 0; k <= 2; k++) system.band[k][i] = H.band[k][i];
      system.band[0][i] += zLo[i] / sLo + zHi[i] / sHi;
      rhs[i] = -(gradient[i] - b[i] - zLo[i] + zHi[i]) + (target / sLo - zLo[i]) - (target / sHi - zHi[i]);
    }
    const dAlpha = system.factor()(rhs);

    // Longest step (up to a full one) that keeps every slack and
    // multiplier strictly positive.
    let step = 1;
    const dzLo = new Float64Array(n);
    const dzHi = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const sLo = alpha[i] - lo[i];
      const sHi = hi[i] - alpha[i];
      dzLo[i] = (target - sLo * zLo[i] - zLo[i] * dAlpha[i]) / sLo;
      dzHi[i] = (target - sHi * zHi[i] + zHi[i] * dAlpha[i]) / sHi;
      if (dAlpha[i] < 0) step = Math.min(step, (-RACING_LINE_STEP_TO_BOUNDARY * sLo) / dAlpha[i]);
      if (dAlpha[i] > 0) step = Math.min(step, (RACING_LINE_STEP_TO_BOUNDARY * sHi) / dAlpha[i]);
      if (dzLo[i] < 0) step = Math.min(step, (-RACING_LINE_STEP_TO_BOUNDARY * zLo[i]) / dzLo[i]);
      if (dzHi[i] < 0) step = Math.min(step, (-RACING_LINE_STEP_TO_BOUNDARY * zHi[i]) / dzHi[i]);
    }
    for (let i = 0; i < n; i++) {
      alpha[i] += step * dAlpha[i];
      zLo[i] += step * dzLo[i];
      zHi[i] += step * dzHi[i];
    }
  }

  return reference.map((r, i) => ({ x: r.x + alpha[i] * nx[i], y: r.y + alpha[i] * ny[i] }));
}

export function buildCircuitGeometry(
  coordinates: number[][],
  circuitId?: string,
  targetStepM = DEFAULT_STEP_M,
  trackWidthM = 12,
): CircuitPoint[] {
  const surveyed = filletReversals(
    removeOutAndBackSpurs(dropDuplicatePoints(projectToLocalMeters(coordinates, circuitId)), trackWidthM / 2),
    trackWidthM / 2,
  );
  const centerline = sampleByArcLength(
    fitPeriodicSpline(surveyed, CENTERLINE_SMOOTHING_LENGTH_M),
    targetStepM,
  );

  const racingLine = computeRacingLine(centerline.samples, centerline.stepM, trackWidthM);

  // The racing-line points each moved only sideways, so they're no longer
  // evenly spaced along the new line - carry them on their own spline and
  // resample that at even arc length. distanceM is the true distance along
  // the racing line, which is ~1-2% shorter than the centerline (and so
  // than circuit.lengthM) from cutting corners: the car covers exactly the
  // path whose curvature it's cornering on. Lap progress is measured
  // against the line's own length (circuit.racingLineLengthM).
  const lineSpline = fitPeriodicSpline(racingLine, RACING_LINE_SMOOTHING_LENGTH_M);
  const line = sampleByArcLength(lineSpline, targetStepM);

  return line.samples.map((p, i) => ({
    distanceM: i * line.stepM,
    x: p.x,
    y: p.y,
    headingRad: p.headingRad,
    curvature: p.curvature,
  }));
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
