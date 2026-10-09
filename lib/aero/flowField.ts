import { pointInPolygon, PotentialFlow, Vec2 } from "./panelMethod";
import { BodyOutline } from "./bodyOutline";

// The flow the 2D wind tunnel draws: the potential-flow solution sampled on
// a grid (so particles can look velocities up cheaply every frame), with an
// empirical wake laid over it behind the body. Freestream units throughout:
// velocity 1 = freestream speed.

// --- Wake model -------------------------------------------------------------
//
// Potential flow can't separate, so it has no wake: behind a square-backed
// body it just closes back up into a second stagnation point, which is the
// opposite of what a real car does. The wake below is an illustrative,
// order-of-magnitude sketch of a bluff-body near wake - NOT solved from
// anything - so the visualisation shows roughly the right picture:
//
// - It starts at the body's base (the tail's vertical face), spanning the
//   base height h from the underbody trailing edge up to the upper
//   separation point - the tail top, or the roof's trailing edge if the
//   rear slope separates (see bodyOutline.ts), which makes h, and so the
//   whole wake, bigger.
// - Over a separated rear slope (between the roof edge and the base) the
//   air under the shear layer is dead, recirculating air.
// - Along its centreline the streamwise velocity is 1 - D(xi), with
//   xi = (distance behind the base) / h and D(xi) = 1.25 / sqrt(1 + xi^2):
//   reversed flow (-0.25) right behind the base, a recirculation bubble
//   closing about 0.75 h downstream, and a velocity deficit decaying
//   behind it (~40% at 3 h, ~20% at 6 h).
// - Its half-width grows slowly downstream, b = h/2 (1 + 0.12 xi), and it
//   blends into the potential flow over a mixing band 0.25 h wide.
//
// Those constants are representative of published bluff-body wake
// measurements in shape, not tuned to any vehicle, and nothing numeric
// (drag, pressure) is ever read from this region.
const WAKE_REVERSE_DEFICIT = 1.25;
const WAKE_SPREAD_PER_H = 0.12;
const WAKE_MIXING_BAND_H = 0.25;

export interface Wake {
  // Where the upper shear layer leaves the body, and where the base is.
  xSeparation: number;
  xBase: number;
  yTop: number;
  yBottom: number;
  baseHeightM: number;
}

export function wakeFromBody(body: BodyOutline): Wake {
  return {
    xSeparation: body.separationTop.x,
    xBase: Math.max(body.tailTop.x, body.separationBottom.x),
    yTop: body.separationTop.y,
    yBottom: body.separationBottom.y,
    baseHeightM: body.separationTop.y - body.separationBottom.y,
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function wakeDeficit(xi: number): number {
  return WAKE_REVERSE_DEFICIT / Math.sqrt(1 + xi * xi);
}

// How far a point is "in" the wake (0 outside, 1 on its core) and the
// wake's own streamwise velocity there. Points inside the body never get
// here (the sampled grid marks them solid first).
export function wakeAt(wake: Wake, x: number, y: number): { weight: number; u: number } {
  if (x < wake.xSeparation) return { weight: 0, u: 1 };
  const h = wake.baseHeightM;
  if (x < wake.xBase) {
    // Over a separated slope: everything under the shear layer.
    const weight = 1 - smoothstep(wake.yTop, wake.yTop + WAKE_MIXING_BAND_H * h, y);
    return { weight, u: 1 - wakeDeficit(0) };
  }
  const xi = (x - wake.xBase) / h;
  const halfWidth = (h / 2) * (1 + WAKE_SPREAD_PER_H * xi);
  const yCentre = (wake.yTop + wake.yBottom) / 2;
  const weight = 1 - smoothstep(halfWidth, halfWidth + WAKE_MIXING_BAND_H * h, Math.abs(y - yCentre));
  return { weight, u: 1 - wakeDeficit(xi) };
}

// The wake's outline, for drawing: the upper edge from the separation
// point, the lower from the base, both out to xEnd.
export function wakeOutline(wake: Wake, xEnd: number, samples = 24): { upper: Vec2[]; lower: Vec2[] } {
  const yCentre = (wake.yTop + wake.yBottom) / 2;
  const halfWidthAt = (x: number) =>
    (wake.baseHeightM / 2) * (1 + (WAKE_SPREAD_PER_H * Math.max(0, x - wake.xBase)) / wake.baseHeightM);
  const upper: Vec2[] = wake.xSeparation < wake.xBase ? [{ x: wake.xSeparation, y: wake.yTop }] : [];
  const lower: Vec2[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = wake.xBase + ((xEnd - wake.xBase) * i) / samples;
    upper.push({ x, y: yCentre + halfWidthAt(x) });
    lower.push({ x, y: Math.max(0, yCentre - halfWidthAt(x)) });
  }
  return { upper, lower };
}

// --- Sampled field ------------------------------------------------------------

// A velocity field sampled on a regular grid over 0 <= y <= yMax - above
// the ground for the side section, one half of the symmetric plan view.
export interface FlowField {
  xMin: number;
  xMax: number;
  yMax: number; // yMin is 0: the ground, or the plan view's centreline
  nx: number;
  ny: number;
  u: Float32Array;
  v: Float32Array;
  // 1 where the node is inside the body.
  solid: Uint8Array;
  wake: Wake;
}

export interface FlowGrid extends FlowField {
  body: BodyOutline;
}

export interface FlowDomain {
  xMin: number;
  xMax: number;
  yMax: number;
}

// The tunnel's extent around a body: enough upstream to show the flow
// slowing toward the nose, room downstream for the near wake (~6 base
// heights on a car), and tall enough that the roof flow isn't squeezed by
// the top of the picture. Kept tight because the panel is narrow and the
// scale is set by its width.
export function domainFor(body: BodyOutline): FlowDomain {
  return {
    xMin: -body.lengthM / 2 - 0.3 * body.lengthM,
    xMax: body.lengthM / 2 + 0.9 * body.lengthM,
    yMax: Math.max(3.2 * body.heightM, 0.55 * body.lengthM),
  };
}

export function sampleFlow(flow: PotentialFlow, body: BodyOutline, domain: FlowDomain, nx = 150): FlowGrid {
  return { ...sampleField(flow, body.polygon, wakeFromBody(body), domain, nx), body };
}

// The potential flow around `polygon` sampled over the domain, with the
// wake laid over it.
export function sampleField(
  flow: PotentialFlow,
  polygon: Vec2[],
  wake: Wake,
  domain: FlowDomain,
  nx = 150,
): FlowField {
  const ny = Math.max(20, Math.round((nx * domain.yMax) / (domain.xMax - domain.xMin)));
  const u = new Float32Array(nx * ny);
  const v = new Float32Array(nx * ny);
  const solid = new Uint8Array(nx * ny);
  const vel: Vec2 = { x: 0, y: 0 };
  for (let j = 0; j < ny; j++) {
    const y = (domain.yMax * j) / (ny - 1);
    for (let i = 0; i < nx; i++) {
      const x = domain.xMin + ((domain.xMax - domain.xMin) * i) / (nx - 1);
      const k = j * nx + i;
      if (pointInPolygon(polygon, x, y)) {
        solid[k] = 1;
        continue;
      }
      flow.velocityAt(x, y, vel);
      const { weight, u: wakeU } = wakeAt(wake, x, y);
      // Inside the wake the streamwise velocity follows the wake model and
      // the cross-flow is damped with it.
      u[k] = (1 - weight) * vel.x + weight * wakeU;
      v[k] = vel.y * (1 - weight * (1 - Math.max(0, wakeU)));
    }
  }
  return { ...domain, nx, ny, u, v, solid, wake };
}

// Bilinear lookup; returns false (and zero velocity) inside the body or
// outside the domain.
export function velocityAt(grid: FlowField, x: number, y: number, out: Vec2): boolean {
  const fx = ((x - grid.xMin) / (grid.xMax - grid.xMin)) * (grid.nx - 1);
  const fy = (y / grid.yMax) * (grid.ny - 1);
  if (fx < 0 || fy < 0 || fx > grid.nx - 1 || fy > grid.ny - 1) {
    out.x = 0;
    out.y = 0;
    return false;
  }
  const i = Math.min(grid.nx - 2, Math.floor(fx));
  const j = Math.min(grid.ny - 2, Math.floor(fy));
  const tx = fx - i;
  const ty = fy - j;
  const k00 = j * grid.nx + i;
  const k10 = k00 + 1;
  const k01 = k00 + grid.nx;
  const k11 = k01 + 1;
  // Nearest node solid -> treat the point as inside the body.
  const nearest = (ty < 0.5 ? (tx < 0.5 ? k00 : k10) : tx < 0.5 ? k01 : k11);
  if (grid.solid[nearest]) {
    out.x = 0;
    out.y = 0;
    return false;
  }
  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;
  out.x = grid.u[k00] * w00 + grid.u[k10] * w10 + grid.u[k01] * w01 + grid.u[k11] * w11;
  out.y = grid.v[k00] * w00 + grid.v[k10] * w10 + grid.v[k01] * w01 + grid.v[k11] * w11;
  return true;
}

export interface StreamlinePoint {
  x: number;
  y: number;
  speed: number;
}

// Traces a streamline from (x0, y0) downstream with midpoint (RK2) steps of
// fixed arc length, stopping at the body, the domain edge, or where the
// flow stalls (inside the wake's recirculation).
export function traceStreamline(grid: FlowField, x0: number, y0: number, stepM: number, maxSteps = 2000): StreamlinePoint[] {
  const points: StreamlinePoint[] = [];
  const a: Vec2 = { x: 0, y: 0 };
  const b: Vec2 = { x: 0, y: 0 };
  let x = x0;
  let y = y0;
  for (let s = 0; s < maxSteps; s++) {
    if (!velocityAt(grid, x, y, a)) break;
    const speed = Math.hypot(a.x, a.y);
    points.push({ x, y, speed });
    if (speed < 0.05) break;
    const hx = (0.5 * stepM * a.x) / speed;
    const hy = (0.5 * stepM * a.y) / speed;
    if (!velocityAt(grid, x + hx, y + hy, b)) break;
    const speedMid = Math.hypot(b.x, b.y);
    if (speedMid < 0.05) break;
    x += (stepM * b.x) / speedMid;
    y += (stepM * b.y) / speedMid;
  }
  return points;
}
