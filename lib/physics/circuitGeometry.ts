import { CircuitPoint } from "./types";

// Turns a closed polygon of waypoints into a lap centerline with distance,
// heading and curvature *derived from the geometry* - no hand-assigned
// corner radius or corner-speed table anywhere in this file. Each vertex is
// rounded off with a circular-arc fillet whose radius falls straight out of
// the vertex's own turn angle and the length of track available to build it
// on either side, so a sharp direction change with short straights either
// side naturally becomes a tight radius (a hairpin) and a gentle kink
// between long straights naturally becomes a large radius (a fast sweeper) -
// the same relationship real corners have, without picking either one by
// hand.
//
// The waypoints below are this app's existing stylized per-circuit outlines
// (see circuits.ts) - an approximate sketch of each track's real corner
// sequence at a fixed illustrative scale, not surveyed geometry. Everything
// in this file is written to key off of `waypoints` + `lengthM` alone, so a
// real centerline dataset (e.g. GPS or CAD waypoints, or an already-dense
// point cloud) can be dropped in later without changing any downstream
// physics: distance/heading/curvature are recomputed from whatever geometry
// is provided.

type Vec = { x: number; y: number };

function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}
function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}
function scale(a: Vec, k: number): Vec {
  return { x: a.x * k, y: a.y * k };
}
function length(a: Vec): number {
  return Math.hypot(a.x, a.y);
}
function normalize(a: Vec): Vec {
  const len = length(a);
  return len > 1e-9 ? scale(a, 1 / len) : { x: 1, y: 0 };
}
function cross(a: Vec, b: Vec): number {
  return a.x * b.y - a.y * b.x;
}
function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}
// 90 degree CCW rotation.
function perp(a: Vec): Vec {
  return { x: -a.y, y: a.x };
}

// How much of the *shorter* adjacent edge a single fillet is allowed to
// consume (measured from the vertex outward on each side). Two neighboring
// fillets can each claim up to this fraction of the edge between them
// without overlapping, always leaving a straight remainder in between.
const MAX_TANGENT_FRACTION = 0.42;
// Below this deflection angle a vertex is treated as an imperceptible kink
// in the outline art (not a corner at all) and left as a straight pass-through.
const MIN_TURN_ANGLE_RAD = (0.5 * Math.PI) / 180;

type PathPiece =
  | { kind: "line"; start: Vec; dir: Vec; lengthUnits: number }
  | {
      kind: "arc";
      center: Vec;
      radiusUnits: number;
      startAngleRad: number;
      turnSign: 1 | -1;
      lengthUnits: number;
    };

interface UnitSpacePath {
  pieces: PathPiece[];
  totalLengthUnits: number;
}

function buildUnitSpacePath(waypoints: [number, number][]): UnitSpacePath {
  const n = waypoints.length;
  const pts: Vec[] = waypoints.map(([x, y]) => ({ x, y }));

  // Per-vertex fillet geometry: tangent points where the arc meets each
  // straight, its radius, center and turn direction.
  const fillets = pts.map((curr, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const edgeIn = sub(curr, prev);
    const edgeOut = sub(next, curr);
    const lenIn = length(edgeIn);
    const lenOut = length(edgeOut);
    const dirIn = normalize(edgeIn);
    const dirOut = normalize(edgeOut);

    const turnAngle = Math.acos(Math.max(-1, Math.min(1, dot(dirIn, dirOut))));
    if (turnAngle < MIN_TURN_ANGLE_RAD || lenIn < 1e-6 || lenOut < 1e-6) {
      return { hasFillet: false as const, dirIn, dirOut };
    }

    const turnSign: 1 | -1 = cross(dirIn, dirOut) >= 0 ? 1 : -1;
    const tangentLength = MAX_TANGENT_FRACTION * Math.min(lenIn, lenOut);
    // t = R * tan(turnAngle / 2)  =>  R = t / tan(turnAngle / 2). A sharper
    // turn (turnAngle -> pi) drives the radius toward 0; a gentle kink
    // (turnAngle -> 0) drives it toward infinity (i.e. effectively straight).
    const radius = tangentLength / Math.tan(turnAngle / 2);

    const tangentIn = add(curr, scale(dirIn, -tangentLength));
    const tangentOut = add(curr, scale(dirOut, tangentLength));
    const center = add(tangentIn, scale(perp(dirIn), turnSign * radius));

    return {
      hasFillet: true as const,
      dirIn,
      dirOut,
      tangentIn,
      tangentOut,
      center,
      radius,
      turnAngle,
      turnSign,
    };
  });

  const pieces: PathPiece[] = [];
  for (let i = 0; i < n; i++) {
    const fillet = fillets[i];
    const exitPoint = fillet.hasFillet ? fillet.tangentOut : pts[i];

    if (fillet.hasFillet) {
      const startAngleRad = Math.atan2(
        fillet.tangentIn.y - fillet.center.y,
        fillet.tangentIn.x - fillet.center.x,
      );
      pieces.push({
        kind: "arc",
        center: fillet.center,
        radiusUnits: fillet.radius,
        startAngleRad,
        turnSign: fillet.turnSign,
        lengthUnits: fillet.radius * fillet.turnAngle,
      });
    }

    const nextFillet = fillets[(i + 1) % n];
    const entryPoint = nextFillet.hasFillet ? nextFillet.tangentIn : pts[(i + 1) % n];
    const straight = sub(entryPoint, exitPoint);
    const straightLen = length(straight);
    if (straightLen > 1e-6) {
      pieces.push({
        kind: "line",
        start: exitPoint,
        dir: normalize(straight),
        lengthUnits: straightLen,
      });
    }
  }

  const totalLengthUnits = pieces.reduce((sum, p) => sum + p.lengthUnits, 0);
  return { pieces, totalLengthUnits };
}

function sampleUnitSpace(
  path: UnitSpacePath,
  unitDistance: number,
): { pos: Vec; headingRad: number; curvatureUnits: number } {
  const wrapped = ((unitDistance % path.totalLengthUnits) + path.totalLengthUnits) % path.totalLengthUnits;
  let cursor = 0;
  for (const piece of path.pieces) {
    const end = cursor + piece.lengthUnits;
    if (wrapped <= end || piece === path.pieces[path.pieces.length - 1]) {
      const local = Math.min(piece.lengthUnits, wrapped - cursor);
      if (piece.kind === "line") {
        return {
          pos: add(piece.start, scale(piece.dir, local)),
          headingRad: Math.atan2(piece.dir.y, piece.dir.x),
          curvatureUnits: 0,
        };
      }
      const angle = piece.startAngleRad + (piece.turnSign * local) / piece.radiusUnits;
      const pos = add(piece.center, scale({ x: Math.cos(angle), y: Math.sin(angle) }, piece.radiusUnits));
      const headingRad = angle + piece.turnSign * (Math.PI / 2);
      return { pos, headingRad, curvatureUnits: piece.turnSign / piece.radiusUnits };
    }
    cursor = end;
  }
  // Unreachable (the loop above always returns once it reaches the last
  // piece), kept only to satisfy the type checker.
  return { pos: { x: 0, y: 0 }, headingRad: 0, curvatureUnits: 0 };
}

// Samples the closed lap at (approximately) `targetStepM` spacing, scaling
// the stylized unit-space geometry so the resulting centerline is exactly
// `lengthM` long.
export function buildCircuitGeometry(
  waypoints: [number, number][],
  lengthM: number,
  targetStepM = 2,
): CircuitPoint[] {
  const path = buildUnitSpacePath(waypoints);
  const scaleToMeters = lengthM / path.totalLengthUnits;

  const sampleCount = Math.max(8, Math.round(lengthM / targetStepM));
  const stepM = lengthM / sampleCount;

  const points: CircuitPoint[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const distanceM = i * stepM;
    const { pos, headingRad, curvatureUnits } = sampleUnitSpace(path, distanceM / scaleToMeters);
    points.push({
      distanceM,
      x: pos.x * scaleToMeters,
      y: pos.y * scaleToMeters,
      headingRad,
      curvature: curvatureUnits / scaleToMeters,
    });
  }
  return points;
}

// Counts corners directly from the waypoint geometry: one per vertex whose
// deflection angle is large enough to actually be filleted (see
// MIN_TURN_ANGLE_RAD above), i.e. every place the track's outline actually
// changes direction rather than running straight through. Each waypoint in
// these stylized outlines was hand-placed to mark one real corner (a
// waypoint count matching the track's real corner count was how the old,
// hand-authored corner-class system got its `corners` figure right even
// though its corner *radii* were arbitrary) - counting deflection points
// keeps that same faithfulness while removing the arbitrary radius/speed
// table entirely.
export function countCorners(waypoints: [number, number][]): number {
  const n = waypoints.length;
  const pts: Vec[] = waypoints.map(([x, y]) => ({ x, y }));
  let count = 0;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const dirIn = normalize(sub(curr, prev));
    const dirOut = normalize(sub(next, curr));
    const turnAngle = Math.acos(Math.max(-1, Math.min(1, dot(dirIn, dirOut))));
    if (turnAngle >= MIN_TURN_ANGLE_RAD) count += 1;
  }
  return count;
}
