// 2D incompressible potential flow around a closed body, by the constant-
// strength source panel method (the non-lifting half of Hess-Smith), with
// an optional ground plane modelled by the method of images.
//
// What it is: an exact solution of the inviscid, irrotational flow
// equations for the given outline (up to panel discretisation) - it gets
// flow acceleration over the roof, stagnation at the nose and the ground
// effect under the floor right. What it is not: viscous. There is no
// boundary layer, no separation and no wake (d'Alembert's paradox - a
// potential-flow body has zero drag), and with sources only there's no
// circulation, so no lift either. Those are layered on separately and
// labelled as estimates wherever they're shown. All velocities here are
// relative to the freestream speed (U = 1 along +x), so the field is
// independent of the actual speed.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Panel {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // Control point (midpoint), length, unit tangent and outward unit normal.
  xc: number;
  yc: number;
  length: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
}

function makePanel(x1: number, y1: number, x2: number, y2: number, outwardSign: number): Panel {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const tx = (x2 - x1) / length;
  const ty = (y2 - y1) / length;
  return {
    x1,
    y1,
    x2,
    y2,
    xc: (x1 + x2) / 2,
    yc: (y1 + y2) / 2,
    length,
    tx,
    ty,
    // Rotating the tangent -90deg points outward for a counter-clockwise
    // outline; outwardSign flips it for a clockwise one.
    nx: outwardSign * ty,
    ny: outwardSign * -tx,
  };
}

function signedArea(polygon: Vec2[]): number {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

// One panel per polygon edge (the polygon is implicitly closed).
export function buildPanels(polygon: Vec2[]): Panel[] {
  const outwardSign = signedArea(polygon) > 0 ? 1 : -1;
  return polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    return makePanel(a.x, a.y, b.x, b.y, outwardSign);
  });
}

// Velocity induced at (px, py) by a unit-strength source panel. In panel
// coordinates (x along the panel from its start, y along its normal) the
// closed-form result is u = ln(r1/r2)/2pi, v = (theta2 - theta1)/2pi. The
// global result doesn't depend on which way the normal points.
function sourceVelocity(panel: Panel, px: number, py: number, out: Vec2): Vec2 {
  const dx = px - panel.x1;
  const dy = py - panel.y1;
  const xl = dx * panel.tx + dy * panel.ty;
  const yl = dx * panel.nx + dy * panel.ny;
  const xr = xl - panel.length;
  const r1sq = xl * xl + yl * yl;
  const r2sq = xr * xr + yl * yl;
  const ul = Math.log(r1sq / r2sq) / (4 * Math.PI);
  const vl = (Math.atan2(yl, xr) - Math.atan2(yl, xl)) / (2 * Math.PI);
  out.x = ul * panel.tx + vl * panel.nx;
  out.y = ul * panel.ty + vl * panel.ny;
  return out;
}

function mirrorPanel(p: Panel): Panel {
  // The image body under the ground; its normals point the other way, which
  // (see sourceVelocity) doesn't change what it induces.
  return makePanel(p.x1, -p.y1, p.x2, -p.y2, 1);
}

// Gaussian elimination with partial pivoting; solves A x = b in place.
function solveLinear(A: Float64Array[], b: Float64Array): Float64Array {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / A[col][col];
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < n; c++) s -= A[r][c] * x[c];
    x[r] = s / A[r][r];
  }
  return x;
}

export interface PotentialFlow {
  panels: Panel[];
  // Image panels mirrored under the ground (empty without a ground plane).
  images: Panel[];
  // Source strength per panel, per unit length, in freestream units.
  strengths: Float64Array;
  // Velocity at a point in freestream units (outside the body only).
  velocityAt(x: number, y: number, out?: Vec2): Vec2;
}

// Solves for the source strengths that make every panel's control point
// flow-tangent (zero normal velocity) in a unit freestream along +x. With
// `ground`, the body must sit above y = 0, which then becomes a streamline.
export function solvePotentialFlow(polygon: Vec2[], options: { ground: boolean }): PotentialFlow {
  const panels = buildPanels(polygon);
  const images = options.ground ? panels.map(mirrorPanel) : [];
  const n = panels.length;
  const A = Array.from({ length: n }, () => new Float64Array(n));
  const b = new Float64Array(n);
  const v: Vec2 = { x: 0, y: 0 };
  for (let i = 0; i < n; i++) {
    const pi = panels[i];
    for (let j = 0; j < n; j++) {
      // A panel's own normal velocity at its midpoint is exactly 1/2 (the
      // limit of the closed form); set it directly rather than trust
      // atan2 at a point that's on the panel to within rounding.
      let a = i === j ? 0.5 : (sourceVelocity(panels[j], pi.xc, pi.yc, v), v.x * pi.nx + v.y * pi.ny);
      if (images.length) {
        sourceVelocity(images[j], pi.xc, pi.yc, v);
        a += v.x * pi.nx + v.y * pi.ny;
      }
      A[i][j] = a;
    }
    b[i] = -pi.nx; // freestream (1, 0) . n
  }
  const strengths = solveLinear(A, b);

  const velocityAt = (x: number, y: number, out: Vec2 = { x: 0, y: 0 }): Vec2 => {
    let u = 1;
    let w = 0;
    for (let j = 0; j < n; j++) {
      sourceVelocity(panels[j], x, y, v);
      u += strengths[j] * v.x;
      w += strengths[j] * v.y;
      if (images.length) {
        sourceVelocity(images[j], x, y, v);
        u += strengths[j] * v.x;
        w += strengths[j] * v.y;
      }
    }
    out.x = u;
    out.y = w;
    return out;
  };

  return { panels, images, strengths, velocityAt };
}

export function pointInPolygon(polygon: Vec2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const c = polygon[j];
    if (a.y > y !== c.y > y && x < ((c.x - a.x) * (y - a.y)) / (c.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// Splits every edge so no panel is longer than maxLengthM - more panels
// near nothing, but an even spacing keeps the solution well-conditioned.
export function densifyPolygon(polygon: Vec2[], maxLengthM: number): Vec2[] {
  const out: Vec2[] = [];
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / maxLengthM));
    for (let s = 0; s < steps; s++) {
      out.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
    }
  });
  return out;
}
