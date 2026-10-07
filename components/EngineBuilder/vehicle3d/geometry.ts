import * as THREE from "three";
import { BodyType } from "@/lib/physics/types";
import { VehicleState } from "@/lib/physics/vehicleState";

// Shared building blocks for the placeholder vehicle models. Scene units are
// metres, +X forward, +Y up, +Z to the car's left, ground at y = 0, and the
// body is centred on x = 0 / z = 0.

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

export function axleLayout(vehicle: VehicleState): AxleLayout {
  const { lengthM, wheelbaseM } = vehicle.dimensions;
  const overhangM = Math.max(0, lengthM - wheelbaseM);
  const frontX = lengthM / 2 - overhangM * FRONT_OVERHANG_SHARE[vehicle.identity.bodyType];
  return { frontX, rearX: frontX - wheelbaseM };
}

export interface Arch {
  x: number;
  centerY: number;
  radius: number;
}

// Gap between tyre and wheel arch, and the minimum bodywork kept over the
// top of an arch - so a tall wheel on a low body raises a fender bulge
// instead of cutting through the bonnet.
export const ARCH_CLEARANCE_M = 0.035;
const FENDER_MIN_THICKNESS_M = 0.06;
const PROFILE_SAMPLES = 64;

// A side-on body silhouette: flat floor at the ride height with wheel
// arches cut into it, and an upper outline following `profile`, raised
// into a fender wherever a wheel would otherwise poke through.
export function bodySideShape(
  lengthM: number,
  floorY: number,
  topY: number,
  profile: Profile,
  arches: Arch[],
): THREE.Shape {
  const halfL = lengthM / 2;
  const fenderTopAt = (x: number) =>
    Math.max(
      0,
      ...arches.map((a) => {
        const dx = Math.abs(x - a.x);
        return dx < a.radius ? a.centerY + Math.sqrt(a.radius ** 2 - dx ** 2) + FENDER_MIN_THICKNESS_M : 0;
      }),
    );

  const shape = new THREE.Shape();
  shape.moveTo(-halfL, floorY);
  for (const arch of [...arches].sort((a, b) => a.x - b.x)) {
    const dy = floorY - arch.centerY;
    const dx = Math.sqrt(Math.max(0, arch.radius ** 2 - dy ** 2));
    shape.lineTo(arch.x - dx, floorY);
    shape.absarc(arch.x, arch.centerY, arch.radius, Math.atan2(dy, -dx), Math.atan2(dy, dx), true);
  }
  shape.lineTo(halfL, floorY);
  for (let i = 0; i <= PROFILE_SAMPLES; i++) {
    const u = i / PROFILE_SAMPLES;
    const x = halfL - u * lengthM;
    const y = Math.max(floorY + sampleProfile(profile, u) * (topY - floorY), fenderTopAt(x));
    shape.lineTo(x, Math.max(y, floorY + 0.02));
  }
  shape.closePath();
  return shape;
}

// A closed polygon of profile-space points, mapped onto the body.
export function profilePolygonShape(lengthM: number, floorY: number, topY: number, points: Profile): THREE.Shape {
  const shape = new THREE.Shape();
  points.forEach(([u, v], i) => {
    const x = lengthM / 2 - u * lengthM;
    const y = floorY + v * (topY - floorY);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

// Shape from absolute (x, y) points in metres.
export function pointsShape(points: [number, number][]): THREE.Shape {
  return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
}

// Outline points are spaced no further apart than this before extruding.
// The flat side faces are triangulated straight from the outline, and with
// sparse points that gives long slivers spanning the whole car; a width
// taper (see shapeWidth) moves only their corners, twisting them into
// visible creases. Dense outline points keep every triangle short along
// the car, so the taper bends the surface smoothly. Splitting edges that run
// *across* the car isn't needed: the taper scales width uniformly at any
// one (x, y), so those stay straight.
const OUTLINE_MAX_SPACING_M = 0.1;

function densify(points: THREE.Vector2[], maxSpacingM: number): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  points.forEach((p, i) => {
    const next = points[(i + 1) % points.length];
    const steps = Math.max(1, Math.ceil(p.distanceTo(next) / maxSpacingM));
    for (let s = 0; s < steps; s++) out.push(p.clone().lerp(next, s / steps));
  });
  return out;
}

// Extrudes a side-on shape across the car's width, centred on z = 0.
export function extrudeAcross(shape: THREE.Shape, widthM: number, bevelM = 0.03): THREE.BufferGeometry {
  const depth = Math.max(0.01, widthM - 2 * bevelM);
  const outline = shape.getPoints(16);
  // getPoints repeats the start point at the end of a closed path.
  if (outline.length > 1 && outline[0].equals(outline[outline.length - 1])) outline.pop();
  const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(densify(outline, OUTLINE_MAX_SPACING_M)), {
    depth,
    bevelEnabled: bevelM > 0,
    bevelSize: bevelM,
    bevelThickness: bevelM,
    bevelSegments: 2,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

// Feature lines drawn over a body: creases sharper than this.
const EDGE_THRESHOLD_DEG = 20;

export interface ShapedBody {
  geometry: THREE.BufferGeometry;
  // CAD-style feature lines, matching the shaped surface.
  edges: THREE.BufferGeometry;
}

function scaleZ(geometry: THREE.BufferGeometry, factor: (x: number, y: number) => number) {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    position.setZ(i, position.getZ(i) * factor(position.getX(i), position.getY(i)));
  }
  position.needsUpdate = true;
}

// Carries the extrusion's normals through the taper analytically. The map
// (x, y, z) -> (x, y, z*f(x, y)) transforms normals by its inverse
// transpose, n' ~ (nx - z*fx/f*nz, ny - z*fy/f*nz, nz/f). Recomputing
// normals from the triangles instead would shade every triangulation seam
// on the flat side panels as a crease.
const NORMAL_EPSILON_M = 1e-3;

function taperNormals(geometry: THREE.BufferGeometry, factor: (x: number, y: number) => number) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const n = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const f = factor(x, y);
    const fx = (factor(x + NORMAL_EPSILON_M, y) - factor(x - NORMAL_EPSILON_M, y)) / (2 * NORMAL_EPSILON_M);
    const fy = (factor(x, y + NORMAL_EPSILON_M) - factor(x, y - NORMAL_EPSILON_M)) / (2 * NORMAL_EPSILON_M);
    n.fromBufferAttribute(normal, i);
    n.set(n.x - ((z * fx) / f) * n.z, n.y - ((z * fy) / f) * n.z, n.z / f).normalize();
    normal.setXYZ(i, n.x, n.y, n.z);
  }
  normal.needsUpdate = true;
}

// Squeezes an extruded body's width (z) by a factor that may vary with x
// and y - a plan-view taper toward the nose/tail, or a cabin's tumblehome
// narrowing toward the roof. Feature lines are found on the flat extrusion
// first (where the panels really are flat), then tapered along with it.
export function shapeWidth(
  geometry: THREE.BufferGeometry,
  factor: (x: number, y: number) => number,
): ShapedBody {
  const edges = new THREE.EdgesGeometry(geometry, EDGE_THRESHOLD_DEG);
  scaleZ(edges, factor);
  // Normals first: they need the untapered z.
  taperNormals(geometry, factor);
  scaleZ(geometry, factor);
  return { geometry, edges };
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

// Shared CAD-style palette, so every model reads as one family.
export const VEHICLE_COLORS = {
  body: "#b8b5ae",
  glass: "#3d3b36",
  trim: "#5a5750",
  edge: "#f5a000",
  tyre: "#2a2926",
  rim: "#85827a",
} as const;
